(() => {

    const ADMIN_ONLY = [
        "/users.html",
        "/technicians.html",
        "/departments.html",
        "/reports.html",
        "/activity-log.html",
        "/settings.html"
    ];

    const SUPPORT_ONLY = [
        "/my-queue.html",
        "/sla-monitor.html"
    ];


    function normalizeText(value) {

        return String(
            value || ""
        )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }


    function pathOf(link) {

        try {

            return new URL(
                link.href,
                window.location.origin
            ).pathname;

        } catch {

            return "";
        }
    }


    function hideLinkByPath(
        pathname
    ) {

        document
            .querySelectorAll(
                "a[href]"
            )
            .forEach(
                link => {

                    if (
                        pathOf(link) ===
                        pathname
                    ) {

                        link.style.setProperty(
                            "display",
                            "none",
                            "important"
                        );
                    }
                }
            );
    }


    function hideManagementSection() {

        document
            .querySelectorAll(
                ".nav-label"
            )
            .forEach(
                label => {

                    if (
                        normalizeText(
                            label.textContent
                        ) !==
                        "management"
                    ) {

                        return;
                    }


                    label.style.setProperty(
                        "display",
                        "none",
                        "important"
                    );


                    const next =
                        label.nextElementSibling;


                    if (
                        next &&
                        (
                            next.matches(
                                "nav"
                            ) ||
                            next.classList.contains(
                                "nav"
                            )
                        )
                    ) {

                        next.style.setProperty(
                            "display",
                            "none",
                            "important"
                        );
                    }
                }
            );
    }


    function removeSystemStatus() {

        const selectors = [
            "#systemStatus",
            ".system-status",
            ".system-status-card",
            ".system-status-widget",
            ".status-widget",
            "[data-system-status]"
        ];


        document
            .querySelectorAll(
                selectors.join(",")
            )
            .forEach(
                element => {

                    element.remove();
                }
            );


        /*
            Fallback for dashboard markup
            without a dedicated class/id.
        */

        document
            .querySelectorAll(
                "body *"
            )
            .forEach(
                element => {

                    const ownText =
                        Array
                            .from(
                                element.childNodes
                            )
                            .filter(
                                node =>
                                    node.nodeType ===
                                    Node.TEXT_NODE
                            )
                            .map(
                                node =>
                                    node.textContent
                            )
                            .join(" ");


                    if (
                        normalizeText(
                            ownText
                        ) !==
                        "system status"
                    ) {

                        return;
                    }


                    const knownContainer =
                        element.closest(
                            [
                                ".system-status",
                                ".status-card",
                                ".status-panel",
                                ".status-widget",
                                ".service-status",
                                "[data-system-status]"
                            ].join(",")
                        );


                    if (
                        knownContainer
                    ) {

                        knownContainer.remove();

                        return;
                    }


                    const parent =
                        element.parentElement;


                    if (
                        parent &&
                        !parent.matches(
                            "header, nav, .nav, .topbar"
                        )
                    ) {

                        parent.remove();

                    } else {

                        element.remove();
                    }
                }
            );
    }


    function fixCreateTicketNavigation() {

        document
            .querySelectorAll(
                "a[href]"
            )
            .forEach(
                link => {

                    const text =
                        normalizeText(
                            link.textContent
                        );


                    const isCreateLink =
                        text ===
                            "create ticket" ||
                        text ===
                            "+ create ticket" ||
                        text ===
                            "＋ create ticket" ||
                        text ===
                            "new ticket" ||
                        text ===
                            "+ new ticket" ||
                        text ===
                            "＋ new ticket";


                    if (
                        isCreateLink
                    ) {

                        link.href =
                            "/create-ticket.html";
                    }
                }
            );


        /*
            Dashboard currently uses a button
            instead of a normal link.
        */

        document.addEventListener(
            "click",
            event => {

                const target =
                    event.target.closest(
                        [
                            "#createTicketBtn",
                            "[data-create-ticket-nav]"
                        ].join(",")
                    );


                if (
                    !target
                ) {

                    return;
                }


                /*
                    Never hijack the actual
                    create-ticket submission form.
                */

                if (
                    target.closest(
                        "form"
                    )
                ) {

                    return;
                }


                event.preventDefault();

                event.stopPropagation();

                event.stopImmediatePropagation();


                window.location.href =
                    "/create-ticket.html";

            },
            true
        );
    }


    function applyRoleNavigation(
        role
    ) {

        role =
            String(
                role || ""
            ).toUpperCase();


        /*
            Management is ADMIN only.
        */

        if (
            role !==
            "ADMIN"
        ) {

            ADMIN_ONLY.forEach(
                hideLinkByPath
            );

            hideManagementSection();
        }


        /*
            Queue + SLA monitor are
            support workspaces.
        */

        if (
            role ===
            "STAFF"
        ) {

            SUPPORT_ONLY.forEach(
                hideLinkByPath
            );
        }
    }


    async function initializeRoleNavigation() {

        fixCreateTicketNavigation();

        removeSystemStatus();


        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials:
                            "same-origin"
                    }
                );


            if (
                !response.ok
            ) {

                return;
            }


            const data =
                await response.json();


            if (
                !data?.loggedIn ||
                !data?.user
            ) {

                return;
            }


            applyRoleNavigation(
                data.user.role
            );

        } catch (
            error
        ) {

            console.warn(
                "Role navigation unavailable:",
                error
            );
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeRoleNavigation
        );

    } else {

        initializeRoleNavigation();
    }

})();

