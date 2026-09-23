const express =
    require("express");


const {
    query
} =
    require("../db");


const {
    requireAuth
} =
    require("../middleware/auth");


const {
    requireAdmin
} =
    require("../middleware/roles");


const {
    writeAudit
} =
    require("../utils/audit");


const router =
    express.Router();


/* =========================================================
   SECURITY
========================================================= */


/* PUBLIC BRANDING */
router.get(
    "/branding",
    async (req, res, next) => {

        try {

            const config =
                await readConfiguration();

            const organization =
                config.organization || {};

            return res.json({
                success: true,

                branding: {
                    organizationName:
                        String(
                            organization.name ||
                            "ResolveDesk"
                        ),

                    helpDeskName:
                        String(
                            organization.helpDeskName ||
                            "ResolveDesk IT Support"
                        )
                }
            });

        } catch (error) {

            next(error);
        }
    }
);

router.use(
    requireAuth,
    requireAdmin
);


/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULT_CONFIG = {

    organization: {

        name:
            "ResolveDesk",

        supportEmail:
            process.env.SUPPORT_EMAIL ||
            "support@resolvedesk.local",

        helpDeskName:
            "ResolveDesk IT Support",

        timeZone:
            "Asia/Kuala_Lumpur",

        portalMessage:
            "Need help? Submit a support request and our IT team will assist you as soon as possible.",

        workingDays:
            "Monday – Friday",

        businessStart:
            "08:00",

        businessEnd:
            "17:00",

        pauseSlaOutsideHours:
            true

    },


    tickets: {

        prefix:
            "RD",

        startingNumber:
            1000,

        defaultPriority:
            "MEDIUM",

        autoAssignment:
            true,

        allowReopen:
            true,

        requireResolution:
            true,

        autoClose:
            true,

        autoCloseDays:
            3,

        attachmentLimitMb:
            10

    },


    notifications: {

        newTicket:
            true,

        assignment:
            true,

        replies:
            true,

        sla:
            true,

        resolved:
            true

    },


    security: {

        minimumPasswordLength:
            10,

        sessionTimeout:
            60,

        uppercaseRequired:
            true,

        numberRequired:
            true,

        loginLock:
            true,

        auditAdminChanges:
            true

    },


    system: {

        maintenanceMode:
            false,

        registrationEnabled:
            true,

        registrationApproval:
            true,

        kbSuggestions:
            true

    }

};


const DEFAULT_SLA = {

    CRITICAL: {
        response: 15,
        resolution: 60
    },

    HIGH: {
        response: 30,
        resolution: 240
    },

    MEDIUM: {
        response: 120,
        resolution: 480
    },

    LOW: {
        response: 240,
        resolution: 1440
    }

};


/* =========================================================
   HELPERS
========================================================= */

function cloneDefaults() {

    return JSON.parse(
        JSON.stringify(
            DEFAULT_CONFIG
        )
    );
}


function mergeConfig(
    stored = {}
) {

    const defaults =
        cloneDefaults();


    return {

        organization: {
            ...defaults.organization,
            ...(stored.organization || {})
        },

        tickets: {
            ...defaults.tickets,
            ...(stored.tickets || {})
        },

        notifications: {
            ...defaults.notifications,
            ...(stored.notifications || {})
        },

        security: {
            ...defaults.security,
            ...(stored.security || {})
        },

        system: {
            ...defaults.system,
            ...(stored.system || {})
        }

    };
}


function integer(
    value,
    fallback
) {

    const parsed =
        Number(
            value
        );


    if (
        !Number.isFinite(
            parsed
        )
    ) {

        return fallback;
    }


    return Math.round(
        parsed
    );
}


function boolean(
    value,
    fallback = false
) {

    return typeof value ===
        "boolean"
        ? value
        : fallback;
}


function clean(
    value,
    fallback = ""
) {

    const text =
        String(
            value ??
            ""
        ).trim();


    return text ||
        fallback;
}


