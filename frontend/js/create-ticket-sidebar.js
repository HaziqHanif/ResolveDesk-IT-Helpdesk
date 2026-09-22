(() => {

    function init() {

        const sidebar =
            document.getElementById("sidebar") ||
            document.querySelector(".sidebar");

        const backdrop =
            document.getElementById("sidebarBackdrop");

        const menuButton =
            document.getElementById("menuBtn") ||
            document.getElementById("mobileMenuButton") ||
            document.querySelector(
                ".menu-btn, .menu-button, .mobile-menu-button"
            );

        if (!sidebar || !backdrop || !menuButton) {
            console.warn("Create Ticket sidebar controls not found.", {
                sidebar,
                backdrop,
                menuButton
            });
            return;
        }


        function openSidebar() {

            sidebar.classList.add("open");

            backdrop.classList.add("open");

            document.body.classList.add(
                "sidebar-open"
            );
        }


        function closeSidebar() {

            sidebar.classList.remove("open");

            backdrop.classList.remove("open");

            document.body.classList.remove(
                "sidebar-open"
            );
        }


        function toggleSidebar(event) {

            event.preventDefault();

            event.stopPropagation();

            if (
                sidebar.classList.contains(
                    "open"
                )
            ) {

                closeSidebar();

            } else {

                openSidebar();
            }
        }


        menuButton.style.pointerEvents =
            "auto";

        menuButton.style.position =
            "relative";

        menuButton.style.zIndex =
            "300";


        menuButton.addEventListener(
            "click",
            toggleSidebar,
            true
        );


        backdrop.addEventListener(
            "click",
            closeSidebar
        );


        sidebar
            .querySelectorAll("a")
            .forEach(link => {

                link.addEventListener(
                    "click",
                    closeSidebar
                );
            });


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeSidebar();
                }
            }
        );
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

})();
