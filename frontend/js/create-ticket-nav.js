(() => {

    let currentRole = null;


    function getCreateTicketTargets() {

        return [
            ...document.querySelectorAll(
                'a[href*="create-ticket"], #createTicketBtn, [data-create-ticket]'
            )
        ];
    }


    function isCreateTicketLink(
        element
    ) {

        if (!element) {
            return false;
        }

        const text =
            String(
                element.textContent || ""
            )
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();

        const href =
            String(
                element.getAttribute?.(
                    "href"
                ) || ""
            )
                .toLowerCase();

        return (
            href.includes(
                "create-ticket"
            ) ||
            text.includes(
                "create ticket"
            ) ||
            text.includes(
                "new ticket"
            ) ||
            element.id ===
                "createTicketBtn" ||
            element.hasAttribute?.(
                "data-create-ticket"
            )
        );
    }


    function applyRoleAccess() {

        document
            .querySelectorAll("a")
            .forEach(
                link => {

                    if (
                        !isCreateTicketLink(
                            link
                        )
                    ) {
                        return;
                    }

                    if (
                        currentRole ===
                        "TECHNICIAN"
                    ) {

                        link.style.display =
                            "none";

                        link.setAttribute(
                            "aria-hidden",
                            "true"
                        );

                        return;
                    }

                    link.href =
                        "/create-ticket.html";

                    link.style.removeProperty(
                        "display"
                    );

                    link.style.removeProperty(
                        "pointer-events"
                    );

                    link.removeAttribute(
                        "aria-hidden"
                    );
                }
            );


        getCreateTicketTargets()
            .forEach(
                target => {

                    if (
                        currentRole ===
                        "TECHNICIAN"
                    ) {

                        target.style.display =
                            "none";

                        target.setAttribute(
                            "aria-hidden",
                            "true"
                        );
                    }
                }
            );
    }


    async function loadRole() {

        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials:
                            "include"
                    }
                );

            if (
                !response.ok
            ) {
                return;
            }

            const data =
                await response.json();

            currentRole =
                data?.user?.role ||
                null;

            applyRoleAccess();

        } catch (error) {

            console.error(
                "Create Ticket nav role check failed:",
                error
            );
        }
    }


    function goToCreateTicket(
        event
    ) {

        const target =
            event.target.closest(
                'a[href*="create-ticket"], #createTicketBtn, [data-create-ticket]'
            );

        if (
            !target
        ) {
            return;
        }


        if (
            target.closest(
                "form"
            )
        ) {
            return;
        }


        if (
            currentRole ===
            "TECHNICIAN"
        ) {

            event.preventDefault();

            event.stopPropagation();

            event.stopImmediatePropagation();

            return;
        }


        event.preventDefault();

        window.location.href =
            "/create-ticket.html";
    }


    function init() {

        applyRoleAccess();

        loadRole();
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();
    }


    document.addEventListener(
        "click",
        goToCreateTicket,
        true
    );

})();
