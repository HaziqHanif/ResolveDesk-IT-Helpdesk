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


const router =
    express.Router();


/* =========================================================
   AUTH
========================================================= */

router.use(
    requireAuth
);


/* =========================================================
   ADMIN ONLY
========================================================= */

router.use(
    (
        req,
        res,
        next
    ) => {

        if (
            req.user?.role !==
            "ADMIN"
        ) {

            return res
                .status(403)
                .json({

                    success:
                        false,

                    code:
                        "ADMIN_REQUIRED",

                    message:
                        "Administrator access required."

                });
        }


        next();
    }
);


/* =========================================================
   EVENT TYPE
========================================================= */

function getEventType(
    row
) {

    const action =
        String(
            row.action ||
            ""
        ).toUpperCase();


    const entity =
        String(
            row.entity_type ||
            ""
        ).toUpperCase();


    /* SLA first */

    if (
        action.includes(
            "SLA"
        ) ||
        entity.includes(
            "SLA"
        )
    ) {

        return "sla";
    }


    /* Authentication / Security */

    if (
        action.includes(
            "LOGIN"
        ) ||
        action.includes(
            "LOGOUT"
        ) ||
        action.includes(
            "AUTH"
        ) ||
        action.includes(
            "PASSWORD"
        ) ||
        action.includes(
            "SESSION"
        ) ||
        action.includes(
            "SECURITY"
        )
    ) {

        return "auth";
    }


    /* User Management */

    if (
        entity ===
            "USER" ||
        entity ===
            "ADMIN" ||
        entity ===
            "TECHNICIAN" ||
        action.includes(
            "USER_"
        ) ||
        action.includes(
            "ADMIN_"
        ) ||
        action.includes(
            "APPROVE"
        ) ||
        action.includes(
            "REJECT"
        )
    ) {

        return "user";
    }


    /* Ticket */

    if (
        entity ===
            "TICKET" ||
        action.includes(
            "TICKET"
        ) ||
        action.includes(
            "ATTACHMENT"
        ) ||
        action.includes(
            "COMMENT"
        ) ||
        action.includes(
            "ASSIGN"
        ) ||
        action.includes(
            "PRIORITY"
        ) ||
        action.includes(
            "STATUS"
        )
    ) {

        return "ticket";
    }


    return "system";
}


/* =========================================================
   FORMAT LOG
========================================================= */

function formatLog(
    row
) {

    return {

        id:
            row.id,

        actorId:
            row.actor_id,

        actor:
            row.actor_name ||
            "ResolveDesk System",

        actorEmail:
            row.actor_email ||
            null,

        role:
            row.actor_role ||
            "SYSTEM",

        action:
            row.action,

        type:
            getEventType(
                row
            ),

        entityType:
            row.entity_type,

        entityId:
            row.entity_id,

        severity:
            row.severity,

        metadata:
            row.metadata ||
            {},

        ip:
            row.ip_address,

        userAgent:
            row.user_agent,

        createdAt:
            row.created_at

    };
}


/* =========================================================
   GET AUDIT LOGS

   GET /api/audit-logs

   ADMIN ONLY
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            let limit =
                Number(
                    req.query.limit
                ) ||
                2000;


            limit =
                Math.max(
                    1,
                    Math.min(
                        limit,
                        5000
                    )
                );


            /*
                to_jsonb(u) allows us to safely
                support either:

                users.name
                users.full_name

                without depending on one exact
                user-name column.
            */

            const result =
                await query(
                    `
                        SELECT
                            a.id,
                            a.actor_id,
                            a.action,
                            a.entity_type,
                            a.entity_id,
                            a.severity,
                            a.metadata,
                            a.ip_address,
                            a.user_agent,
                            a.created_at,

                            COALESCE(
                                to_jsonb(u)->>'full_name',
                                to_jsonb(u)->>'name',
                                to_jsonb(u)->>'email',
                                'ResolveDesk System'
                            )
                                AS actor_name,

                            COALESCE(
                                to_jsonb(u)->>'email',
                                ''
                            )
                                AS actor_email,

                            COALESCE(
                                to_jsonb(u)->>'role',
                                'SYSTEM'
                            )
                                AS actor_role

                        FROM audit_logs a

                        LEFT JOIN users u
                            ON u.id =
                                a.actor_id

                        ORDER BY
                            a.created_at DESC,
                            a.id DESC

                        LIMIT $1
                    `,
                    [
                        limit
                    ]
                );


            const logs =
                result.rows.map(
                    formatLog
                );


            const actors =
                [
                    ...new Map(
                        logs
                            .filter(
                                log =>
                                    log.actor
                            )
                            .map(
                                log => [

                                    log.actor,

                                    {
                                        id:
                                            log.actorId,

                                        name:
                                            log.actor,

                                        email:
                                            log.actorEmail,

                                        role:
                                            log.role
                                    }

                                ]
                            )
                    ).values()
                ]
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a.name.localeCompare(
                                b.name
                            )
                    );


            return res.json({

                success:
                    true,

                count:
                    logs.length,

                logs,

                actors

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


/* =========================================================
   GET SINGLE AUDIT EVENT

   GET /api/audit-logs/:id
========================================================= */

router.get(
    "/:id",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !/^\d+$/.test(
                    String(
                        req.params.id ||
                        ""
                    )
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid audit log ID."

                    });
            }


            const result =
                await query(
                    `
                        SELECT
                            a.id,
                            a.actor_id,
                            a.action,
                            a.entity_type,
                            a.entity_id,
                            a.severity,
                            a.metadata,
                            a.ip_address,
                            a.user_agent,
                            a.created_at,

                            COALESCE(
                                to_jsonb(u)->>'full_name',
                                to_jsonb(u)->>'name',
                                to_jsonb(u)->>'email',
                                'ResolveDesk System'
                            )
                                AS actor_name,

                            COALESCE(
                                to_jsonb(u)->>'email',
                                ''
                            )
                                AS actor_email,

                            COALESCE(
                                to_jsonb(u)->>'role',
                                'SYSTEM'
                            )
                                AS actor_role

                        FROM audit_logs a

                        LEFT JOIN users u
                            ON u.id =
                                a.actor_id

                        WHERE
                            a.id = $1

                        LIMIT 1
                    `,
                    [
                        req.params.id
                    ]
                );


            if (
                result.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Audit event not found."

                    });
            }


            return res.json({

                success:
                    true,

                log:
                    formatLog(
                        result.rows[0]
                    )

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports =
    router;