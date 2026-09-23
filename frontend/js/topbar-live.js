(function () {

    "use strict";


    const page =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    function get(id) {

        return document
            .getElementById(id);
    }


    function normalizeStatus(value) {

        return String(
            value || ""
        )
            .trim()
            .toUpperCase()
            .replace(
                /[\s-]+/g,
                "_"
            );
    }


    function firstValue(
        object,
        keys,
        fallback = null
    ) {

        for (
            const key of keys
        ) {

            if (
                object &&
                object[key] !==
                    undefined &&
                object[key] !==
                    null
            ) {

                return object[key];
            }
        }

        return fallback;
    }


    function extractTickets(data) {

        if (
            Array.isArray(data)
        ) {

            return data;
        }


        if (
            Array.isArray(
                data?.tickets
            )
        ) {

            return data.tickets;
        }


        if (
            Array.isArray(
                data?.data
            )
        ) {

            return data.data;
        }


        return [];
    }


    function isActive(ticket) {

        const status =
            normalizeStatus(
                ticket?.status
            );


        return ![
            "RESOLVED",
            "CLOSED"
        ].includes(
            status
        );
    }


    function getAssignedTo(
        ticket
    ) {

        return firstValue(
            ticket,
            [
                "assignedTo",
                "assigned_to",
                "technicianId",
                "technician_id",
                "assigneeId",
                "assignee_id"
            ],
            null
        );
    }


    function getDueDates(
        ticket
    ) {

        return [
            firstValue(
                ticket,
                [
                    "firstResponseDueAt",
                    "first_response_due_at",
                    "responseDueAt",
                    "response_due_at"
                ]
            ),

            firstValue(
                ticket,
                [
                    "resolutionDueAt",
                    "resolution_due_at",
                    "slaResolutionDueAt",
                    "sla_resolution_due_at"
                ]
            )
        ]
            .filter(Boolean)
            .map(
                value =>
                    new Date(value)
            )
            .filter(
                date =>
                    !Number.isNaN(
                        date.getTime()
                    )
            );
    }


    function needsSlaAttention(
        ticket
    ) {

        if (
            !isActive(ticket)
        ) {

            return false;
        }


        const breached =
            Boolean(
                firstValue(
                    ticket,
                    [
                        "slaBreached",
                        "sla_breached"
                    ],
                    false
                )
            );


        if (breached) {

            return true;
        }


        const explicitMinutes =
            Number(
                firstValue(
                    ticket,
                    [
                        "slaMinutes",
                        "sla_minutes"
                    ],
                    NaN
                )
            );


        if (
            Number.isFinite(
                explicitMinutes
            )
        ) {

            return (
                explicitMinutes <=
                60
            );
        }


        const dueDates =
            getDueDates(
                ticket
            );


        if (
            dueDates.length === 0
        ) {

            return false;
        }


        const nextDue =
            Math.min(
                ...dueDates.map(
                    date =>
                        date.getTime()
                )
            );


        const minutes =
            (
                nextDue -
                Date.now()
            ) /
            60000;


        return (
            minutes <=
            60
        );
    }


    function navLink(
        href
    ) {

        return document
            .querySelector(
                `.sidebar a[href="${href}"]`
            );
    }


    function badgeFor(
        href
    ) {

        return navLink(href)
            ?.querySelector(
                ".badge"
            );
    }


    function setBadge(
        href,
        value
    ) {

        const link =
            navLink(href);


        if (!link) {
            return;
        }


        let badge =
            link.querySelector(
                ".badge"
            );


        if (!badge) {

            badge =
                document.createElement(
                    "span"
                );

            badge.className =
                "badge";

            link.appendChild(
                badge
            );
        }


        badge.textContent =
            String(value);
    }


    function prepareDashboardBadges() {

        [
            "/tickets.html",
            "/my-queue.html",
            "/sla-monitor.html"
        ].forEach(
            href => {

                const badge =
                    badgeFor(href);

                if (badge) {

                    badge.textContent =
                        "…";
                }
            }
        );
    }


    async function loadDashboardBadges() {

        try {

            const [
                ticketResponse,
                userResponse
            ] =
                await Promise.all([
                    fetch(
                        "/api/tickets",
                        {
                            credentials:
                                "same-origin",

                            cache:
                                "no-store"
                        }
                    ),

                    fetch(
                        "/api/auth/me",
                        {
                            credentials:
                                "same-origin",

                            cache:
                                "no-store"
                        }
                    )
                ]);


            if (
                !ticketResponse.ok
            ) {

                throw new Error(
                    `Tickets HTTP ${ticketResponse.status}`
                );
            }


            const ticketData =
                await ticketResponse
                    .json();


            const userData =
                userResponse.ok
                    ? await userResponse
                        .json()
                    : {};


            const tickets =
                extractTickets(
                    ticketData
                );


            const active =
                tickets.filter(
                    isActive
                );


            const slaBreached =
                active.filter(
                    ticket =>
                        Boolean(
                            firstValue(
                                ticket,
                                [
                                    "slaBreached",
                                    "sla_breached"
                                ],
                                false
                            )
                        )
                );


            const currentUser =
                userData.user ||
                userData.data?.user ||
                null;


            const currentUserId =
                firstValue(
                    currentUser,
                    [
                        "id",
                        "userId",
                        "user_id"
                    ],
                    null
                );


            const queue =
                currentUserId ===
                    null
                    ? []
                    : active.filter(
                        ticket =>
                            String(
                                getAssignedTo(
                                    ticket
                                ) ?? ""
                            ) ===
                            String(
                                currentUserId
                            )
                    );


            /*
             * Sidebar meaning:
             *
             * Tickets
             * = currently active tickets
             *
             * My Queue
             * = active tickets assigned to me
             *
             * SLA Monitor
             * = active tickets breached or due
             *   within 60 minutes
             */

            setBadge(
                "/tickets.html",
                tickets.length
            );


            setBadge(
                "/my-queue.html",
                queue.length
            );


            setBadge(
                "/sla-monitor.html",
                slaBreached.length
            );


            console.log(
                "✅ Live sidebar counts:",
                {
                    tickets:
                        tickets.length,

                    myQueue:
                        queue.length,

                    slaBreached:
                        slaBreached.length
                }
            );

        } catch (error) {

            console.warn(
                "Sidebar live counts unavailable:",
                error
            );


            [
                "/tickets.html",
                "/my-queue.html",
                "/sla-monitor.html"
            ].forEach(
                href => {

                    const badge =
                        badgeFor(
                            href
                        );

                    if (badge) {

                        badge.remove();
                    }
                }
            );
        }
    }


    function setupDashboardSearch() {

        const input =
            get(
                "globalSearch"
            );


        if (!input) {
            return;
        }


        input.placeholder =
            "Search tickets...";


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Enter"
                ) {

                    return;
                }


                const query =
                    input.value
                        .trim();


                if (!query) {
                    return;
                }


                event.preventDefault();


                window.location.href =
                    `/tickets.html?q=${encodeURIComponent(
                        query
                    )}`;
            }
        );
    }


    function setupTicketsSearch() {

        const topSearch =
            get(
                "globalSearch"
            );


        const ticketSearch =
            get(
                "searchInput"
            );


        if (
            !topSearch ||
            !ticketSearch
        ) {

            return;
        }


        topSearch.placeholder =
            "Search tickets...";


        function syncTopToMain() {

            ticketSearch.value =
                topSearch.value;


            ticketSearch.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );
        }


        topSearch.addEventListener(
            "input",
            syncTopToMain
        );


        ticketSearch.addEventListener(
            "input",
            () => {

                if (
                    topSearch.value !==
                    ticketSearch.value
                ) {

                    topSearch.value =
                        ticketSearch.value;
                }
            }
        );


        const params =
            new URLSearchParams(
                window.location.search
            );


        const query =
            params.get(
                "q"
            );


        if (query) {

            topSearch.value =
                query;

            ticketSearch.value =
                query;


            setTimeout(
                () => {

                    ticketSearch
                        .dispatchEvent(
                            new Event(
                                "input",
                                {
                                    bubbles:
                                        true
                                }
                            )
                        );

                },
                50
            );
        }


        topSearch.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    topSearch.value =
                        "";

                    syncTopToMain();
                }
            }
        );
    }


    function setupReportsSearch() {

        const input =
            get(
                "topSearch"
            );

        if (!input) {
            return;
        }

        input.placeholder =
            "Search reports...";


        let reportMatches =
            [];


        function collectMatches() {

            const query =
                input.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                reportMatches =
                    [];

                input.title =
                    "";

                return;
            }


            const elements =
                [
                    ...document.querySelectorAll(
                        [
                            ".content h1",
                            ".content h2",
                            ".content h3",
                            ".content h4",
                            ".content .stat",
                            ".content .panel",
                            ".content .priority-row",
                            ".content tbody tr"
                        ].join(",")
                    )
                ];


            const seen =
                new Set();


            reportMatches =
                elements
                    .filter(
                        element => {

                            if (
                                element.offsetParent ===
                                null
                            ) {

                                return false;
                            }


                            const text =
                                String(
                                    element.innerText ||
                                    element.textContent ||
                                    ""
                                )
                                    .replace(
                                        /\\s+/g,
                                        " "
                                    )
                                    .trim()
                                    .toLowerCase();


                            if (
                                !text.includes(
                                    query
                                )
                            ) {

                                return false;
                            }


                            const target =
                                element.closest(
                                    "tr, .panel, section"
                                ) ||
                                element;


                            if (
                                seen.has(
                                    target
                                )
                            ) {

                                return false;
                            }


                            seen.add(
                                target
                            );


                            return true;
                        }
                    )
                    .map(
                        element =>
                            element.closest(
                                "tr, .panel, section"
                            ) ||
                            element
                    );


            input.title =
                reportMatches.length
                    ? `${reportMatches.length} matching report result(s). Press Enter.`
                    : "No matching report result.";
        }


        document.addEventListener(
            "input",
            event => {

                if (
                    event.target !==
                    input
                ) {

                    return;
                }


                /*
                 * reports-live.js uses a capture
                 * listener on the input itself.
                 * Run our report search from
                 * document capture first.
                 */

                setTimeout(
                    collectMatches,
                    0
                );
            },
            true
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.target !==
                    input
                ) {

                    return;
                }


                if (
                    event.key ===
                    "Escape"
                ) {

                    input.value =
                        "";

                    reportMatches =
                        [];

                    input.title =
                        "";

                    input.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                    return;
                }


                if (
                    event.key !==
                    "Enter"
                ) {

                    return;
                }


                event.preventDefault();


                collectMatches();


                const target =
                    reportMatches[0];


                if (!target) {

                    input.title =
                        "No matching report result.";

                    return;
                }


                target.scrollIntoView({
                    behavior:
                        "smooth",

                    block:
                        "center"
                });


                target.animate(
                    [
                        {
                            opacity:
                                0.55
                        },
                        {
                            opacity:
                                1
                        }
                    ],
                    {
                        duration:
                            500,

                        iterations:
                            1
                    }
                );
            },
            true
        );
    }


    function initialize() {

        if (
            page ===
            "dashboard.html"
        ) {

            prepareDashboardBadges();

            setupDashboardSearch();

            loadDashboardBadges();


            setInterval(
                loadDashboardBadges,
                30000
            );

            return;
        }


        if (
            page ===
            "tickets.html"
        ) {

            setupTicketsSearch();

            return;
        }


        if (
            page ===
            "reports.html"
        ) {

            setupReportsSearch();
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();
    }

})();