/* =========================================================
   ENSURE CREATE TICKET NAV LINK
========================================================= */

function ensureCreateTicketNavLink() {

    const ticketsLink =
        document.querySelector(
            '.nav a[href="/tickets.html"]'
        );

    if (!ticketsLink) {
        return;
    }

    const nav =
        ticketsLink.closest(".nav");

    if (!nav) {
        return;
    }

    let createLink =
        nav.querySelector(
            'a[href="/create-ticket.html"]'
        );

    if (!createLink) {

        createLink =
            document.createElement("a");

        createLink.href =
            "/create-ticket.html";

        createLink.innerHTML = `
            <span class="nav-icon">＋</span>
            Create Ticket
        `;

        ticketsLink.insertAdjacentElement(
            "afterend",
            createLink
        );
    }

    if (
        window.location.pathname ===
        "/create-ticket.html"
    ) {

        nav
            .querySelectorAll("a")
            .forEach(link =>
                link.classList.remove("active")
            );

        createLink.classList.add(
            "active"
        );
    }
}


if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        ensureCreateTicketNavLink
    );

} else {

    ensureCreateTicketNavLink();
}

/* =========================================================
   PROFILE NAV — ALL LOGGED-IN ROLES
========================================================= */

function ensureProfileNavLink() {

    const nav =
        document.querySelector(
            '.nav a[href="/knowledge-base.html"]'
        )?.closest(".nav") ||
        document.querySelector(".nav");

    if (!nav) {
        return;
    }


    let profileLink =
        nav.querySelector(
            'a[href="/profile.html"]'
        );


    if (!profileLink) {

        profileLink =
            document.createElement("a");

        profileLink.href =
            "/profile.html";

        profileLink.innerHTML = `
            <span class="nav-icon">♙</span>
            Profile
        `;


        const kbLink =
            nav.querySelector(
                'a[href="/knowledge-base.html"]'
            );


        if (kbLink) {

            kbLink.insertAdjacentElement(
                "afterend",
                profileLink
            );

        } else {

            nav.appendChild(
                profileLink
            );
        }
    }


    profileLink.style.removeProperty(
        "display"
    );


    if (
        window.location.pathname ===
        "/profile.html"
    ) {

        nav
            .querySelectorAll("a")
            .forEach(link =>
                link.classList.remove("active")
            );

        profileLink.classList.add(
            "active"
        );
    }
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        ensureProfileNavLink
    );

} else {

    ensureProfileNavLink();
}
