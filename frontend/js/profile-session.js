(() => {

    function formatRole(role) {

        const value =
            String(role || "")
                .trim()
                .toUpperCase();

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


    function initials(name) {

        return String(name || "User")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join("")
            .toUpperCase();
    }


    function setText(id, value) {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value || "-";
        }
    }


    function setValue(id, value) {

        const element =
            document.getElementById(id);

        if (element) {
            element.value =
                value || "";
        }
    }


    async function loadSessionProfile() {

        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials: "include",
                        cache: "no-store",
                        headers: {
                            Accept: "application/json"
                        }
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.loggedIn ||
                !data.user
            ) {

                window.location.replace(
                    "/login.html"
                );

                return;
            }


            const user =
                data.user;


            const name =
                user.fullName ||
                user.full_name ||
                user.name ||
                user.email ||
                "ResolveDesk User";


            const role =
                formatRole(
                    user.role
                );


            const department =
                user.department ||
                user.departmentName ||
                user.department_name ||
                "Not assigned";


            localStorage.removeItem(
                "resolvedesk_demo_profile"
            );


            if (
                typeof profile !==
                "undefined"
            ) {

                profile = {
                    ...profile,

                    fullName:
                        name,

                    email:
                        user.email || "",

                    phone:
                        user.phone || "",

                    department:
                        department,

                    jobTitle:
                        user.jobTitle ||
                        user.job_title ||
                        role,

                    bio:
                        user.bio || "",

                    profilePhoto:
                        user.profilePhoto ||
                        user.profile_photo ||
                        null
                };


                if (
                    typeof renderProfile ===
                    "function"
                ) {

                    renderProfile();
                }
            }


            setText(
                "sidebarName",
                name
            );

            setText(
                "sidebarRole",
                role
            );

            setText(
                "topName",
                name
            );

            setText(
                "topRole",
                role
            );

            setText(
                "heroName",
                name
            );

            setText(
                "heroEmail",
                user.email || "-"
            );

            setText(
                "heroRole",
                role
            );

            setText(
                "heroDepartment",
                department
            );

            setText(
                "heroAccountType",
                `${role} Account`
            );


            setValue(
                "fullName",
                name
            );

            setValue(
                "email",
                user.email
            );

            setValue(
                "department",
                department
            );

            setValue(
                "jobTitle",
                user.jobTitle ||
                user.job_title ||
                role
            );

            setValue(
                "roleField",
                role
            );


            const avatarText =
                initials(name);


            [
                "sidebarAvatar",
                "topAvatar",
                "heroAvatar"
            ].forEach(id => {

                const element =
                    document.getElementById(id);

                if (
                    element &&
                    !profile?.profilePhoto
                ) {

                    element.textContent =
                        avatarText;
                }
            });


            console.log(
                "✅ PROFILE SESSION:",
                {
                    id:
                        user.id,
                    name,
                    email:
                        user.email,
                    role:
                        user.role,
                    department
                }
            );


        } catch (error) {

            console.error(
                "Unable to load profile session:",
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
            loadSessionProfile
        );

    } else {

        loadSessionProfile();
    }

})();

/* =========================================================
   FORCE CURRENT ROLE INTO PROFILE HEADER
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    try {

        const response =
            await fetch("/api/auth/me", {
                credentials: "include",
                cache: "no-store"
            });

        const data =
            await response.json();

        if (!data.loggedIn || !data.user) {
            return;
        }

        const rawRole =
            String(data.user.role || "")
                .toUpperCase();

        const role =
            rawRole === "ADMIN"
                ? "Administrator"
                : rawRole === "TECHNICIAN"
                    ? "Technician"
                    : "Staff";


        const selectors = [
            ".top-profile-copy span",
            ".account-card span",
            "#topRole",
            "#sidebarRole",
            "#heroRole",
            "#roleField"
        ];


        selectors.forEach(selector => {

            document
                .querySelectorAll(selector)
                .forEach(element => {

                    if (
                        element.tagName ===
                        "INPUT"
                    ) {

                        element.value =
                            role;

                    } else {

                        element.textContent =
                            role;
                    }
                });
        });


        const accountType =
            document.getElementById(
                "heroAccountType"
            );

        if (accountType) {

            accountType.textContent =
                `${role} Account`;
        }

    } catch (error) {

        console.error(
            "Role header update failed:",
            error
        );
    }

});

document.addEventListener("DOMContentLoaded", async () => {

    try {

        const response =
            await fetch("/api/auth/me", {
                credentials: "include",
                cache: "no-store"
            });

        const data =
            await response.json();

        if (!data.loggedIn || !data.user) {
            return;
        }

        const rawRole =
            String(data.user.role || "")
                .toUpperCase();

        const role =
            rawRole === "ADMIN"
                ? "Administrator"
                : rawRole === "TECHNICIAN"
                    ? "Technician"
                    : "Staff";

        const accessLevel =
            document.getElementById(
                "accessLevel"
            );

        if (accessLevel) {
            accessLevel.textContent =
                role;
        }

    } catch (error) {

        console.error(
            "Access level update failed:",
            error
        );
    }

});
