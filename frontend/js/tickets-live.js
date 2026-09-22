(function () {

    "use strict";


    /* =========================================================
       STATE
    ========================================================= */

    let liveTickets =
        [];


    let refreshTimer =
        null;


    /* =========================================================
       ELEMENT HELPER
    ========================================================= */

    function get(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    /* =========================================================
       API
    ========================================================= */

    async function api(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "include",

                    ...options,

                    headers: {

                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),

                        ...(options.headers ||
                            {})

                    }
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch (
            error
        ) {

            data = {};
        }


        if (
            response.status ===
            401
        ) {

            window.location.replace(
                "/login.html"
            );


            throw new Error(
                "Authentication required."
            );
        }


        if (
            !response.ok
        ) {

            throw new Error(
                data.message ||
                "Unable to load tickets."
            );
        }


        return data;
    }


    /* =========================================================
       NORMALIZE VALUE
    ========================================================= */

    function firstValue(
        object,
        keys,
        fallback = null
    ) {

        for (
            const key of keys
        ) {

            if (
                object?.[key] !==
                    undefined &&
                object?.[key] !==
                    null
            ) {

                return object[
                    key
                ];
            }
        }


        return fallback;
    }


    /* =========================================================
       NORMALIZE STATUS
    ========================================================= */

    function normalizeStatus(
        value
    ) {

        return String(
            value ||
            "OPEN"
        )
            .trim()
            .toLowerCase()
            .replaceAll(
                "_",
                "-"
            )
            .replaceAll(
                " ",
                "-"
            );
    }


    /* =========================================================
       NORMALIZE PRIORITY
    ========================================================= */

    function normalizePriority(
        value
    ) {

        return String(
            value ||
            "MEDIUM"
        )
            .trim()
            .toLowerCase();
    }


    /* =========================================================
       NORMALIZE TICKET FROM API
    ========================================================= */

    function normalizeTicket(
        row
    ) {

        const id =
            firstValue(
                row,
                [
                    "id"
                ]
            );


        const ticketNumber =
            firstValue(
                row,
                [
                    "ticketNumber",
                    "ticket_number"
                ],
                `#${id}`
            );


        const resolutionDueAt =
            firstValue(
                row,
                [
                    "resolutionDueAt",
                    "resolution_due_at"
                ]
            );


        let slaMinutes =
            null;


        if (
            resolutionDueAt
        ) {

            const deadline =
                new Date(
                    resolutionDueAt
                );


            if (
                !Number.isNaN(
                    deadline.getTime()
                )
            ) {

                slaMinutes =
                    (
                        deadline.getTime() -
                        Date.now()
                    ) /
                    60000;
            }
        }


        return {

            dbId:
                id,

            id:
                String(
                    ticketNumber
                ),

            subject:
                String(
                    firstValue(
                        row,
                        [
                            "subject"
                        ],
                        "Untitled ticket"
                    )
                ),

            requester:
                String(
                    firstValue(
                        row,
                        [
                            "requesterName",
                            "requester_name",
                            "requester",
                            "requesterEmail",
                            "requester_email"
                        ],
                        "Unknown"
                    )
                ),

            department:
                String(
                    firstValue(
                        row,
                        [
                            "departmentName",
                            "department_name",
                            "department"
                        ],
                        "—"
                    )
                ),

            category:
                String(
                    firstValue(
                        row,
                        [
                            "categoryName",
                            "category_name",
                            "category"
                        ],
                        "—"
                    )
                ),

            technician:
                String(
                    firstValue(
                        row,
                        [
                            "assigneeName",
                            "assignee_name",
                            "assignedToName",
                            "assigned_to_name",
                            "technicianName",
                            "technician_name",
                            "technician"
                        ],
                        "Unassigned"
                    ) ||
                    "Unassigned"
                ),

            status:
                normalizeStatus(
                    firstValue(
                        row,
                        [
                            "status"
                        ],
                        "OPEN"
                    )
                ),

            priority:
                normalizePriority(
                    firstValue(
                        row,
                        [
                            "priority"
                        ],
                        "MEDIUM"
                    )
                ),

            createdAt:
                firstValue(
                    row,
                    [
                        "createdAt",
                        "created_at"
                    ]
                ),

            updatedAt:
                firstValue(
                    row,
                    [
                        "updatedAt",
                        "updated_at"
                    ]
                ),

            resolutionDueAt,

            resolvedAt:
                firstValue(
                    row,
                    [
                        "resolvedAt",
                        "resolved_at"
                    ]
                ),

            closedAt:
                firstValue(
                    row,
                    [
                        "closedAt",
                        "closed_at"
                    ]
                ),

            slaBreached:
                Boolean(
                    firstValue(
                        row,
                        [
                            "slaBreached",
                            "sla_breached"
                        ],
                        false
                    )
                ),

            slaMinutes

        };
    }


    /* =========================================================
       ESCAPE HTML
    ========================================================= */

    function safe(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    /* =========================================================
       LABEL
    ========================================================= */

    function label(
        value
    ) {

        return String(
            value ||
            ""
        )
            .replaceAll(
                "-",
                " "
            )
            .replaceAll(
                "_",
                " "
            )
            .toLowerCase()
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }


    /* =========================================================
       SLA
    ========================================================= */

    function formatSla(
        ticket
    ) {

        if (
            ticket.status ===
                "resolved" ||
            ticket.status ===
                "closed"
        ) {

            return {

                text:
                    "Completed",

                className:
                    "safe"

            };
        }


        if (
            !Number.isFinite(
                ticket.slaMinutes
            )
        ) {

            return {

                text:
                    "—",

                className:
                    ""

            };
        }


        if (
            ticket.slaBreached ||
            ticket.slaMinutes <=
                0
        ) {

            return {

                text:
                    "SLA Breached",

                className:
                    "breached"

            };
        }


        const totalMinutes =
            Math.ceil(
                ticket.slaMinutes
            );


        if (
            totalMinutes <
            60
        ) {

            return {

                text:
                    `${totalMinutes}m`,

                className:
                    "risk"

            };
        }


        const hours =
            Math.floor(
                totalMinutes /
                60
            );


        const minutes =
            totalMinutes %
            60;


        if (
            hours <
            24
        ) {

            return {

                text:
                    `${hours}h ${minutes}m`,

                className:
                    "safe"

            };
        }


        const days =
            Math.floor(
                hours /
                24
            );


        const remainingHours =
            hours %
            24;


        return {

            text:
                `${days}d ${remainingHours}h`,

            className:
                "safe"

        };
    }


    /* =========================================================
       FILTERS
    ========================================================= */

    function getFilteredTickets() {

        const search =
            String(
                get(
                    "searchInput"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const status =
            get(
                "statusFilter"
            )?.value ||
            "";


        const priority =
            get(
                "priorityFilter"
            )?.value ||
            "";


        const category =
            get(
                "categoryFilter"
            )?.value ||
            "";


        return liveTickets.filter(
            ticket => {

                const haystack =
                    [
                        ticket.id,
                        ticket.subject,
                        ticket.requester,
                        ticket.department,
                        ticket.category,
                        ticket.technician
                    ]
                        .join(
                            " "
                        )
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    haystack.includes(
                        search
                    );


                const matchesStatus =
                    !status ||
                    ticket.status ===
                        status;


                const matchesPriority =
                    !priority ||
                    ticket.priority ===
                        priority;


                const matchesCategory =
                    !category ||
                    ticket.category
                        .toLowerCase() ===
                        category.toLowerCase();


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesPriority &&
                    matchesCategory
                );
            }
        );
    }


    /* =========================================================
       RENDER TICKETS
    ========================================================= */

    function renderTickets() {

        const rows =
            get(
                "ticketRows"
            );


        const emptyState =
            get(
                "emptyState"
            );


        const resultsCount =
            get(
                "resultsCount"
            );


        if (
            !rows
        ) {

            return;
        }


        const filtered =
            getFilteredTickets();


        if (
            resultsCount
        ) {

            resultsCount.textContent =
                `${
                    filtered.length
                } ticket${
                    filtered.length === 1
                        ? ""
                        : "s"
                }`;
        }


        if (
            filtered.length ===
            0
        ) {

            rows.innerHTML =
                "";


            if (
                emptyState
            ) {

                emptyState.style.display =
                    "block";
            }


            return;
        }


        if (
            emptyState
        ) {

            emptyState.style.display =
                "none";
        }


        rows.innerHTML =
            filtered
                .map(
                    ticket => {

                        const sla =
                            formatSla(
                                ticket
                            );


                        return `
                            <tr
                                class="live-ticket-row"
                                data-ticket-id="${safe(
                                    ticket.dbId
                                )}"
                            >

                                <td>

                                    <span
                                        class="ticket-id"
                                    >
                                        ${safe(
                                            ticket.id
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <div
                                        class="subject"
                                    >

                                        <strong>
                                            ${safe(
                                                ticket.subject
                                            )}
                                        </strong>

                                        <span>
                                            ${safe(
                                                ticket.requester
                                            )}
                                            ·
                                            ${safe(
                                                ticket.department
                                            )}
                                        </span>

                                    </div>

                                </td>


                                <td>

                                    <span
                                        class="status ${safe(
                                            ticket.status
                                        )}"
                                    >
                                        ${safe(
                                            label(
                                                ticket.status
                                            )
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <span
                                        class="priority ${safe(
                                            ticket.priority
                                        )}"
                                    >
                                        ${safe(
                                            ticket.priority.toUpperCase()
                                        )}
                                    </span>

                                </td>


                                <td>
                                    ${safe(
                                        ticket.category
                                    )}
                                </td>


                                <td>
                                    ${safe(
                                        ticket.technician
                                    )}
                                </td>


                                <td>

                                    <span
                                        class="sla-time ${safe(
                                            sla.className
                                        )}"
                                    >
                                        ${safe(
                                            sla.text
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <button
                                        class="action-button live-view-ticket"
                                        type="button"
                                        data-ticket-id="${safe(
                                            ticket.dbId
                                        )}"
                                    >
                                        View →
                                    </button>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join(
                    ""
                );
    }


    /* =========================================================
       STATS
    ========================================================= */

    function updateStats() {

        setText(
            "totalTickets",
            liveTickets.length
        );


        setText(
            "ticketNavCount",
            liveTickets.length
        );


        setText(
            "openTickets",
            liveTickets.filter(
                ticket =>
                    ticket.status ===
                    "open"
            ).length
        );


        setText(
            "progressTickets",
            liveTickets.filter(
                ticket =>
                    ticket.status ===
                    "in-progress"
            ).length
        );


        setText(
            "resolvedTickets",
            liveTickets.filter(
                ticket =>
                    ticket.status ===
                    "resolved"
            ).length
        );


        const risk =
            liveTickets.filter(
                ticket => {

                    const active =
                        ![
                            "resolved",
                            "closed"
                        ].includes(
                            ticket.status
                        );


                    return (
                        active &&
                        Number.isFinite(
                            ticket.slaMinutes
                        ) &&
                        ticket.slaMinutes <=
                            60
                    );
                }
            ).length;


        setText(
            "slaRiskTickets",
            risk
        );
    }


    function setText(
        id,
        value
    ) {

        const element =
            get(
                id
            );


        if (
            element
        ) {

            element.textContent =
                value;
        }
    }


    /* =========================================================
       CATEGORY FILTER FROM DATABASE RESULTS
    ========================================================= */

    function renderCategoryFilter() {

        const select =
            get(
                "categoryFilter"
            );


        if (
            !select
        ) {

            return;
        }


        const selected =
            select.value;


        const categories =
            [
                ...new Set(
                    liveTickets
                        .map(
                            ticket =>
                                ticket.category
                        )
                        .filter(
                            category =>
                                category &&
                                category !==
                                    "—"
                        )
                )
            ]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a.localeCompare(
                            b
                        )
                );


        select.innerHTML =
            `
                <option value="">
                    All Categories
                </option>
            `;


        categories.forEach(
            category => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    category.toLowerCase();


                option.textContent =
                    category;


                select.appendChild(
                    option
                );
            }
        );


        if (
            [
                ...select.options
            ].some(
                option =>
                    option.value ===
                    selected
            )
        ) {

            select.value =
                selected;
        }
    }


    /* =========================================================
       ADD CLOSED FILTER IF MISSING
    ========================================================= */

    function ensureClosedStatus() {

        const select =
            get(
                "statusFilter"
            );


        if (
            !select
        ) {

            return;
        }


        const exists =
            [
                ...select.options
            ].some(
                option =>
                    option.value ===
                    "closed"
            );


        if (
            exists
        ) {

            return;
        }


        const option =
            document.createElement(
                "option"
            );


        option.value =
            "closed";


        option.textContent =
            "Closed";


        select.appendChild(
            option
        );
    }


    /* =========================================================
       LOAD REAL TICKETS
    ========================================================= */

    async function loadTickets(
        {
            silent = false
        } = {}
    ) {

        try {

            const data =
                await api(
                    "/api/tickets"
                );


            const rows =
                Array.isArray(
                    data
                )
                    ? data
                    : (
                        data.tickets ||
                        data.data ||
                        []
                    );


            liveTickets =
                rows.map(
                    normalizeTicket
                );


            renderCategoryFilter();

            updateStats();

            renderTickets();


            console.log(
                "✅ ResolveDesk live tickets:",
                liveTickets
            );

        } catch (
            error
        ) {

            console.error(
                "❌ Unable to load tickets:",
                error
            );


            if (
                !silent
            ) {

                const results =
                    get(
                        "resultsCount"
                    );


                if (
                    results
                ) {

                    results.textContent =
                        "Unable to load tickets";
                }


                const empty =
                    get(
                        "emptyState"
                    );


                if (
                    empty
                ) {

                    empty.style.display =
                        "block";


                    const heading =
                        empty.querySelector(
                            "h3"
                        );


                    const paragraph =
                        empty.querySelector(
                            "p"
                        );


                    if (
                        heading
                    ) {

                        heading.textContent =
                            "Unable to load tickets";
                    }


                    if (
                        paragraph
                    ) {

                        paragraph.textContent =
                            error.message;
                    }
                }
            }
        }
    }


    /* =========================================================
       FILTER EVENTS
    ========================================================= */

    function setupFilters() {

        [
            "searchInput",
            "statusFilter",
            "priorityFilter",
            "categoryFilter"
        ]
            .forEach(
                id => {

                    const element =
                        get(
                            id
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    element.addEventListener(
                        id ===
                            "searchInput"
                            ? "input"
                            : "change",

                        () => {

                            /*
                                This listener runs after
                                the old demo listener.

                                We render REAL data last.
                            */

                            setTimeout(
                                renderTickets,
                                0
                            );
                        }
                    );
                }
            );


        const reset =
            get(
                "resetFilters"
            );


        if (
            reset
        ) {

            reset.addEventListener(
                "click",
                () => {

                    const search =
                        get(
                            "searchInput"
                        );


                    const status =
                        get(
                            "statusFilter"
                        );


                    const priority =
                        get(
                            "priorityFilter"
                        );


                    const category =
                        get(
                            "categoryFilter"
                        );


                    if (
                        search
                    ) {
                        search.value =
                            "";
                    }


                    if (
                        status
                    ) {
                        status.value =
                            "";
                    }


                    if (
                        priority
                    ) {
                        priority.value =
                            "";
                    }


                    if (
                        category
                    ) {
                        category.value =
                            "";
                    }


                    setTimeout(
                        renderTickets,
                        0
                    );
                }
            );
        }
    }


    /* =========================================================
       TABLE CLICK
    ========================================================= */

    function setupTicketClicks() {

        const rows =
            get(
                "ticketRows"
            );


        if (
            !rows
        ) {

            return;
        }


        rows.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".live-view-ticket"
                    );


                const row =
                    event.target.closest(
                        ".live-ticket-row"
                    );


                const target =
                    button ||
                    row;


                if (
                    !target
                ) {

                    return;
                }


                const id =
                    target.dataset
                        .ticketId;


                if (
                    !id
                ) {

                    return;
                }


                window.location.href =
                    `/ticket-detail.html?id=${
                        encodeURIComponent(
                            id
                        )
                    }`;
            }
        );
    }


    /* =========================================================
       NEW TICKET BUTTON

       Prevent old demo modal from opening.
    ========================================================= */

    function setupCreateTicketButton() {

        const button =
            get(
                "newTicketButton"
            );


        if (
            !button
        ) {

            return;
        }


        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();

                event.stopImmediatePropagation();


                window.location.href =
                    "/create-ticket.html";

            },
            true
        );
    }


    /* =========================================================
       REMOVE OLD DEMO MODAL
    ========================================================= */

    function removeDemoModal() {

        const modal =
            get(
                "ticketModal"
            );


        if (
            modal
        ) {

            modal.remove();
        }
    }


    /* =========================================================
       EXTRA LIVE CSS
    ========================================================= */

    function installStyles() {

        const style =
            document.createElement(
                "style"
            );


        style.textContent = `

            .live-ticket-row {
                cursor: pointer;
            }

            .live-ticket-row:hover {
                background:
                    rgba(
                        103,
                        174,
                        202,
                        .035
                    );
            }

            .sla-time.risk {
                color: #f0a8c2;
            }

            .sla-time.breached {
                color: #E52A6F;
                font-weight: 900;
            }

            .sla-time.safe {
                color: #9bcddd;
            }

        `;


        document.head.appendChild(
            style
        );
    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    async function initialize() {

        installStyles();

        ensureClosedStatus();

        setupFilters();

        setupTicketClicks();

        setupCreateTicketButton();


        /*
            Old modal JS has already initialized
            before this external script.

            Safe to remove it now.
        */

        removeDemoModal();


        await loadTickets();


        /*
            Keep ticket list fresh.
            No full-page reload required.
        */

        refreshTimer =
            setInterval(
                () => {

                    loadTickets({
                        silent:
                            true
                    });

                },
                30000
            );
    }


    initialize();

})();