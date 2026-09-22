(() => {

    function hidePreference(label) {

        document
            .querySelectorAll(".preference-row")
            .forEach(row => {

                if (
                    row.textContent
                        .replace(/\s+/g, " ")
                        .includes(label)
                ) {
                    row.style.display = "none";
                }
            });
    }


    function showAllPreferences() {

        document
            .querySelectorAll(".preference-row")
            .forEach(row => {
                row.style.removeProperty("display");
            });
    }


    function setRecentActivityVisible(visible) {

        const panels =
            [...document.querySelectorAll(
                ".panel"
            )];

        const recentPanel =
            panels.find(element => {

                const text =
                    element.textContent
                        .replace(/\s+/g, " ")
                        .trim();

                return (
                    text.includes("Recent Activity") &&
                    text.includes(
                        "Your latest ResolveDesk actions"
                    )
                );
            });


        if (recentPanel) {

            recentPanel.style.display =
                visible ? "" : "none";
        }
    }


    async function applyProfileRoleContent() {

        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials: "include",
                        cache: "no-store"
                    }
                );

            const data =
                await response.json();


            if (
                !data.loggedIn ||
                !data.user
            ) {
                return;
            }


            const role =
                String(
                    data.user.role || ""
                ).toUpperCase();


            showAllPreferences();
            setRecentActivityVisible(true);


            /* =========================
               STAFF
            ========================= */

            if (role === "STAFF") {

                hidePreference(
                    "Ticket assignment alerts"
                );

                hidePreference(
                    "SLA alerts"
                );

                hidePreference(
                    "Daily support summary"
                );



                setRecentActivityVisible(
                    true
                );

                return;
            }


            /* =========================
               TECHNICIAN
            ========================= */

            if (
                role === "TECHNICIAN"
            ) {

                /*
                 * Technician can use:
                 * - Assignment alerts
                 * - SLA alerts
                 * - Email notifications
                 * - Daily support summary
                 */


                setRecentActivityVisible(
                    true
                );

                return;
            }


            /* =========================
               ADMIN
            ========================= */

            if (role === "ADMIN") {

                /*
                 * Admin keeps all preferences.
                 * Existing activity panel remains visible.
                 */

                return;
            }

        } catch (error) {

            console.error(
                "Profile role content failed:",
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
            applyProfileRoleContent
        );

    } else {

        applyProfileRoleContent();
    }

})();

/* =========================================================
   HIDE DUPLICATE LOWER PHOTO PANEL
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const photoPreview =
            document.getElementById(
                "photoPreview"
            );

        const photoPanel =
            photoPreview?.closest(
                ".panel"
            );

        if (photoPanel) {
            photoPanel.style.display =
                "none";
        }

    }
);
