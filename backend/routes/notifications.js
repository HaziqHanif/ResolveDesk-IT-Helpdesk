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


router.use(
    requireAuth
);


/* =========================================================
   LIST NOTIFICATIONS

   GET /api/notifications
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const limit =
                Math.min(
                    100,
                    Math.max(
                        1,
                        Number(
                            req.query.limit
                        ) || 30
                    )
                );


            const result =
                await query(
                    `
                        SELECT
                            id,
                            user_id,
                            type,
                            title,
                            body,
                            link,
                            read_at,
                            created_at

                        FROM notifications

                        WHERE
                            user_id = $1

                        ORDER BY
                            created_at DESC,
                            id DESC

                        LIMIT $2
                    `,
                    [
                        req.user.id,
                        limit
                    ]
                );


            const unread =
                await query(
                    `
                        SELECT
                            COUNT(*)::INTEGER
                                AS count

                        FROM notifications

                        WHERE
                            user_id = $1
                            AND read_at IS NULL
                    `,
                    [
                        req.user.id
                    ]
                );


            return res.json({

                success:
                    true,

                unreadCount:
                    unread.rows[0]
                        .count,

                notifications:
                    result.rows.map(
                        row => ({

                            id:
                                row.id,

                            type:
                                row.type,

                            title:
                                row.title,

                            body:
                                row.body,

                            link:
                                row.link,

                            readAt:
                                row.read_at,

                            createdAt:
                                row.created_at

                        })
                    )

            });

        } catch (
            error
        ) {

            next(
                error
            );
        }
    }
);


/* =========================================================
   MARK ONE AS READ

   PATCH /api/notifications/:id/read
========================================================= */

router.patch(
    "/:id/read",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(
                    `
                        UPDATE notifications

                        SET
                            read_at =
                                COALESCE(
                                    read_at,
                                    NOW()
                                )

                        WHERE
                            id = $1
                            AND user_id = $2

                        RETURNING
                            id,
                            read_at
                    `,
                    [
                        req.params.id,
                        req.user.id
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
                            "Notification not found."

                    });
            }


            return res.json({

                success:
                    true,

                notification: {

                    id:
                        result.rows[0]
                            .id,

                    readAt:
                        result.rows[0]
                            .read_at

                }

            });

        } catch (
            error
        ) {

            next(
                error
            );
        }
    }
);


/* =========================================================
   MARK ALL AS READ

   PATCH /api/notifications/read-all
========================================================= */

router.patch(
    "/read-all",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(
                    `
                        UPDATE notifications

                        SET
                            read_at = NOW()

                        WHERE
                            user_id = $1
                            AND read_at IS NULL
                    `,
                    [
                        req.user.id
                    ]
                );


            return res.json({

                success:
                    true,

                updated:
                    result.rowCount

            });

        } catch (
            error
        ) {

            next(
                error
            );
        }
    }
);


module.exports =
    router;