/* =========================================================
   RESOLVEDESK GLOBAL AUTH + LOGOUT
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logout() {

        const buttons =
            document.querySelectorAll(
                "[data-logout]"
            );


        buttons.forEach(
            button => {

                button.disabled =
                    true;

                button.dataset.originalText =
                    button.textContent;

                button.textContent =
                    "Signing out...";
            }
        );


        try {

            const response =
                await fetch(
                    "/api/auth/logout",
                    {
                        method:
                            "POST",

                        credentials:
                            "include",

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );


            let data = {};


            try {

                data =
                    await response.json();

            } catch (error) {

                data = {};
            }


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    "Unable to sign out."
                );
            }


            /*
                Remove old/demo auth keys only.
            */

            localStorage.removeItem(
                "resolvedesk_current_user"
            );

            localStorage.removeItem(
                "resolvedesk_user"
            );

            localStorage.removeItem(
                "resolvedesk_logged_in"
            );


            sessionStorage.removeItem(
                "resolvedesk_current_user"
            );

            sessionStorage.removeItem(
                "resolvedesk_user"
            );


            window.location.replace(
                "/login.html?logout=1"
            );

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );


            buttons.forEach(
                button => {

                    button.disabled =
                        false;

                    button.textContent =
                        button.dataset.originalText ||
                        "Logout";
                }
            );


            alert(
                error.message ||
                "Unable to sign out."
            );
        }
    }


    /* =====================================================
       CURRENT SESSION
    ===================================================== */

    async function getCurrentSession() {

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

                return null;
            }


            const data =
                await response.json();


            if (
                !data.loggedIn ||
                !data.user
            ) {

                return null;
            }


            return data.user;

        } catch (error) {

            console.error(
                "Session check failed:",
                error
            );


            return null;
        }
    }


    /* =====================================================
       REQUIRE LOGIN
    ===================================================== */

    async function requireLogin() {

        const user =
            await getCurrentSession();


        if (
            !user
        ) {

            window.location.replace(
                "/login.html"
            );


            return null;
        }


        return user;
    }


    /* =====================================================
       GLOBAL LOGOUT STYLE
    ===================================================== */

    function injectLogoutStyles() {

        if (
            document.getElementById(
                "resolvedeskLogoutStyle"
            )
        ) {

            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "resolvedeskLogoutStyle";


        style.textContent = `

            .resolvedesk-logout-area {
    position: relative;
    z-index: 50;

    flex-shrink: 0;

    margin-top: 14px;
    margin-bottom: 14px;

    padding-top: 14px;

    border-top:
        1px solid
        rgba(103,174,202,.08);
}

        .sidebar {
    overflow-y: auto;
    overflow-x: hidden;
}

.resolvedesk-logout-button {
    position: relative;
    z-index: 51;
}

            .resolvedesk-logout-button {
                width: 100%;
                min-height: 44px;

                display: flex;
                align-items: center;

                gap: 11px;

                padding:
                    0 12px;

                border:
                    1px solid
                    rgba(229,42,111,.14);

                border-radius:
                    12px;

                background:
                    rgba(229,42,111,.05);

                color:
                    #d998b0;

                font: inherit;
                font-size:
                    12px;

                font-weight:
                    800;

                cursor:
                    pointer;

                transition:
                    .18s ease;
            }

            .resolvedesk-logout-button:hover {
                color:
                    #ffffff;

                border-color:
                    rgba(229,42,111,.28);

                background:
                    rgba(229,42,111,.12);

                transform:
                    translateY(-1px);
            }

            .resolvedesk-logout-button:disabled {
                opacity:
                    .6;

                cursor:
                    wait;

                transform:
                    none;
            }

            .resolvedesk-logout-icon {
                width:
                    28px;

                height:
                    28px;

                display:
                    grid;

                place-items:
                    center;

                flex-shrink:
                    0;

                border-radius:
                    8px;

                background:
                    rgba(229,42,111,.08);

                font-size:
                    13px;
            }

            .resolvedesk-floating-logout {
                position:
                    fixed;

                right:
                    22px;

                bottom:
                    22px;

                z-index:
                    9998;

                width:
                    auto;

                min-width:
                    120px;

                box-shadow:
                    0 18px 50px
                    rgba(0,0,0,.35);

                backdrop-filter:
                    blur(15px);
            }

        `;


        document.head.appendChild(
            style
        );
    }


    /* =====================================================
       CREATE LOGOUT BUTTON
    ===================================================== */

    function createLogoutButton() {

        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "resolvedesk-logout-button";


        button.setAttribute(
            "data-logout",
            ""
        );


        const icon =
            document.createElement(
                "span"
            );


        icon.className =
            "resolvedesk-logout-icon";


        icon.textContent =
            "↪";


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
            "Logout";


        button.append(
            icon,
            text
        );


        return button;
    }


    /* =====================================================
       AUTO ADD LOGOUT BUTTON
    ===================================================== */

    function injectLogoutButton() {

    if (
        document.querySelector(
            "[data-logout]"
        )
    ) {
        return;
    }


    injectLogoutStyles();


    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    const button =
        createLogoutButton();


    if (
        sidebar
    ) {

        const area =
            document.createElement(
                "div"
            );


        area.className =
            "resolvedesk-logout-area";


        area.appendChild(
            button
        );


        /*
            Cari block TICKET SERVICE
            dan letak Logout SEBELUM block itu.
        */

        const sidebarChildren =
            Array.from(
                sidebar.children
            );


        const serviceBlock =
            sidebarChildren.find(
                element => {

                    const text =
                        (
                            element.textContent ||
                            ""
                        )
                            .replace(
                                /\s+/g,
                                " "
                            )
                            .trim()
                            .toUpperCase();


                    return (
                        text.includes(
                            "TICKET SERVICE"
                        ) ||
                        text.includes(
                            "QUEUE OPERATIONAL"
                        )
                    );
                }
            );


        if (
            serviceBlock
        ) {

            sidebar.insertBefore(
                area,
                serviceBlock
            );

        } else {

            sidebar.appendChild(
                area
            );
        }


        return;
    }


    button.classList.add(
        "resolvedesk-floating-logout"
    );


    document.body.appendChild(
        button
    );
}

    /* =====================================================
       BIND LOGOUT
    ===================================================== */

    function bindLogoutButtons() {

        const buttons =
            document.querySelectorAll(
                "[data-logout]"
            );


        buttons.forEach(
            button => {

                if (
                    button.dataset.logoutBound ===
                    "true"
                ) {

                    return;
                }


                button.dataset.logoutBound =
                    "true";


                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();


                        const confirmed =
                            window.confirm(
                                "Sign out of ResolveDesk?"
                            );


                        if (
                            confirmed
                        ) {

                            logout();
                        }
                    }
                );
            }
        );
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        injectLogoutButton();

        bindLogoutButtons();
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();
    }


    /* =====================================================
       GLOBAL API
    ===================================================== */

    window.ResolveDeskAuth = {

        logout,

        getCurrentSession,

        requireLogin,

        injectLogoutButton,

        bindLogoutButtons

    };

})();