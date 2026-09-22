(() => {

    const list =
        document.getElementById(
            "profileActivityList"
        );

    if (!list) return;


    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }


    function formatAction(action) {

        return String(
            action || "ACTIVITY"
        )
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(
                /\b\w/g,
                char =>
                    char.toUpperCase()
            );
    }


    function formatTime(value) {

        if (!value) return "";

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
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


    function getIcon(action) {

        const value =
            String(
                action || ""
            ).toUpperCase();

        if (
            value.includes("LOGIN")
        ) {
            return "◆";
        }

        if (
            value.includes("PASSWORD")
        ) {
            return "◇";
        }

        if (
            value.includes("TICKET") ||
            value.includes("ASSIGN")
        ) {
            return "◫";
        }

        if (
            value.includes("PROFILE") ||
            value.includes("USER")
        ) {
            return "♙";
        }

        return "⚙";
    }


    async function loadActivity() {

        try {

            const response =
                await fetch(
                    "/api/auth/activity?limit=5",
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
                    "Unable to load activity."
                );
            }


            const activities =
                Array.isArray(
                    data.activities
                )
                    ? data.activities
                    : [];


            if (!activities.length) {

                list.innerHTML = `
                    <div class="activity-item">
                        <div class="activity-icon">
                            •
                        </div>

                        <div>
                            <strong>
                                No recent activity
                            </strong>

                            <p>
                                Your latest actions will appear here.
                            </p>
                        </div>
                    </div>
                `;

                return;
            }


            list.innerHTML =
                activities
                    .map(
                        activity => {

                            let description =
                                "ResolveDesk activity";


                            if (
                                activity.entityType === "USER" &&
                                activity.entityUserName
                            ) {

                                description =
                                    activity.entityUserEmail
                                        ? `${activity.entityUserName} · ${activity.entityUserEmail}`
                                        : activity.entityUserName;

                            } else if (
                                activity.entityType === "TICKET" &&
                                activity.entityTicketNumber
                            ) {

                                description =
                                    activity.entityTicketSubject
                                        ? `${activity.entityTicketNumber} · ${activity.entityTicketSubject}`
                                        : activity.entityTicketNumber;

                            } else if (
                                activity.entityType
                            ) {

                                description =
                                    activity.entityId
                                        ? `${activity.entityType} #${activity.entityId}`
                                        : activity.entityType;
                            }


                            return `
                                <div class="activity-item">

                                    <div class="activity-icon">
                                        ${escapeHtml(
                                            getIcon(
                                                activity.action
                                            )
                                        )}
                                    </div>

                                    <div>

                                        <strong>
                                            ${escapeHtml(
                                                formatAction(
                                                    activity.action
                                                )
                                            )}
                                        </strong>

                                        <p>
                                            ${escapeHtml(
                                                description
                                            )}
                                            ${
                                                activity.createdAt
                                                    ? ` · ${escapeHtml(
                                                        formatTime(
                                                            activity.createdAt
                                                        )
                                                    )}`
                                                    : ""
                                            }
                                        </p>

                                    </div>

                                </div>
                            `;
                        }
                    )
                    .join("");

        } catch (error) {

            console.error(
                "Profile activity error:",
                error
            );

            list.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        !
                    </div>

                    <div>
                        <strong>
                            Activity unavailable
                        </strong>

                        <p>
                            ${escapeHtml(
                                error.message ||
                                "Unable to load activity."
                            )}
                        </p>
                    </div>
                </div>
            `;
        }
    }


    loadActivity();

})();
