(function () {

    "use strict";

    let toastTimer = null;

    function get(id) {
        return document.getElementById(id);
    }

    async function api(url, options = {}) {

        const response = await fetch(url, {
            credentials: "include",
            cache: "no-store",
            ...options,
            headers: {
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {})
            }
        });

        const data = await response
            .json()
            .catch(() => ({}));

        if (response.status === 401) {
            location.replace("/login.html");
            throw new Error("Login required.");
        }

        if (response.status === 403) {
            location.replace("/dashboard.html");
            throw new Error("Administrator access required.");
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Request failed."
            );
        }

        return data;
    }

    function value(id) {
        return get(id)?.value ?? "";
    }

    function checked(id) {
        return Boolean(
            get(id)?.checked
        );
    }

    function number(id) {
        return Number(
            value(id)
        ) || 0;
    }

    function setValue(
        id,
        newValue
    ) {

        const element = get(id);

        if (
            element &&
            newValue !== undefined &&
            newValue !== null
        ) {
            element.value =
                newValue;
        }
    }

    function setChecked(
        id,
        newValue
    ) {

        const element = get(id);

        if (element) {
            element.checked =
                Boolean(newValue);
        }
    }

    function collect() {

        return {

            organization: {
                name:
                    value("organizationName").trim(),

                supportEmail:
                    value("supportEmail").trim(),

                helpDeskName:
                    value("helpDeskName").trim(),

                timeZone:
                    value("timeZone"),

                portalMessage:
                    value("portalMessage").trim(),

                workingDays:
                    value("workingDays"),

                businessStart:
                    value("businessStart"),

                businessEnd:
                    value("businessEnd"),

                pauseSlaOutsideHours:
                    checked("pauseSlaOutsideHours")
            },

            tickets: {
                prefix:
                    value("ticketPrefix")
                        .trim()
                        .toUpperCase(),

                startingNumber:
                    number("startingTicketNumber"),

                defaultPriority:
                    value("defaultPriority"),

                autoAssignment:
                    checked("autoAssignment"),

                allowReopen:
                    checked("allowReopen"),

                requireResolution:
                    checked("requireResolution"),

                autoClose:
                    checked("autoClose"),

                autoCloseDays:
                    number("autoCloseDays"),

                attachmentLimitMb:
                    number("attachmentLimit")
            },

            sla: {
                critical: {
                    response:
                        number("criticalResponse"),

                    resolution:
                        number("criticalResolution")
                },

                high: {
                    response:
                        number("highResponse"),

                    resolution:
                        number("highResolution")
                },

                medium: {
                    response:
                        number("mediumResponse"),

                    resolution:
                        number("mediumResolution")
                },

                low: {
                    response:
                        number("lowResponse"),

                    resolution:
                        number("lowResolution")
                }
            },

            notifications: {
                newTicket:
                    checked("notifyNewTicket"),

                assignment:
                    checked("notifyAssignment"),

                replies:
                    checked("notifyReplies"),

                sla:
                    checked("notifySla"),

                resolved:
                    checked("notifyResolved")
            },

            security: {
                minimumPasswordLength:
                    number("minimumPasswordLength"),

                sessionTimeout:
                    number("sessionTimeout"),

                uppercaseRequired:
                    checked("uppercaseRequired"),

                numberRequired:
                    checked("numberRequired"),

                loginLock:
                    checked("loginLock"),

                auditAdminChanges:
                    checked("auditAdminChanges")
            },

            system: {
                maintenanceMode:
                    checked("maintenanceMode"),

                registrationEnabled:
                    checked("registrationEnabled"),

                registrationApproval:
                    checked("registrationApproval"),

                kbSuggestions:
                    checked("kbSuggestions")
            }
        };
    }

    function apply(settings) {

        const organization =
            settings.organization || {};

        const tickets =
            settings.tickets || {};

        const sla =
            settings.sla || {};

        const notifications =
            settings.notifications || {};

        const security =
            settings.security || {};

        const system =
            settings.system || {};

        setValue(
            "organizationName",
            organization.name
        );

        setValue(
            "supportEmail",
            organization.supportEmail
        );

        setValue(
            "helpDeskName",
            organization.helpDeskName
        );

        setValue(
            "timeZone",
            organization.timeZone
        );

        setValue(
            "portalMessage",
            organization.portalMessage
        );

        setValue(
            "workingDays",
            organization.workingDays
        );

        setValue(
            "businessStart",
            organization.businessStart
        );

        setValue(
            "businessEnd",
            organization.businessEnd
        );

        setChecked(
            "pauseSlaOutsideHours",
            organization.pauseSlaOutsideHours
        );

        setValue(
            "ticketPrefix",
            tickets.prefix
        );

        setValue(
            "startingTicketNumber",
            tickets.startingNumber
        );

        setValue(
            "defaultPriority",
            tickets.defaultPriority
        );

        setChecked(
            "autoAssignment",
            tickets.autoAssignment
        );

        setChecked(
            "allowReopen",
            tickets.allowReopen
        );

        setChecked(
            "requireResolution",
            tickets.requireResolution
        );

        setChecked(
            "autoClose",
            tickets.autoClose
        );

        setValue(
            "autoCloseDays",
            tickets.autoCloseDays
        );

        setValue(
            "attachmentLimit",
            tickets.attachmentLimitMb
        );

        setValue(
            "criticalResponse",
            sla.critical?.response
        );

        setValue(
            "criticalResolution",
            sla.critical?.resolution
        );

        setValue(
            "highResponse",
            sla.high?.response
        );

        setValue(
            "highResolution",
            sla.high?.resolution
        );

        setValue(
            "mediumResponse",
            sla.medium?.response
        );

        setValue(
            "mediumResolution",
            sla.medium?.resolution
        );

        setValue(
            "lowResponse",
            sla.low?.response
        );

        setValue(
            "lowResolution",
            sla.low?.resolution
        );

        setChecked(
            "notifyNewTicket",
            notifications.newTicket
        );

        setChecked(
            "notifyAssignment",
            notifications.assignment
        );

        setChecked(
            "notifyReplies",
            notifications.replies
        );

        setChecked(
            "notifySla",
            notifications.sla
        );

        setChecked(
            "notifyResolved",
            notifications.resolved
        );

        setValue(
            "minimumPasswordLength",
            security.minimumPasswordLength
        );

        setValue(
            "sessionTimeout",
            security.sessionTimeout
        );

        setChecked(
            "uppercaseRequired",
            security.uppercaseRequired
        );

        setChecked(
            "numberRequired",
            security.numberRequired
        );

        setChecked(
            "loginLock",
            security.loginLock
        );

        setChecked(
            "auditAdminChanges",
            security.auditAdminChanges
        );

        setChecked(
            "maintenanceMode",
            system.maintenanceMode
        );

        setChecked(
            "registrationEnabled",
            system.registrationEnabled
        );

        setChecked(
            "registrationApproval",
            system.registrationApproval
        );

        setChecked(
            "kbSuggestions",
            system.kbSuggestions
        );
    }

    async function loadSettings() {

        localStorage.removeItem(
            "resolvedesk_demo_settings"
        );

        const data =
            await api(
                "/api/settings"
            );

        apply(
            data.settings || {}
        );

        console.log(
            "✅ Settings loaded from PostgreSQL:",
            data.settings
        );
    }

    get("saveAllButton")
        ?.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                event.stopImmediatePropagation();

                const settings =
                    collect();

                if (
                    !settings.organization.name
                ) {
                    showToast(
                        "Organization name is required."
                    );
                    return;
                }

                if (
                    !settings.organization.supportEmail
                ) {
                    showToast(
                        "Support email is required."
                    );
                    return;
                }

                try {

                    const data =
                        await api(
                            "/api/settings",
                            {
                                method: "PUT",

                                body:
                                    JSON.stringify(
                                        settings
                                    )
                            }
                        );

                    apply(
                        data.settings || settings
                    );

                    localStorage.removeItem(
                        "resolvedesk_demo_settings"
                    );

                    showToast(
                        "Settings saved to PostgreSQL."
                    );

                    console.log(
                        "✅ Settings saved:",
                        data
                    );

                } catch (error) {

                    console.error(
                        "❌ Settings save:",
                        error
                    );

                    showToast(
                        error.message
                    );
                }

            },
            true
        );

    get("confirmReset")
        ?.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                event.stopImmediatePropagation();

                try {

                    const data =
                        await api(
                            "/api/settings/reset",
                            {
                                method: "POST"
                            }
                        );

                    apply(
                        data.settings || {}
                    );

                    localStorage.removeItem(
                        "resolvedesk_demo_settings"
                    );

                    get("resetModal")
                        ?.classList
                        .remove("open");

                    document.body.style.overflow =
                        "";

                    showToast(
                        "Settings restored to defaults."
                    );

                } catch (error) {

                    showToast(
                        error.message
                    );
                }

            },
            true
        );

    get("testNotification")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopImmediatePropagation();

                showToast(
                    "Email provider is not configured yet."
                );

            },
            true
        );

    function showToast(
        message
    ) {

        const toast =
            get("toast");

        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent =
            message;

        toast.classList.add(
            "show"
        );

        clearTimeout(
            toastTimer
        );

        toastTimer =
            setTimeout(
                () => {
                    toast.classList
                        .remove("show");
                },
                2500
            );
    }

    loadSettings()
        .catch(
            error => {

                console.error(
                    "❌ Settings load:",
                    error
                );

                showToast(
                    error.message
                );
            }
        );

})();
