(() => {

    function normalize(
        value
    ) {

        return String(
            value ||
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .toLowerCase();
    }


    function hide(
        element
    ) {

        if (!element) {
            return;
        }

        element.hidden =
            true;

        element.style.display =
            "none";
    }


    function removeCreateTicketControls() {

        document
            .querySelectorAll(
                "a, button"
            )
            .forEach(
                element => {

                    const text =
                        normalize(
                            element.textContent
                        );

                    const href =
                        normalize(
                            element.getAttribute(
                                "href"
                            )
                        );


                    const isCreateTicket =
                        href.includes(
                            "create-ticket.html"
                        ) ||
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
                        isCreateTicket
                    ) {

                        hide(
                            element
                        );
                    }
                }
            );
    }


    async function initialize() {

        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials:
                            "include"
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.loggedIn ||
                !data.user
            ) {

                return;
            }


            const role =
                String(
                    data.user.role ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            if (
                role !==
                "TECHNICIAN"
            ) {

                return;
            }


            /*
                Technician cannot access
                Create Ticket page directly.
            */

            if (
                window.location.pathname
                    .toLowerCase()
                    .endsWith(
                        "/create-ticket.html"
                    )
            ) {

                window.location.replace(
                    "/tickets.html"
                );

                return;
            }


            removeCreateTicketControls();


            const observer =
                new MutationObserver(
                    removeCreateTicketControls
                );


            observer.observe(
                document.body,
                {
                    childList:
                        true,

                    subtree:
                        true
                }
            );


        } catch (error) {

            console.error(
                "Create ticket role guard error:",
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
            initialize,
            {
                once:
                    true
            }
        );

    } else {

        initialize();
    }

})();
