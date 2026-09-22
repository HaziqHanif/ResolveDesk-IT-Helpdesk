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


router.use(
    requireAuth,
    requireAdmin
);


/* =========================================================
   HELPERS
========================================================= */

function validId(
    value
) {

    return /^\d+$/.test(
        String(
            value ||
            ""
        )
    );
}


function clean(
    value
) {

    return String(
        value ||
        ""
    ).trim();
}


function number(
    value
) {

    return Number(
        value
    ) || 0;
}


function departmentObject(
    row
) {

    const totalTickets =
        number(
            row.total_tickets
        );

    const breachedTickets =
        number(
            row.breached_tickets
        );


    const sla =
        totalTickets
            ? Math.max(
                0,
                Math.round(
                    (
                        totalTickets -
                        breachedTickets
                    ) /
                    totalTickets *
                    100
                )
            )
            : 100;


    return {

        id:
            row.id,

        name:
            row.name,

        code:
            row.code,

        description:
            row.description ||
            "",

        isActive:
            row.is_active,

        status:
            row.is_active
                ? "active"
                : "inactive",

        headUserId:
            row.head_user_id,

        head:
            row.head_name ||
            "Unassigned",

        email:
            row.head_email ||
            "—",

        members:
            number(
                row.member_count
            ),

        openTickets:
            number(
                row.open_tickets
            ),

        totalTickets,

        sla,

        routing:
            Array.isArray(
                row.routing
            )
                ? row.routing
                : [],

        createdAt:
            row.created_at,

        updatedAt:
            row.updated_at

    };
}


async function getDepartmentRows() {

    return query(`
        SELECT

            d.id,
            d.name,
            d.code,
            d.description,
            d.is_active,
            d.head_user_id,
            d.created_at,
            d.updated_at,

            head.full_name
                AS head_name,

            head.email
                AS head_email,

            COALESCE(
                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM users u

                    WHERE
                        u.department_id =
                            d.id
                ),
                0
            )
                AS member_count,

            COALESCE(
                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM tickets t

                    WHERE
                        t.department_id =
                            d.id

                        AND
                        t.status NOT IN (
                            'RESOLVED',
                            'CLOSED'
                        )
                ),
                0
            )
                AS open_tickets,

            COALESCE(
                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM tickets t

                    WHERE
                        t.department_id =
                            d.id
                ),
                0
            )
                AS total_tickets,

            COALESCE(
                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM tickets t

                    WHERE
                        t.department_id =
                            d.id

                        AND (
                            t.sla_breached =
                                TRUE

                            OR (
                                t.status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )

                                AND
                                t.resolution_due_at
                                    IS NOT NULL

                                AND
                                t.resolution_due_at <
                                    NOW()
                            )
                        )
                ),
                0
            )
                AS breached_tickets,

            COALESCE(
                (
                    SELECT
                        ARRAY_AGG(
                            c.name::TEXT
                            ORDER BY c.name
                        )

                    FROM categories c

                    WHERE
                        c.department_id =
                            d.id
                ),
                ARRAY[]::TEXT[]
            )
                AS routing

        FROM departments d

        LEFT JOIN users head
            ON head.id =
                d.head_user_id

        ORDER BY
            d.is_active DESC,
            d.name ASC
    `);
}


async function validateHead(
    headUserId
) {

    if (
        headUserId ===
            null ||
        headUserId ===
            undefined ||
        headUserId ===
            ""
    ) {

        return null;
    }


    if (
        !validId(
            headUserId
        )
    ) {

        const error =
            new Error(
                "Invalid department head."
            );

        error.statusCode =
            400;

        throw error;
    }


    const result =
        await query(
            `
                SELECT id

                FROM users

                WHERE
                    id = $1
                    AND
                    status = 'ACTIVE'

                LIMIT 1
            `,
            [
                headUserId
            ]
        );


    if (
        result.rowCount ===
        0
    ) {

        const error =
            new Error(
                "Department head must be an active user."
            );

        error.statusCode =
            400;

        throw error;
    }


    return Number(
        headUserId
    );
}


