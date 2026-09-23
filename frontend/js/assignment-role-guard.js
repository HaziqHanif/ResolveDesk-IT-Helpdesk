(() => {

    function hideElement(
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


    function hideAssignmentControls() {

        hideElement(
            document.getElementById(
                "assignmentGroup"
            )
        );


        const assigneeSelect =
            document.getElementById(
                "assigneeSelect"
            );

        if (assigneeSelect) {

            const parent =
                assigneeSelect.closest(
                    ".form-group, .field, .control-group"
                );

            hideElement(
                parent ||
                assigneeSelect
            );
        }


        document
            .querySelectorAll(
                "button, a"
            )
            .forEach(
                element => {

                    const text =
                        String(
                            element.textContent ||
                            ""
                        )
                            .replace(
                                /\s+/g,
                                " "
                            )
                            .trim()
                            .toLowerCase();


                    const assignmentAction =
                        text ===
                            "assign to me" ||
                        text ===
                            "assign technician" ||
                        text ===
                            "reassign" ||
                        text ===
                            "reassign ticket";


                    if (
                        assignmentAction
                    ) {

                        hideElement(
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
                role ===
                "ADMIN"
            ) {

                return;
            }


            hideAssignmentControls();


            const observer =
                new MutationObserver(
                    hideAssignmentControls
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
                "Assignment role guard error:",
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
