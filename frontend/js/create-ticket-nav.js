(() => {

    function goToCreateTicket(event) {

        const target =
            event.target.closest(
                'a[href*="create-ticket"], #createTicketBtn, [data-create-ticket]'
            );

        if (!target) {
            return;
        }

        if (target.closest("form")) {
            return;
        }

        event.preventDefault();

        window.location.href =
            "/create-ticket.html";
    }


    function fixLinks() {

        document
            .querySelectorAll("a")
            .forEach(link => {

                const text =
                    String(
                        link.textContent || ""
                    )
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();


                if (
                    text.includes(
                        "create ticket"
                    ) ||
                    text.includes(
                        "new ticket"
                    )
                ) {

                    link.href =
                        "/create-ticket.html";

                    link.style.pointerEvents =
                        "auto";
                }
            });
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            fixLinks
        );

    } else {

        fixLinks();
    }


    document.addEventListener(
        "click",
        goToCreateTicket
    );

})();
