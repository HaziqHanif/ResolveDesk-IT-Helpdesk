const {
    query
} =
    require("../db");


const DEFAULT_SETTINGS = {

    system: {
        maintenanceMode: false,
        registrationEnabled: true,
        registrationApproval: true,
        kbSuggestions: true
    },

    tickets: {
        prefix: "RD",
        startingNumber: 1000,
        defaultPriority: "MEDIUM",
        autoAssignment: true,
        allowReopen: true,
        requireResolution: true,
        autoClose: true,
        autoCloseDays: 3,
        attachmentLimitMb: 10
    },

    security: {
        minimumPasswordLength: 8,
        sessionTimeout: 60,
        uppercaseRequired: true,
        numberRequired: true,
        loginLock: true,
        auditAdminChanges: true
    },

    notifications: {
        newTicket: true,
        assignment: true,
        replies: true,
        sla: true,
        resolved: true
    },

    organization: {
        name: "ResolveDesk",
        supportEmail:
            process.env.SUPPORT_EMAIL ||
            "support@resolvedesk.local",
        helpDeskName: "ResolveDesk IT Support",
        timeZone: "Asia/Kuala_Lumpur",
        portalMessage: "",
        workingDays: "Monday – Friday",
        businessStart: "08:00",
        businessEnd: "17:00",
        pauseSlaOutsideHours: true
    }

};


function mergeSettings(
    stored = {}
) {

    return {

        system: {
            ...DEFAULT_SETTINGS.system,
            ...(stored.system || {})
        },

        tickets: {
            ...DEFAULT_SETTINGS.tickets,
            ...(stored.tickets || {})
        },

        security: {
            ...DEFAULT_SETTINGS.security,
            ...(stored.security || {})
        },

        notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(stored.notifications || {})
        },

        organization: {
            ...DEFAULT_SETTINGS.organization,
            ...(stored.organization || {})
        }

    };
}


async function getRuntimeSettings() {

    const result =
        await query(`
            SELECT
                setting_value

            FROM app_settings

            WHERE
                setting_key =
                    'resolvedesk.configuration'

            LIMIT 1
        `);


    if (
        result.rowCount ===
        0
    ) {

        return mergeSettings();
    }


    return mergeSettings(
        result.rows[0]
            .setting_value ||
        {}
    );
}


module.exports = {

    getRuntimeSettings,
    DEFAULT_SETTINGS

};
