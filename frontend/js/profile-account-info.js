(() => {

    function formatRole(role) {

        const value =
            String(
                role || ""
            ).toUpperCase();

        if (value === "ADMIN") {
            return "Administrator";
        }

        if (value === "TECHNICIAN") {
            return "Technician";
        }

        if (value === "STAFF") {
            return "Staff";
        }

        return value || "User";
    }


    function formatStatus(status) {

        const value =
            String(
                status || ""
            ).toUpperCase();

        return value
            .toLowerCase()
            .replace(
                /\b\w/g,
                char =>
                    char.toUpperCase()
            );
    }


    function formatLastLogin(value) {

        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleString(
            "en-MY",
            {
                dateStyle:
                    "medium",

                timeStyle:
                    "short"
            }
        );
    }


    function detectDevice() {

        const ua =
            navigator.userAgent || "";

        let browser =
            "Browser";

        let device =
            "Device";


        if (
            ua.includes("Edg/")
        ) {

            browser =
                "Microsoft Edge";

        } else if (
            ua.includes("Chrome/")
        ) {

            browser =
                "Chrome";

        } else if (
            ua.includes("Safari/")
        ) {

            browser =
                "Safari";

        } else if (
            ua.includes("Firefox/")
        ) {

            browser =
                "Firefox";
        }


        if (
            /iPhone/i.test(ua)
        ) {

            device =
                "iPhone";

        } else if (
            /iPad/i.test(ua)
        ) {

            device =
                "iPad";

        } else if (
            /Android/i.test(ua)
        ) {

            device =
                "Android";

        } else if (
            /Macintosh|Mac OS X/i.test(ua)
        ) {

            device =
                "macOS";

        } else if (
            /Windows/i.test(ua)
        ) {

            device =
                "Windows";

        } else if (
            /Linux/i.test(ua)
        ) {

            device =
                "Linux";
        }


        return `${browser} · ${device}`;
    }


    async function loadAccountInfo() {

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

                throw new Error(
                    "Unable to load account information."
                );
            }


            const user =
                data.user;


            const status =
                document.getElementById(
                    "accountStatus"
                );

            const access =
                document.getElementById(
                    "accessLevel"
                );

            const login =
                document.getElementById(
                    "lastLogin"
                );

            const device =
                document.getElementById(
                    "currentDevice"
                );


            if (status) {

                status.textContent =
                    formatStatus(
                        user.status
                    ) || "—";
            }


            if (access) {

                access.textContent =
                    formatRole(
                        user.role
                    );
            }


            if (login) {

                login.textContent =
                    formatLastLogin(
                        user.lastLoginAt
                    );
            }


            if (device) {

                device.textContent =
                    detectDevice();
            }


        } catch (error) {

            console.error(
                "Profile account info error:",
                error
            );
        }
    }


    loadAccountInfo();

})();
