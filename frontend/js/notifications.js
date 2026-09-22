(() => {

    const state = {
        notifications: [],
        unreadCount: 0,
        loading: false
    };


    function getElements() {

        return {
            center:
                document.getElementById(
                    "notificationCenter"
                ),

            bell:
                document.getElementById(
                    "notificationBell"
                ),

            badge:
                document.getElementById(
                    "notificationBadge"
                ),

            panel:
                document.getElementById(
                    "notificationPanel"
                ),

            list:
                document.getElementById(
                    "notificationList"
                ),

            summary:
                document.getElementById(
                    "notificationSummary"
                ),

            readAll:
                document.getElementById(
                    "notificationReadAll"
                )
        };
    }


    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    function formatTime(value) {

        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        ).format(date);
    }


    function isRead(notification) {

        return Boolean(
            notification.read_at ??
            notification.readAt
        );
    }


    function render() {

        const elements =
            getElements();

        if (
            !elements.center ||
            !elements.badge ||
            !elements.list
        ) {
            return;
        }


        if (
            state.unreadCount > 0
        ) {

            elements.badge.hidden =
                false;

            elements.badge.textContent =
                state.unreadCount > 99
                    ? "99+"
                    : String(
                        state.unreadCount
                    );

        } else {

            elements.badge.hidden =
                true;

            elements.badge.textContent =
                "0";
        }


        if (elements.summary) {

            elements.summary.textContent =
                state.unreadCount > 0
                    ? `${state.unreadCount} unread`
                    : "You're all caught up";
        }


        if (elements.readAll) {

            elements.readAll.disabled =
                state.unreadCount === 0;
        }


        if (
            !state.notifications.length
        ) {

            elements.list.innerHTML = `
                <div class="notification-empty">
                    No notifications yet.
                </div>
            `;

            return;
        }


        elements.list.innerHTML =
            state.notifications
                .map(notification => {

                    const unread =
                        !isRead(
                            notification
                        );

                    const id =
                        Number(
                            notification.id
                        );

                    const title =
                        escapeHtml(
                            notification.title ||
                            "Notification"
                        );

                    const body =
                        escapeHtml(
                            notification.body ||
                            ""
                        );

                    const time =
                        escapeHtml(
                            formatTime(
                                notification.created_at ??
                                notification.createdAt
                            )
                        );

                    return `
                        <button
                            type="button"
                            class="
                                notification-item
                                ${unread ? "unread" : ""}
                            "
                            data-notification-id="${id}"
                        >
                            <span
                                class="notification-status"
                            ></span>

                            <span
                                class="notification-copy"
                            >
                                <span
                                    class="notification-title"
                                >
                                    ${title}
                                </span>

                                ${
                                    body
                                        ? `
                                            <span
                                                class="notification-body"
                                            >
                                                ${body}
                                            </span>
                                        `
                                        : ""
                                }

                                <span
                                    class="notification-time"
                                >
                                    ${time}
                                </span>
                            </span>
                        </button>
                    `;
                })
                .join("");
    }


    async function request(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "include",

                    ...options,

                    headers: {
                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),

                        ...(options.headers || {})
                    }
                }
            );


        let data = {};

        try {

            data =
                await response.json();

        } catch {

            data = {};
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Notification request failed."
            );
        }


        return data;
    }


    async function loadNotifications() {

        if (state.loading) {
            return;
        }

        state.loading =
            true;

        try {

            const data =
                await request(
                    "/api/notifications"
                );

            state.notifications =
                Array.isArray(
                    data.notifications
                )
                    ? data.notifications
                    : [];

            state.unreadCount =
                Number(
                    data.unreadCount
                ) || 0;

            render();

        } catch (error) {

            console.error(
                "Unable to load notifications:",
                error
            );

        } finally {

            state.loading =
                false;
        }
    }


    async function markRead(
        notification
    ) {

        if (
            !notification ||
            isRead(notification)
        ) {
            return;
        }


        await request(
            `/api/notifications/${notification.id}/read`,
            {
                method: "PATCH"
            }
        );


        notification.read_at =
            new Date().toISOString();

        state.unreadCount =
            Math.max(
                0,
                state.unreadCount - 1
            );

        render();
    }


    async function markAllRead() {

        if (
            state.unreadCount === 0
        ) {
            return;
        }


        await request(
            "/api/notifications/read-all",
            {
                method: "PATCH"
            }
        );


        const now =
            new Date().toISOString();


        state.notifications
            .forEach(notification => {

                if (
                    !isRead(
                        notification
                    )
                ) {

                    notification.read_at =
                        now;
                }
            });


        state.unreadCount =
            0;

        render();
    }


    function togglePanel() {

        const elements =
            getElements();

        if (
            !elements.panel ||
            !elements.bell
        ) {
            return;
        }


        const willOpen =
            elements.panel.hidden;


        elements.panel.hidden =
            !willOpen;


        elements.bell.setAttribute(
            "aria-expanded",
            String(willOpen)
        );


        if (willOpen) {

            loadNotifications();
        }
    }


    async function handleNotificationClick(
        event
    ) {

        const item =
            event.target.closest(
                "[data-notification-id]"
            );

        if (!item) {
            return;
        }


        const id =
            Number(
                item.dataset.notificationId
            );


        const notification =
            state.notifications.find(
                entry =>
                    Number(entry.id) === id
            );


        if (!notification) {
            return;
        }


        try {

            await markRead(
                notification
            );

        } catch (error) {

            console.error(
                "Unable to mark notification as read:",
                error
            );
        }


        const link =
            notification.link;


        if (
            typeof link === "string" &&
            link.startsWith("/")
        ) {

            window.location.href =
                link;
        }
    }


    function initialize() {

        const elements =
            getElements();


        if (
            !elements.center ||
            !elements.bell ||
            !elements.panel
        ) {

            return;
        }


        elements.bell
            .addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    togglePanel();
                }
            );


        elements.panel
            .addEventListener(
                "click",
                event => {

                    event.stopPropagation();
                }
            );


        elements.list
            ?.addEventListener(
                "click",
                handleNotificationClick
            );


        elements.readAll
            ?.addEventListener(
                "click",
                async () => {

                    try {

                        await markAllRead();

                    } catch (error) {

                        console.error(
                            "Unable to mark all notifications as read:",
                            error
                        );
                    }
                }
            );


        document.addEventListener(
            "click",
            () => {

                elements.panel.hidden =
                    true;

                elements.bell
                    .setAttribute(
                        "aria-expanded",
                        "false"
                    );
            }
        );


        loadNotifications();


        window.setInterval(
            loadNotifications,
            30000
        );
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

})();