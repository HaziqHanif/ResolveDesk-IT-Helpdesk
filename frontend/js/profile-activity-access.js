(async () => {

    const link =
        document.getElementById(
            "profileActivityViewAll"
        );

    if (!link) return;


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


        const role =
            String(
                data?.user?.role ||
                ""
            ).toUpperCase();


        if (
            !data?.loggedIn ||
            role !== "ADMIN"
        ) {

            link.style.display =
                "none";
        }


    } catch (error) {

        console.error(
            "Activity access check error:",
            error
        );

        link.style.display =
            "none";
    }

})();
