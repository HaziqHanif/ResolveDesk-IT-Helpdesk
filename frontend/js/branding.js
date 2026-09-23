(function () {

    "use strict";

    async function loadBranding() {

        try {

            const response =
                await fetch(
                    "/api/settings/branding",
                    {
                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                return;
            }

            const data =
                await response.json();

            if (
                !data.success ||
                !data.branding
            ) {
                return;
            }

            const organizationName =
                data.branding.organizationName ||
                "ResolveDesk";

            const helpDeskName =
                data.branding.helpDeskName ||
                "ResolveDesk IT Support";


            /* =========================
               SIDEBAR BRANDING
            ========================= */

            document
                .querySelectorAll(
                    ".brand"
                )
                .forEach(
                    brand => {

                        const strong =
                            brand.querySelector(
                                "strong"
                            );

                        const span =
                            brand.querySelector(
                                "div > span"
                            );

                        if (strong) {
                            strong.textContent =
                                helpDeskName;
                        }

                        if (span) {
                            span.textContent =
                                organizationName;
                        }

                    }
                );


            /* =========================
               OPTIONAL GLOBAL TARGETS
            ========================= */

            document
                .querySelectorAll(
                    "[data-organization-name]"
                )
                .forEach(
                    element => {

                        element.textContent =
                            organizationName;
                    }
                );


            document
                .querySelectorAll(
                    "[data-helpdesk-name]"
                )
                .forEach(
                    element => {

                        element.textContent =
                            helpDeskName;
                    }
                );


            console.log(
                "✅ Branding loaded:",
                {
                    organizationName,
                    helpDeskName
                }
            );

        } catch (error) {

            console.warn(
                "Branding load failed:",
                error
            );
        }
    }


    window.ResolveDeskBranding = {
        refresh: loadBranding
    };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            loadBranding,
            {
                once: true
            }
        );

    } else {

        loadBranding();
    }

})();
