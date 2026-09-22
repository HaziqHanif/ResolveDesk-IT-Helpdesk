(() => {

    const labels = [
        document.getElementById("profileStat1Label"),
        document.getElementById("profileStat2Label"),
        document.getElementById("profileStat3Label"),
        document.getElementById("profileStat4Label")
    ];

    const values = [
        document.getElementById("profileStat1Value"),
        document.getElementById("profileStat2Value"),
        document.getElementById("profileStat3Value"),
        document.getElementById("profileStat4Value")
    ];

    const descriptions = [
        document.getElementById("profileStat1Description"),
        document.getElementById("profileStat2Description"),
        document.getElementById("profileStat3Description"),
        document.getElementById("profileStat4Description")
    ];


    function render(stats) {

        stats.slice(0, 4).forEach(
            (stat, index) => {

                if (labels[index]) {
                    labels[index].textContent =
                        stat.label ?? "—";
                }

                if (values[index]) {
                    values[index].textContent =
                        stat.value ?? "—";
                }

                if (descriptions[index]) {
                    descriptions[index].textContent =
                        stat.description ?? "";
                }
            }
        );
    }


    async function load() {

        try {

            const response =
                await fetch(
                    "/api/auth/profile-stats",
                    {
                        credentials:
                            "include"
                    }
                );

            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load profile stats."
                );
            }


            render(
                Array.isArray(data.stats)
                    ? data.stats
                    : []
            );


        } catch (error) {

            console.error(
                "Profile stats error:",
                error
            );
        }
    }


    load();

})();
