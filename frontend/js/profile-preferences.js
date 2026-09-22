(() => {

    const ids = [
        "assignmentAlerts",
        "slaAlerts",
        "emailAlerts",
        "dailySummary"
    ];


    function elements() {

        return ids
            .map(id =>
                document.getElementById(id)
            )
            .filter(Boolean);
    }


    function collect() {

        return {
            assignmentAlerts:
                document.getElementById(
                    "assignmentAlerts"
                )?.checked ?? true,

            slaAlerts:
                document.getElementById(
                    "slaAlerts"
                )?.checked ?? true,

            emailAlerts:
                document.getElementById(
                    "emailAlerts"
                )?.checked ?? true,

            dailySummary:
                document.getElementById(
                    "dailySummary"
                )?.checked ?? false
        };
    }


    function apply(preferences = {}) {

        ids.forEach(id => {

            const input =
                document.getElementById(id);

            if (
                input &&
                typeof preferences[id] ===
                    "boolean"
            ) {

                input.checked =
                    preferences[id];
            }
        });
    }


    function disable(value) {

        elements().forEach(
            input => {
                input.disabled = value;
            }
        );
    }


    async function loadPreferences() {

        try {

            const response =
                await fetch(
                    "/api/auth/preferences",
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
                    "Unable to load preferences."
                );
            }


            apply(
                data.preferences
            );

        } catch (error) {

            console.error(
                "Preference load error:",
                error
            );
        }
    }


    async function savePreferences(
        previous
    ) {

        disable(true);

        try {

            const response =
                await fetch(
                    "/api/auth/preferences",
                    {
                        method:
                            "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials:
                            "include",

                        body:
                            JSON.stringify(
                                collect()
                            )
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
                    "Unable to save preferences."
                );
            }


            apply(
                data.preferences
            );


            if (
                typeof showToast ===
                    "function"
            ) {

                showToast(
                    "Preferences saved."
                );
            }

        } catch (error) {

            console.error(
                "Preference save error:",
                error
            );

            apply(previous);

            if (
                typeof showToast ===
                    "function"
            ) {

                showToast(
                    error.message ||
                    "Unable to save preferences."
                );
            }

        } finally {

            disable(false);
        }
    }


    let current =
        collect();


    elements().forEach(
        input => {

            input.addEventListener(
                "change",
                async () => {

                    const previous = {
                        ...current
                    };

                    current =
                        collect();

                    await savePreferences(
                        previous
                    );

                    current =
                        collect();
                }
            );
        }
    );


    loadPreferences()
        .then(() => {
            current =
                collect();
        });

})();