/* =========================================================
   LIST

   GET /api/departments
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await getDepartmentRows();


            const heads =
                await query(`
                    SELECT

                        id,
                        full_name,
                        email,
                        role,
                        department_id

                    FROM users

                    WHERE
                        status = 'ACTIVE'

                    ORDER BY
                        full_name ASC
                `);


            return res.json({

                success:
                    true,

                departments:
                    result.rows.map(
                        departmentObject
                    ),

                headOptions:
                    heads.rows.map(
                        row => ({

                            id:
                                row.id,

                            name:
                                row.full_name,

                            email:
                                row.email,

                            role:
                                row.role,

                            departmentId:
                                row.department_id

                        })
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
   CREATE

   POST /api/departments
========================================================= */

router.post(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const name =
                clean(
                    req.body?.name
                );

            const code =
                clean(
                    req.body?.code
                ).toUpperCase();


            if (
                !name ||
                !code
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Department name and code are required."

                    });
            }


            const headUserId =
                await validateHead(
                    req.body?.headUserId
                );


            const description =
                clean(
                    req.body?.description
                ) ||
                null;


            const result =
                await query(
                    `
                        INSERT INTO departments (

                            name,
                            code,
                            description,
                            is_active,
                            head_user_id

                        )

                        VALUES (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5
                        )

                        RETURNING *
                    `,
                    [
                        name,
                        code,
                        description,
                        req.body?.isActive !==
                            false,
                        headUserId
                    ]
                );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "DEPARTMENT_CREATED",

                entityType:
                    "DEPARTMENT",

                entityId:
                    result.rows[0]
                        .id,

                metadata: {
                    name,
                    code,
                    headUserId
                },

                req

            });


            return res
                .status(201)
                .json({

                    success:
                        true,

                    department:
                        result.rows[0]

                });

        } catch (
            error
        ) {

            if (
                error.code ===
                "23505"
            ) {

                return res
                    .status(409)
                    .json({

                        success:
                            false,

                        message:
                            "Department name or code already exists."

                    });
            }


            if (
                error.statusCode
            ) {

                return res
                    .status(
                        error.statusCode
                    )
                    .json({

                        success:
                            false,

                        message:
                            error.message

                    });
            }


            next(error);
        }
    }
);


/* =========================================================
   UPDATE

   PUT /api/departments/:id
========================================================= */

router.put(
    "/:id",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !validId(
                    req.params.id
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid department ID."

                    });
            }


            const name =
                clean(
                    req.body?.name
                );

            const code =
                clean(
                    req.body?.code
                ).toUpperCase();


            if (
                !name ||
                !code
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Department name and code are required."

                    });
            }


            const headUserId =
                await validateHead(
                    req.body?.headUserId
                );


            const result =
                await query(
                    `
                        UPDATE departments

                        SET
                            name = $1,
                            code = $2,
                            description = $3,
                            is_active = $4,
                            head_user_id = $5

                        WHERE
                            id = $6

                        RETURNING *
                    `,
                    [
                        name,

                        code,

                        clean(
                            req.body?.description
                        ) ||
                        null,

                        req.body?.isActive !==
                            false,

                        headUserId,

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
                            "Department not found."

                    });
            }


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "DEPARTMENT_UPDATED",

                entityType:
                    "DEPARTMENT",

                entityId:
                    req.params.id,

                metadata: {
                    name,
                    code,
                    headUserId
                },

                req

            });


            return res.json({

                success:
                    true,

                department:
                    result.rows[0]

            });

        } catch (
            error
        ) {

            if (
                error.code ===
                "23505"
            ) {

                return res
                    .status(409)
                    .json({

                        success:
                            false,

                        message:
                            "Department name or code already exists."

                    });
            }


            if (
                error.statusCode
            ) {

                return res
                    .status(
                        error.statusCode
                    )
                    .json({

                        success:
                            false,

                        message:
                            error.message

                    });
            }


            next(error);
        }
    }
);


module.exports =
    router;