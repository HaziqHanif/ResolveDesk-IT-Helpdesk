const express =
    require("express");


const {
    query,
    withTransaction
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
   ALL USER ROUTES REQUIRE ADMIN
========================================================= */

router.use(
    requireAuth,
    requireAdmin
);


/* =========================================================
   HELPERS
========================================================= */

function safeUser(
    row
) {

    return {

        id:
            row.id,

        fullName:
            row.full_name,

        email:
            row.email,

        role:
            row.role,

        status:
            row.status,

        departmentId:
            row.department_id,

        department:
            row.department_name ||
            null,

        phone:
            row.phone ||
            null,

        jobTitle:
            row.job_title ||
            null,

        bio:
            row.bio ||
            null,

        profilePhoto:
            row.profile_photo ||
            null,

        approvedAt:
            row.approved_at ||
            null,

        approvedBy:
            row.approved_by ||
            null,

        lastLoginAt:
            row.last_login_at ||
            null,

        createdAt:
            row.created_at,

        updatedAt:
            row.updated_at

    };
}


function normalizeStatus(
    status
) {

    return String(
        status || ""
    )
        .trim()
        .toUpperCase();
}


function normalizeRole(
    role
) {

    return String(
        role || ""
    )
        .trim()
        .toUpperCase();
}


const allowedRoles =
    [
        "ADMIN",
        "TECHNICIAN",
        "STAFF"
    ];


const allowedStatuses =
    [
        "PENDING",
        "ACTIVE",
        "SUSPENDED",
        "INACTIVE"
    ];


/* =========================================================
   COMMON SELECT
========================================================= */

const userSelect = `
    SELECT
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.status,
        u.department_id,
        u.phone,
        u.job_title,
        u.bio,
        u.profile_photo,
        u.approved_at,
        u.approved_by,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        d.name
            AS department_name

    FROM users u

    LEFT JOIN departments d
        ON d.id =
            u.department_id
`;


/* =========================================================
   LIST USERS

   GET /api/users
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const search =
                String(
                    req.query.search ||
                    ""
                ).trim();


            const role =
                normalizeRole(
                    req.query.role
                );


            const status =
                normalizeStatus(
                    req.query.status
                );


            const departmentId =
                String(
                    req.query.departmentId ||
                    ""
                ).trim();


            const conditions =
                [];


            const values =
                [];


            function addValue(
                value
            ) {

                values.push(
                    value
                );


                return `$${values.length}`;
            }


            /* =============================================
               SEARCH
            ============================================= */

            if (
                search
            ) {

                const placeholder =
                    addValue(
                        `%${search}%`
                    );


                conditions.push(`
                    (
                        u.full_name
                            ILIKE ${placeholder}

                        OR

                        u.email
                            ILIKE ${placeholder}

                        OR

                        COALESCE(
                            u.job_title,
                            ''
                        )
                            ILIKE ${placeholder}
                    )
                `);
            }


            /* =============================================
               ROLE
            ============================================= */

            if (
                role &&
                allowedRoles.includes(
                    role
                )
            ) {

                conditions.push(
                    `u.role = ${addValue(role)}`
                );
            }


            /* =============================================
               STATUS
            ============================================= */

            if (
                status &&
                allowedStatuses.includes(
                    status
                )
            ) {

                conditions.push(
                    `u.status = ${addValue(status)}`
                );
            }


            /* =============================================
               DEPARTMENT
            ============================================= */

            if (
                departmentId
            ) {

                conditions.push(
                    `u.department_id = ${addValue(departmentId)}`
                );
            }


            const where =
                conditions.length
                    ? `WHERE ${conditions.join(" AND ")}`
                    : "";


            const result =
                await query(
                    `
                        ${userSelect}

                        ${where}

                        ORDER BY
                            CASE
                                WHEN u.status = 'PENDING'
                                    THEN 1
                                WHEN u.status = 'ACTIVE'
                                    THEN 2
                                ELSE 3
                            END,
                            u.created_at DESC
                    `,
                    values
                );


            return res.json({

                success:
                    true,

                count:
                    result.rowCount,

                users:
                    result.rows.map(
                        safeUser
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   PENDING USERS

   GET /api/users/pending
========================================================= */

router.get(
    "/pending",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(`
                    ${userSelect}

                    WHERE
                        u.status = 'PENDING'

                    ORDER BY
                        u.created_at ASC
                `);


            return res.json({

                success:
                    true,

                count:
                    result.rowCount,

                users:
                    result.rows.map(
                        safeUser
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);

/* =========================================================
   USER STATS

   GET /api/users-stats is NOT used here because
   /:id would capture it.

   Endpoint:
   GET /api/users/summary/stats
========================================================= */

router.get(
    "/summary/stats",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(`
                    SELECT

                        COUNT(*)::INTEGER
                            AS total,

                        COUNT(*) FILTER (
                            WHERE status = 'ACTIVE'
                        )::INTEGER
                            AS active,

                        COUNT(*) FILTER (
                            WHERE status = 'PENDING'
                        )::INTEGER
                            AS pending,

                        COUNT(*) FILTER (
                            WHERE status = 'SUSPENDED'
                        )::INTEGER
                            AS suspended,

                        COUNT(*) FILTER (
                            WHERE role = 'ADMIN'
                        )::INTEGER
                            AS admins,

                        COUNT(*) FILTER (
                            WHERE role = 'TECHNICIAN'
                        )::INTEGER
                            AS technicians,

                        COUNT(*) FILTER (
                            WHERE role = 'STAFF'
                        )::INTEGER
                            AS staff

                    FROM users
                `);


            return res.json({

                success:
                    true,

                stats:
                    result.rows[0]

            });

        } catch (error) {

            next(error);
        }
    }
);

/* =========================================================
   DEPARTMENT OPTIONS
   GET /api/users/meta/departments
========================================================= */

router.get(
    "/meta/departments",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(`
                    SELECT
                        id,
                        name,
                        code
                    FROM departments
                    WHERE is_active = TRUE
                    ORDER BY name ASC
                `);


            return res.json({

                success:
                    true,

                departments:
                    result.rows

            });

        } catch (error) {

            next(error);
        }
    }
);

/* =========================================================
   GET USER

   GET /api/users/:id
========================================================= */

router.get(
    "/:id",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(
                    `
                        ${userSelect}

                        WHERE u.id = $1

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
                            "User not found."

                    });
            }


            return res.json({

                success:
                    true,

                user:
                    safeUser(
                        result.rows[0]
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   APPROVE REGISTRATION

   POST /api/users/:id/approve
========================================================= */

router.post(
    "/:id/approve",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(
                    `
                        UPDATE users

                        SET
                            status = 'ACTIVE',
                            approved_at = NOW(),
                            approved_by = $1

                        WHERE
                            id = $2
                            AND status = 'PENDING'

                        RETURNING
                            id,
                            full_name,
                            email,
                            role,
                            status,
                            department_id,
                            phone,
                            job_title,
                            bio,
                            profile_photo,
                            approved_at,
                            approved_by,
                            last_login_at,
                            created_at,
                            updated_at
                    `,
                    [
                        req.user.id,
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
                            "Pending registration not found."

                    });
            }


            const user =
                result.rows[0];


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "USER_APPROVED",

                entityType:
                    "USER",

                entityId:
                    user.id,

                severity:
                    "INFO",

                metadata: {

                    email:
                        user.email,

                    role:
                        user.role

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "User approved successfully.",

                user:
                    safeUser(user)

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   REJECT PENDING REGISTRATION

   DELETE /api/users/:id/reject

   Only PENDING accounts can be removed here.
========================================================= */

router.delete(
    "/:id/reject",
    async (
        req,
        res,
        next
    ) => {

        try {

            const result =
                await query(
                    `
                        DELETE FROM users

                        WHERE
                            id = $1
                            AND status = 'PENDING'

                        RETURNING
                            id,
                            full_name,
                            email,
                            role,
                            status
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
                            "Pending registration not found."

                    });
            }


            const deleted =
                result.rows[0];


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "USER_REGISTRATION_REJECTED",

                entityType:
                    "USER",

                entityId:
                    deleted.id,

                severity:
                    "WARNING",

                metadata: {

                    email:
                        deleted.email,

                    role:
                        deleted.role

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Registration rejected."

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   UPDATE USER

   PUT /api/users/:id
========================================================= */

router.put(
    "/:id",
    async (
        req,
        res,
        next
    ) => {

        try {

            const userId =
                req.params.id;


            const existingResult =
                await query(
                    `
                        ${userSelect}

                        WHERE u.id = $1

                        LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                existingResult.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "User not found."

                    });
            }


            const existing =
                existingResult.rows[0];


            const fullName =
                String(
                    req.body.fullName ??
                    existing.full_name
                ).trim();


            const role =
                normalizeRole(
                    req.body.role ??
                    existing.role
                );


            const status =
                normalizeStatus(
                    req.body.status ??
                    existing.status
                );


            const phone =
                String(
                    req.body.phone ??
                    existing.phone ??
                    ""
                ).trim();


            const jobTitle =
                String(
                    req.body.jobTitle ??
                    existing.job_title ??
                    ""
                ).trim();


            const bio =
                String(
                    req.body.bio ??
                    existing.bio ??
                    ""
                ).trim();


            const departmentId =
                req.body.departmentId ===
                    undefined
                    ? existing.department_id
                    : req.body.departmentId ||
                        null;


            /* =============================================
               VALIDATION
            ============================================= */

            if (
                fullName.length <
                2
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Full name is required."

                    });
            }


            if (
                !allowedRoles.includes(
                    role
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid user role."

                    });
            }


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid account status."

                    });
            }


            /* =============================================
               PROTECT CURRENT ADMIN
            ============================================= */

            if (
                String(userId) ===
                String(req.user.id)
            ) {

                if (
                    role !== "ADMIN"
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            message:
                                "You cannot remove your own administrator role."

                        });
                }


                if (
                    status !== "ACTIVE"
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            message:
                                "You cannot deactivate your own account."

                        });
                }
            }


            /* =============================================
               VALIDATE DEPARTMENT
            ============================================= */

            if (
                departmentId
            ) {

                const departmentResult =
                    await query(
                        `
                            SELECT id
                            FROM departments
                            WHERE
                                id = $1
                                AND is_active = TRUE
                            LIMIT 1
                        `,
                        [
                            departmentId
                        ]
                    );


                if (
                    departmentResult.rowCount ===
                    0
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            message:
                                "Selected department does not exist."

                        });
                }
            }


            /* =============================================
               UPDATE
            ============================================= */

            const result =
                await query(
                    `
                        UPDATE users

                        SET
                            full_name = $1,
                            role = $2,
                            status = $3::VARCHAR,
                            department_id = $4,
                            phone = $5,
                            job_title = $6,
                            bio = $7,

                            approved_at =
                                CASE
                                    WHEN
                                        $3::VARCHAR = 'ACTIVE'
                                        AND approved_at IS NULL
                                    THEN NOW()

                                    ELSE approved_at
                                END,

                            approved_by =
                                CASE
                                    WHEN
                                        $3::VARCHAR = 'ACTIVE'
                                        AND approved_by IS NULL
                                    THEN $8

                                    ELSE approved_by
                                END

                        WHERE id = $9

                        RETURNING
                            id,
                            full_name,
                            email,
                            role,
                            status,
                            department_id,
                            phone,
                            job_title,
                            bio,
                            profile_photo,
                            approved_at,
                            approved_by,
                            last_login_at,
                            created_at,
                            updated_at
                    `,
                    [
                        fullName,
                        role,
                        status,
                        departmentId,
                        phone || null,
                        jobTitle || null,
                        bio || null,
                        req.user.id,
                        userId
                    ]
                );


            const updated =
                result.rows[0];


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "USER_UPDATED",

                entityType:
                    "USER",

                entityId:
                    updated.id,

                severity:
                    "INFO",

                metadata: {

                    before: {

                        fullName:
                            existing.full_name,

                        role:
                            existing.role,

                        status:
                            existing.status,

                        departmentId:
                            existing.department_id

                    },

                    after: {

                        fullName:
                            updated.full_name,

                        role:
                            updated.role,

                        status:
                            updated.status,

                        departmentId:
                            updated.department_id

                    }

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "User updated successfully.",

                user:
                    safeUser(updated)

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   CHANGE STATUS

   PATCH /api/users/:id/status

   Body:
   {
       "status": "ACTIVE"
   }
========================================================= */

router.patch(
    "/:id/status",
    async (
        req,
        res,
        next
    ) => {

        try {

            const userId =
                req.params.id;


            const status =
                normalizeStatus(
                    req.body.status
                );


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid account status."

                    });
            }


            if (
                String(userId) ===
                    String(req.user.id) &&
                status !==
                    "ACTIVE"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "You cannot deactivate your own account."

                    });
            }


            const result =
                await query(
                    `
                        UPDATE users

                        SET
                            status = $1::varchar(20),

                            approved_at =
                                CASE
                                    WHEN
                                        $1::varchar(20) = 'ACTIVE'
                                        AND approved_at IS NULL
                                    THEN NOW()

                                    ELSE approved_at
                                END,

                            approved_by =
                                CASE
                                    WHEN
                                        $1::varchar(20) = 'ACTIVE'
                                        AND approved_by IS NULL
                                    THEN $2

                                    ELSE approved_by
                                END

                        WHERE id = $3

                        RETURNING
                            id,
                            full_name,
                            email,
                            role,
                            status,
                            department_id,
                            phone,
                            job_title,
                            bio,
                            profile_photo,
                            approved_at,
                            approved_by,
                            last_login_at,
                            created_at,
                            updated_at
                    `,
                    [
                        status,
                        req.user.id,
                        userId
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
                            "User not found."

                    });
            }


            const updated =
                result.rows[0];


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "USER_STATUS_CHANGED",

                entityType:
                    "USER",

                entityId:
                    updated.id,

                severity:
                    status === "SUSPENDED"
                        ? "WARNING"
                        : "INFO",

                metadata: {
                    status
                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Account status updated.",

                user:
                    safeUser(updated)

            });

        } catch (error) {

            next(error);
        }
    }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports =
    router;