function sanitizeConfig(
    body = {}
) {

    const organization =
        body.organization ||
        {};


    const tickets =
        body.tickets ||
        {};


    const notifications =
        body.notifications ||
        {};


    const security =
        body.security ||
        {};


    const system =
        body.system ||
        {};


    const prefix =
        clean(
            tickets.prefix,
            "RD"
        )
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ""
            )
            .slice(
                0,
                6
            );


    return {

        organization: {

            name:
                clean(
                    organization.name,
                    "ResolveDesk"
                ),

            supportEmail:
                clean(
                    organization.supportEmail
                ),

            helpDeskName:
                clean(
                    organization.helpDeskName,
                    "ResolveDesk IT Support"
                ),

            timeZone:
                clean(
                    organization.timeZone,
                    "Asia/Kuala_Lumpur"
                ),

            portalMessage:
                clean(
                    organization.portalMessage
                ),

            workingDays:
                clean(
                    organization.workingDays,
                    "Monday – Friday"
                ),

            businessStart:
                clean(
                    organization.businessStart,
                    "08:00"
                ),

            businessEnd:
                clean(
                    organization.businessEnd,
                    "17:00"
                ),

            pauseSlaOutsideHours:
                boolean(
                    organization.pauseSlaOutsideHours,
                    true
                )

        },


        tickets: {

            prefix:
                prefix ||
                "RD",

            startingNumber:
                Math.max(
                    1,
                    integer(
                        tickets.startingNumber,
                        1000
                    )
                ),

            defaultPriority:
                [
                    "LOW",
                    "MEDIUM",
                    "HIGH",
                    "CRITICAL"
                ].includes(
                    String(
                        tickets.defaultPriority
                    ).toUpperCase()
                )
                    ? String(
                        tickets.defaultPriority
                    ).toUpperCase()
                    : "MEDIUM",

            autoAssignment:
                boolean(
                    tickets.autoAssignment,
                    true
                ),

            allowReopen:
                boolean(
                    tickets.allowReopen,
                    true
                ),

            requireResolution:
                boolean(
                    tickets.requireResolution,
                    true
                ),

            autoClose:
                boolean(
                    tickets.autoClose,
                    true
                ),

            autoCloseDays:
                Math.max(
                    1,
                    integer(
                        tickets.autoCloseDays,
                        3
                    )
                ),

            attachmentLimitMb:
                Math.max(
                    1,
                    integer(
                        tickets.attachmentLimitMb,
                        10
                    )
                )

        },


        notifications: {

            newTicket:
                boolean(
                    notifications.newTicket,
                    true
                ),

            assignment:
                boolean(
                    notifications.assignment,
                    true
                ),

            replies:
                boolean(
                    notifications.replies,
                    true
                ),

            sla:
                boolean(
                    notifications.sla,
                    true
                ),

            resolved:
                boolean(
                    notifications.resolved,
                    true
                )

        },


        security: {

            minimumPasswordLength:
                Math.max(
                    8,
                    integer(
                        security.minimumPasswordLength,
                        10
                    )
                ),

            sessionTimeout:
                Math.max(
                    30,
                    integer(
                        security.sessionTimeout,
                        60
                    )
                ),

            uppercaseRequired:
                boolean(
                    security.uppercaseRequired,
                    true
                ),

            numberRequired:
                boolean(
                    security.numberRequired,
                    true
                ),

            loginLock:
                boolean(
                    security.loginLock,
                    true
                ),

            auditAdminChanges:
                boolean(
                    security.auditAdminChanges,
                    true
                )

        },


        system: {

            maintenanceMode:
                boolean(
                    system.maintenanceMode
                ),

            registrationEnabled:
                boolean(
                    system.registrationEnabled,
                    true
                ),

            registrationApproval:
                boolean(
                    system.registrationApproval,
                    true
                ),

            kbSuggestions:
                boolean(
                    system.kbSuggestions,
                    true
                )

        }

    };
}


function sanitizeSla(
    body = {}
) {

    const result =
        {};


    for (
        const priority of
        [
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW"
        ]
    ) {

        const source =
            body[
                priority.toLowerCase()
            ] ||
            {};


        result[priority] = {

            response:
                Math.max(
                    1,
                    integer(
                        source.response,
                        DEFAULT_SLA[
                            priority
                        ].response
                    )
                ),

            resolution:
                Math.max(
                    1,
                    integer(
                        source.resolution,
                        DEFAULT_SLA[
                            priority
                        ].resolution
                    )
                )

        };
    }


    return result;
}


/* =========================================================
   READ CONFIG
========================================================= */

async function readConfiguration() {

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

        return cloneDefaults();
    }


    return mergeConfig(
        result.rows[0]
            .setting_value ||
        {}
    );
}


async function readSlaPolicies() {

    const result =
        await query(`
            SELECT

                priority,
                first_response_minutes,
                resolution_minutes

            FROM sla_policies

            WHERE
                is_active = TRUE

            ORDER BY

                CASE priority
                    WHEN 'CRITICAL'
                        THEN 1
                    WHEN 'HIGH'
                        THEN 2
                    WHEN 'MEDIUM'
                        THEN 3
                    ELSE 4
                END
        `);


    const policies =
        JSON.parse(
            JSON.stringify(
                DEFAULT_SLA
            )
        );


    result.rows.forEach(
        row => {

            if (
                !policies[
                    row.priority
                ]
            ) {

                return;
            }


            policies[
                row.priority
            ] = {

                response:
                    Number(
                        row.first_response_minutes
                    ),

                resolution:
                    Number(
                        row.resolution_minutes
                    )

            };
        }
    );


    return {

        critical:
            policies.CRITICAL,

        high:
            policies.HIGH,

        medium:
            policies.MEDIUM,

        low:
            policies.LOW

    };
}


/* =========================================================
   GET SETTINGS

   GET /api/settings
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const [
                config,
                sla
            ] =
                await Promise.all([

                    readConfiguration(),

                    readSlaPolicies()

                ]);


            return res.json({

                success:
                    true,

                settings: {
                    ...config,
                    sla
                }

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


/* =========================================================
   SAVE SETTINGS

   PUT /api/settings
========================================================= */

router.put(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const config =
                sanitizeConfig(
                    req.body
                );


            const sla =
                sanitizeSla(
                    req.body?.sla
                );


            if (
                !config.organization
                    .supportEmail
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Support email is required."

                    });
            }


            await query(
                `
                    INSERT INTO app_settings (

                        setting_key,
                        setting_value,
                        description,
                        updated_by

                    )

                    VALUES (

                        'resolvedesk.configuration',
                        $1::JSONB,
                        'ResolveDesk administrator configuration',
                        $2

                    )

                    ON CONFLICT (
                        setting_key
                    )

                    DO UPDATE SET

                        setting_value =
                            EXCLUDED.setting_value,

                        description =
                            EXCLUDED.description,

                        updated_by =
                            EXCLUDED.updated_by
                `,
                [
                    JSON.stringify(
                        config
                    ),

                    req.user.id
                ]
            );


            for (
                const priority of
                [
                    "CRITICAL",
                    "HIGH",
                    "MEDIUM",
                    "LOW"
                ]
            ) {

                await query(
                    `
                        UPDATE sla_policies

                        SET
                            first_response_minutes = $1,
                            resolution_minutes = $2,
                            business_hours_only = $3

                        WHERE
                            priority = $4
                            AND
                            is_active = TRUE
                    `,
                    [

                        sla[
                            priority
                        ].response,

                        sla[
                            priority
                        ].resolution,

                        config
                            .organization
                            .pauseSlaOutsideHours,

                        priority

                    ]
                );
            }


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "SYSTEM_SETTINGS_UPDATED",

                entityType:
                    "APP_SETTINGS",

                entityId:
                    "resolvedesk.configuration",

                severity:
                    "INFO",

                metadata: {

                    ticketPrefix:
                        config
                            .tickets
                            .prefix,

                    defaultPriority:
                        config
                            .tickets
                            .defaultPriority,

                    maintenanceMode:
                        config
                            .system
                            .maintenanceMode,

                    sla

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "ResolveDesk settings saved.",

                settings: {
                    ...config,

                    sla: {

                        critical:
                            sla.CRITICAL,

                        high:
                            sla.HIGH,

                        medium:
                            sla.MEDIUM,

                        low:
                            sla.LOW

                    }
                }

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


/* =========================================================
   RESET CONFIGURATION

   POST /api/settings/reset
========================================================= */

router.post(
    "/reset",
    async (
        req,
        res,
        next
    ) => {

        try {

            const config =
                cloneDefaults();


            await query(
                `
                    INSERT INTO app_settings (

                        setting_key,
                        setting_value,
                        description,
                        updated_by

                    )

                    VALUES (

                        'resolvedesk.configuration',
                        $1::JSONB,
                        'ResolveDesk administrator configuration',
                        $2

                    )

                    ON CONFLICT (
                        setting_key
                    )

                    DO UPDATE SET

                        setting_value =
                            EXCLUDED.setting_value,

                        description =
                            EXCLUDED.description,

                        updated_by =
                            EXCLUDED.updated_by
                `,
                [
                    JSON.stringify(
                        config
                    ),

                    req.user.id
                ]
            );


            for (
                const priority of
                Object.keys(
                    DEFAULT_SLA
                )
            ) {

                await query(
                    `
                        UPDATE sla_policies

                        SET
                            first_response_minutes = $1,
                            resolution_minutes = $2,
                            business_hours_only = $3

                        WHERE
                            priority = $4
                            AND
                            is_active = TRUE
                    `,
                    [

                        DEFAULT_SLA[
                            priority
                        ].response,

                        DEFAULT_SLA[
                            priority
                        ].resolution,

                        config
                            .organization
                            .pauseSlaOutsideHours,

                        priority

                    ]
                );
            }


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "SYSTEM_SETTINGS_RESET",

                entityType:
                    "APP_SETTINGS",

                entityId:
                    "resolvedesk.configuration",

                severity:
                    "WARNING",

                metadata: {

                    restoredDefaults:
                        true

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Settings restored to defaults.",

                settings: {

                    ...config,

                    sla: {

                        critical:
                            DEFAULT_SLA
                                .CRITICAL,

                        high:
                            DEFAULT_SLA
                                .HIGH,

                        medium:
                            DEFAULT_SLA
                                .MEDIUM,

                        low:
                            DEFAULT_SLA
                                .LOW

                    }

                }

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


module.exports =
    router;