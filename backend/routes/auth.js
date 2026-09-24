const express = require("express");
const rateLimit = require("express-rate-limit");

const {
    query
} = require("../db");

const {
    hashPassword,
    verifyPassword
} = require("../utils/password");

const {
    getRuntimeSettings
} =
    require("../utils/runtime-settings");


const router = express.Router();


/* =========================================================
   AUTH RATE LIMIT
========================================================= */

const authLimiter = rateLimit({

    windowMs:
        15 * 60 * 1000,

    limit:
        20,

    standardHeaders:
        "draft-7",

    legacyHeaders:
        false,

    message: {
        success: false,
        message:
            "Too many authentication attempts. Please try again later."
    }

});

const LOGIN_LOCK_MAX_ATTEMPTS =
    5;

const LOGIN_LOCK_MINUTES =
    15;


/* =========================================================
   HELPERS
========================================================= */

function normalizeEmail(email) {

    return String(
        email || ""
    )
        .trim()
        .toLowerCase();
}


function validEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


function validPassword(
    password,
    security = {}
) {

    if (
        typeof password !==
        "string"
    ) {

        return false;
    }


    const minimum =
        Math.max(
            8,
            Number(
                security.minimumPasswordLength
            ) ||
            8
        );


    if (
        password.length <
        minimum
    ) {

        return false;
    }


    if (
        security.uppercaseRequired &&
        !/[A-Z]/.test(
            password
        )
    ) {

        return false;
    }


    if (
        security.numberRequired &&
        !/[0-9]/.test(
            password
        )
    ) {

        return false;
    }


    /*
        Keep existing ResolveDesk
        special-character requirement.
    */

    if (
        !/[^A-Za-z0-9]/.test(
            password
        )
    ) {

        return false;
    }


    return true;
}

function safeUser(row) {

    if (!row) {
        return null;
    }


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
            row.department_name || null,

        phone:
            row.phone || null,

        jobTitle:
            row.job_title || null,

        bio:
            row.bio || null,

        profilePhoto:
            row.profile_photo || null,

        lastLoginAt:
            row.last_login_at || null,

        createdAt:
            row.created_at

    };
}


function regenerateSession(req) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            req.session.regenerate(
                error => {

                    if (error) {
                        return reject(error);
                    }


                    resolve();
                }
            );
        }
    );
}


function saveSession(req) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            req.session.save(
                error => {

                    if (error) {
                        return reject(error);
                    }


                    resolve();
                }
            );
        }
    );
}


function destroySession(req) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            req.session.destroy(
                error => {

                    if (error) {
                        return reject(error);
                    }


                    resolve();
                }
            );
        }
    );
}


/* =========================================================
   AUDIT HELPER

   Temporary direct implementation.
   Later we can move this into backend/utils/audit.js.
========================================================= */

async function writeAudit({
    actorId = null,
    action,
    entityType = null,
    entityId = null,
    severity = "INFO",
    metadata = {},
    ipAddress = null,
    userAgent = null
}) {

    try {

        await query(
            `
                INSERT INTO audit_logs (
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    severity,
                    metadata,
                    ip_address,
                    user_agent
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6::jsonb,
                    $7,
                    $8
                )
            `,
            [
                actorId,
                action,
                entityType,
                entityId
                    ? String(entityId)
                    : null,
                severity,
                JSON.stringify(metadata),
                ipAddress,
                userAgent
            ]
        );

    } catch (error) {

        /*
            Audit failure should not
            break authentication.
        */

        console.error(
            "⚠️ Audit log failed:",
            error.message
        );
    }
}


/* =========================================================
   GET CLIENT INFO
========================================================= */

function getClientIp(req) {

    return (
        req.clientIp ||
        req.ip ||
        req.socket?.remoteAddress ||
        null
    );
}


function getUserAgent(req) {

    return (
        req.get(
            "user-agent"
        ) ||
        null
    );
}


/* =========================================================
   REGISTER
   POST /api/auth/register

   Creates STAFF account with PENDING or ACTIVE
status based on registration approval settings.
========================================================= */

router.post(
    "/register",
    authLimiter,
    async (
        req,
        res,
        next
    ) => {

        try {

            const fullName =
                String(
                    req.body.fullName ||
                    ""
                ).trim();


            const email =
                normalizeEmail(
                    req.body.email
                );


            const department =
                String(
                    req.body.department ||
                    ""
                ).trim();


            const jobTitle =
                String(
                    req.body.jobTitle ||
                    ""
                ).trim();


            const password =
                String(
                    req.body.password ||
                    ""
                );

                const runtimeSettings =
    await getRuntimeSettings();

if (
    runtimeSettings
        .system
        .maintenanceMode
) {

    return res
        .status(503)
        .json({

            success:
                false,

            code:
                "MAINTENANCE_MODE",

            message:
                "ResolveDesk is currently under maintenance. New registrations are temporarily unavailable."

        });
}

if (
    !runtimeSettings
        .system
        .registrationEnabled
) {

    return res
        .status(403)
        .json({

            success: false,

            code:
                "REGISTRATION_DISABLED",

            message:
                "New user registration is currently disabled."

        });
}

const registrationApprovalRequired =
    runtimeSettings
        .system
        .registrationApproval !== false;


const initialStatus =
    registrationApprovalRequired
        ? "PENDING"
        : "ACTIVE";

        const approvedAt =
    initialStatus === "ACTIVE"
        ? new Date()
        : null;

            /* =============================================
               VALIDATION
            ============================================= */

            if (
                fullName.length < 2
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Full name is required."
                    });
            }


            if (
                !validEmail(email)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Enter a valid email address."
                    });
            }


            if (
                !department
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Department is required."
                    });
            }


            if (
              !validPassword(
    password,
    runtimeSettings.security
)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                    `Password must be at least ${
    runtimeSettings.security.minimumPasswordLength
} characters${
    runtimeSettings.security.uppercaseRequired
        ? ", contain an uppercase letter"
        : ""
}${
    runtimeSettings.security.numberRequired
        ? ", contain a number"
        : ""
} and contain a special character.`
                    });
            }


            /* =============================================
               CHECK EMAIL
            ============================================= */

            const existing =
                await query(
                    `
                        SELECT id
                        FROM users
                        WHERE LOWER(email) =
                            LOWER($1)
                        LIMIT 1
                    `,
                    [
                        email
                    ]
                );


            if (
                existing.rowCount >
                0
            ) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "An account with this email already exists."
                    });
            }


            /* =============================================
               FIND DEPARTMENT
            ============================================= */

            const departmentResult =
                await query(
                    `
                        SELECT
                            id,
                            name
                        FROM departments
                        WHERE
                            LOWER(name) =
                            LOWER($1)
                            AND is_active = TRUE
                        LIMIT 1
                    `,
                    [
                        department
                    ]
                );


            if (
                departmentResult.rowCount ===
                0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Selected department does not exist."
                    });
            }


            const departmentId =
                departmentResult.rows[0].id;


            /* =============================================
               HASH PASSWORD
            ============================================= */

            const passwordHash =
                await hashPassword(
                    password
                );


            /* =============================================
               INSERT USER
            ============================================= */

            const result =
                await query(
                    `
                        INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    department_id,
    status,
    job_title,
    approved_at
)
VALUES (
    $1,
    $2,
    $3,
    'STAFF',
    $4,
    $5,
    $6,
    $7
)
                        RETURNING
                            id,
                            full_name,
                            email,
                            role,
                            department_id,
                            status,
                            phone,
                            job_title,
                            bio,
                            profile_photo,
                            last_login_at,
                            created_at
                    `,
                  [
    fullName,
    email,
    passwordHash,
    departmentId,
    initialStatus,
    jobTitle || null,
    approvedAt
]
                );


            const createdUser =
                result.rows[0];


            await writeAudit({

                actorId:
                    createdUser.id,

                action:
    registrationApprovalRequired
        ? "USER_REGISTRATION_SUBMITTED"
        : "USER_REGISTRATION_AUTO_APPROVED",

                entityType:
                    "USER",

                entityId:
                    createdUser.id,

                severity:
                    "INFO",

                metadata: {
                    email:
                        createdUser.email,

                    role:
                        "STAFF",

                    status:
    initialStatus,

                    department
                },

                ipAddress:
                    getClientIp(req),

                userAgent:
                    getUserAgent(req)

            });


            /* =============================================
               RESPONSE
            ============================================= */

            return res
                .status(201)
                .json({

                    success:
                        true,

                message:
    registrationApprovalRequired
        ? "Registration submitted successfully. Administrator approval is required before you can sign in."
        : "Registration completed successfully. You can now sign in.",

                    user: {

                        id:
                            createdUser.id,

                        fullName:
                            createdUser.full_name,

                        email:
                            createdUser.email,

                        role:
                            createdUser.role,

                        status:
                            createdUser.status,

                        department:
                            departmentResult
                                .rows[0]
                                .name

                    }

                });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   LOGIN
   POST /api/auth/login
========================================================= */

router.post(
    "/login",
    authLimiter,
    async (
        req,
        res,
        next
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body.email
                );


            const password =
                String(
                    req.body.password ||
                    ""
                );


            if (
                !email ||
                !password
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Email and password are required."
                    });
            }

            /* =============================================
   LOGIN RUNTIME SETTINGS
============================================= */

const loginRuntimeSettings =
    await getRuntimeSettings();


const loginLockEnabled =
    loginRuntimeSettings
        ?.security
        ?.loginLock ===
    true;


            /* =============================================
               FIND USER
            ============================================= */

            const result =
                await query(
                    `
                        SELECT
                            u.id,
                            u.full_name,
                            u.email,
                            u.password_hash,
                            u.role,
                            u.status,
                            u.department_id,
                            u.phone,
                            u.job_title,
                            u.bio,
                            u.profile_photo,
u.last_login_at,
u.failed_login_attempts,
u.locked_until,
u.last_failed_login_at,
u.created_at,
d.name
    AS department_name

                        FROM users u

                        LEFT JOIN departments d
                            ON d.id =
                                u.department_id

                        WHERE
                            LOWER(u.email) =
                            LOWER($1)

                        LIMIT 1
                    `,
                    [
                        email
                    ]
                );


            const user =
                result.rows[0];


            /* =============================================
               INVALID LOGIN

               Same generic error for unknown email
               and incorrect password.
            ============================================= */

            if (
                !user
            ) {

                await writeAudit({

                    action:
                        "LOGIN_FAILED",

                    entityType:
                        "AUTH",

                    entityId:
                        email,

                    severity:
                        "WARNING",

                    metadata: {
                        reason:
                            "INVALID_CREDENTIALS"
                    },

                    ipAddress:
                        getClientIp(req),

                    userAgent:
                        getUserAgent(req)

                });


                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid email or password."
                    });
            }

/* =============================================
   LOGIN LOCK STATE
============================================= */

if (
    !loginLockEnabled &&
    (
        Number(
            user.failed_login_attempts
        ) > 0 ||
        user.locked_until ||
        user.last_failed_login_at
    )
) {

    await query(
        `
            UPDATE users

            SET
                failed_login_attempts = 0,
                locked_until = NULL,
                last_failed_login_at = NULL,
                updated_at = NOW()

            WHERE id = $1
        `,
        [
            user.id
        ]
    );


    user.failed_login_attempts =
        0;

    user.locked_until =
        null;

    user.last_failed_login_at =
        null;
}


if (
    loginLockEnabled &&
    user.locked_until
) {

    const lockedUntil =
        new Date(
            user.locked_until
        );


    if (
        Number.isFinite(
            lockedUntil.getTime()
        ) &&
        lockedUntil.getTime() >
            Date.now()
    ) {

        await writeAudit({

            actorId:
                user.id,

            action:
                "LOGIN_FAILED",

            entityType:
                "USER",

            entityId:
                user.id,

            severity:
                "WARNING",

            metadata: {

                reason:
                    "ACCOUNT_LOCKED"

            },

            ipAddress:
                getClientIp(req),

            userAgent:
                getUserAgent(req)

        });


        return res
            .status(423)
            .json({

                success:
                    false,

                code:
                    "ACCOUNT_TEMPORARILY_LOCKED",

                message:
                    "Too many failed login attempts. Please try again later."

            });
    }


    /*
        Lock already expired.
        Reset it before accepting
        new login attempts.
    */

    await query(
        `
            UPDATE users

            SET
                failed_login_attempts = 0,
                locked_until = NULL,
                last_failed_login_at = NULL,
                updated_at = NOW()

            WHERE id = $1
        `,
        [
            user.id
        ]
    );


    user.failed_login_attempts =
        0;

    user.locked_until =
        null;

    user.last_failed_login_at =
        null;
}

            const passwordValid =
                await verifyPassword(
                    password,
                    user.password_hash
                );


            if (
    !passwordValid
) {

    let failedAttempts =
        Number(
            user.failed_login_attempts
        ) || 0;


    let accountLocked =
        false;


    let lockedUntil =
        null;


    if (
        loginLockEnabled
    ) {

        const lockResult =
            await query(
                `
                    UPDATE users

                    SET
                        failed_login_attempts =
                            failed_login_attempts + 1,

                        last_failed_login_at =
                            NOW(),

                        locked_until =
                            CASE

                                WHEN
                                    failed_login_attempts + 1 >=
                                    $2

                                THEN
                                    NOW() +
                                    (
                                        $3 *
                                        INTERVAL '1 minute'
                                    )

                                ELSE
                                    NULL

                            END,

                        updated_at =
                            NOW()

                    WHERE id = $1

                    RETURNING
                        failed_login_attempts,
                        locked_until
                `,
                [
                    user.id,
                    LOGIN_LOCK_MAX_ATTEMPTS,
                    LOGIN_LOCK_MINUTES
                ]
            );


        failedAttempts =
            Number(
                lockResult
                    .rows[0]
                    ?.failed_login_attempts
            ) || 0;


        lockedUntil =
            lockResult
                .rows[0]
                ?.locked_until ||
            null;


        accountLocked =
            Boolean(
                lockedUntil
            );


        user.failed_login_attempts =
            failedAttempts;


        user.locked_until =
            lockedUntil;
    }


    await writeAudit({

        actorId:
            user.id,

        action:
            "LOGIN_FAILED",

        entityType:
            "USER",

        entityId:
            user.id,

        severity:
            "WARNING",

        metadata: {

            reason:
                "INVALID_CREDENTIALS",

            loginLockEnabled,

            failedAttempts,

            accountLocked

        },

        ipAddress:
            getClientIp(req),

        userAgent:
            getUserAgent(req)

    });


    if (
        accountLocked
    ) {

        await writeAudit({

            actorId:
                user.id,

            action:
                "ACCOUNT_LOGIN_LOCKED",

            entityType:
                "USER",

            entityId:
                user.id,

            severity:
                "WARNING",

            metadata: {

                failedAttempts,

                maxAttempts:
                    LOGIN_LOCK_MAX_ATTEMPTS,

                lockMinutes:
                    LOGIN_LOCK_MINUTES,

                lockedUntil

            },

            ipAddress:
                getClientIp(req),

            userAgent:
                getUserAgent(req)

        });


        return res
            .status(423)
            .json({

                success:
                    false,

                code:
                    "ACCOUNT_TEMPORARILY_LOCKED",

                message:
                    "Too many failed login attempts. Your account has been temporarily locked."

            });
    }


    return res
        .status(401)
        .json({

            success:
                false,

            code:
                "INVALID_CREDENTIALS",

            message:
                "Invalid email or password."

        });
}

            /* =============================================
               ACCOUNT STATUS
            ============================================= */

            if (
                user.status ===
                "PENDING"
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        code:
                            "ACCOUNT_PENDING",

                        message:
                            "Your account is waiting for administrator approval."
                    });
            }


            if (
                user.status ===
                    "SUSPENDED" ||
                user.status ===
                    "INACTIVE"
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        code:
                            "ACCOUNT_DISABLED",

                        message:
                            "This account is not currently active."
                    });
            }


            if (
                user.status !==
                "ACTIVE"
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Account access is unavailable."
                    });
            }


            /* =============================================
               PREVENT SESSION FIXATION
            ============================================= */


/* =============================================
   MAINTENANCE MODE LOGIN GATE
============================================= */

if (
    loginRuntimeSettings
        .system
        .maintenanceMode &&
    user.role !==
        "ADMIN"
) {

    return res
        .status(503)
        .json({

            success:
                false,

            code:
                "MAINTENANCE_MODE",

            message:
                "ResolveDesk is currently under maintenance. Only administrators can sign in."

        });
}


/* =============================================
   PREVENT SESSION FIXATION
============================================= */

await regenerateSession(
    req
);


/* =============================================
   RUNTIME SESSION TIMEOUT
============================================= */

const sessionTimeoutMinutes =
    Math.max(
        1,
        Number(
            loginRuntimeSettings
                ?.security
                ?.sessionTimeout
        ) || 60
    );


req.session.cookie.maxAge =
    sessionTimeoutMinutes *
    60 *
    1000;
            /* =============================================
               SAVE USER TO SESSION
            ============================================= */

            req.session.user = {

                id:
                    user.id,

                fullName:
                    user.full_name,

                email:
                    user.email,

                role:
                    user.role,

                departmentId:
                    user.department_id,

                department:
                    user.department_name

            };


            await saveSession(
                req
            );


            /* =============================================
               UPDATE LAST LOGIN
            ============================================= */

            await query(
    `
        UPDATE users

        SET
            last_login_at =
                NOW(),

            failed_login_attempts =
                0,

            locked_until =
                NULL,

            last_failed_login_at =
                NULL,

            updated_at =
                NOW()

        WHERE id = $1
    `,
    [
        user.id
    ]
);


            user.last_login_at =
                new Date();


            /* =============================================
               AUDIT
            ============================================= */

            await writeAudit({

                actorId:
                    user.id,

                action:
                    "LOGIN_SUCCESS",

                entityType:
                    "USER",

                entityId:
                    user.id,

                severity:
                    "INFO",

                metadata: {
                    role:
                        user.role
                },

                ipAddress:
                    getClientIp(req),

                userAgent:
                    getUserAgent(req)

            });


            /* =============================================
               RESPONSE
            ============================================= */

            return res.json({

                success:
                    true,

                message:
                    "Login successful.",

                user:
                    safeUser(user)

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   CURRENT USER
   GET /api/auth/me
========================================================= */

router.get(
    "/me",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session.user
            ) {

                return res.json({

                    success:
                        true,

                    loggedIn:
                        false,

                    user:
                        null

                });
            }


            const userId =
                req.session.user.id;


            const result =
                await query(
                    `
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
                            u.last_login_at,
                            u.created_at,
                            d.name
                                AS department_name

                        FROM users u

                        LEFT JOIN departments d
                            ON d.id =
                                u.department_id

                        WHERE u.id = $1

                        LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                result.rowCount ===
                0
            ) {

                await destroySession(
                    req
                );


                res.clearCookie(
                    "resolvedesk.sid"
                );


                return res.json({

                    success:
                        true,

                    loggedIn:
                        false,

                    user:
                        null

                });
            }


            const user =
                result.rows[0];


            if (
                user.status !==
                "ACTIVE"
            ) {

                await destroySession(
                    req
                );


                res.clearCookie(
                    "resolvedesk.sid"
                );


                return res.json({

                    success:
                        true,

                    loggedIn:
                        false,

                    user:
                        null

                });
            }


            return res.json({

                success:
                    true,

                loggedIn:
                    true,

                user:
                    safeUser(user)

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   LOGOUT
   POST /api/auth/logout
========================================================= */

router.post(
    "/logout",
    async (
        req,
        res,
        next
    ) => {

        try {

            const sessionUser =
                req.session.user ||
                null;


            if (
                sessionUser
            ) {

                await writeAudit({

                    actorId:
                        sessionUser.id,

                    action:
                        "LOGOUT",

                    entityType:
                        "USER",

                    entityId:
                        sessionUser.id,

                    severity:
                        "INFO",

                    ipAddress:
                        getClientIp(req),

                    userAgent:
                        getUserAgent(req)

                });
            }


            await destroySession(
                req
            );


            res.clearCookie(
                "resolvedesk.sid",
                {
                    httpOnly:
                        true,

                    sameSite:
                        "lax",

                    secure:
                        process.env.NODE_ENV ===
                        "production"
                }
            );


            return res.json({

                success:
                    true,

                message:
                    "Logged out successfully."

            });

        } catch (error) {

            next(error);
        }
    }
);



/* =========================================================
   PROFILE UPDATE

   PUT /api/auth/profile
========================================================= */

router.put(
    "/profile",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session?.user?.id
            ) {

                return res
                    .status(401)
                    .json({

                        success:
                            false,

                        message:
                            "Authentication required."

                    });
            }


            const userId =
                req.session.user.id;


            const fullName =
                String(
                    req.body.fullName ??
                    req.body.name ??
                    ""
                ).trim();


            const phone =
                String(
                    req.body.phone ??
                    ""
                ).trim();


            const jobTitle =
                String(
                    req.body.jobTitle ??
                    ""
                ).trim();


            const bio =
                String(
                    req.body.bio ??
                    ""
                ).trim();


            const photoProvided =
                Object.prototype.hasOwnProperty.call(
                    req.body,
                    "profilePhoto"
                );

            let profilePhoto =
                req.body.profilePhoto;


            if (
                profilePhoto === undefined ||
                profilePhoto === ""
            ) {

                profilePhoto =
                    null;
            }


            if (
                profilePhoto !== null &&
                typeof profilePhoto !==
                    "string"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid profile photo."

                    });
            }


            if (!fullName) {

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
                fullName.length >
                150
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Full name is too long."

                    });
            }


            if (
                phone.length >
                40 ||
                jobTitle.length >
                120
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Profile information is too long."

                    });
            }


            await query(
                `
                    UPDATE users

                    SET
                        full_name = $1,
                        phone = NULLIF($2, ''),
                        job_title = NULLIF($3, ''),
                        bio = NULLIF($4, ''),
                        profile_photo = CASE WHEN $5::boolean THEN $6::text ELSE profile_photo END,
                        updated_at = NOW()

                    WHERE id = $7
                `,
                [
                    fullName,
                    phone,
                    jobTitle,
                    bio,
                    photoProvided,
                    profilePhoto,
                    userId
                ]
            );


            const result =
                await query(
                    `
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
                            u.last_login_at,
                            u.created_at,
                            d.name
                                AS department_name

                        FROM users u

                        LEFT JOIN departments d
                            ON d.id =
                                u.department_id

                        WHERE
                            u.id = $1

                        LIMIT 1
                    `,
                    [
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


            req.session.user.fullName =
                updated.full_name;


            await saveSession(
                req
            );


            await writeAudit({

                actorId:
                    userId,

                action:
                    "PROFILE_UPDATED",

                entityType:
                    "USER",

                entityId:
                    userId,

                severity:
                    "INFO",

                metadata: {
                    source:
                        "PROFILE"
                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Profile updated successfully.",

                user:
                    safeUser(updated)

            });

        } catch (error) {

            next(error);

        }
    }
);





/* =========================================================
   ROLE-AWARE PROFILE STATS
   GET /api/auth/profile-stats
========================================================= */

router.get(
    "/profile-stats",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session?.user?.id
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Authentication required."
                    });
            }


            const userId =
                req.session.user.id;


            const userResult =
                await query(
                    `
                        SELECT
                            u.id,
                            u.role,
                            d.name AS department
                        FROM users u
                        LEFT JOIN departments d
                            ON d.id = u.department_id
                        WHERE u.id = $1
                        LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                userResult.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found."
                    });
            }


            const user =
                userResult.rows[0];


            if (
                user.role ===
                "ADMIN"
            ) {

                const result =
                    await query(`
                        SELECT

                            (
                                SELECT COUNT(*)::INTEGER
                                FROM users
                            ) AS total_users,

                            (
                                SELECT COUNT(*)::INTEGER
                                FROM tickets
                                WHERE status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )
                            ) AS active_tickets,

                            (
                                SELECT COUNT(*)::INTEGER
                                FROM tickets
                                WHERE
                                    COALESCE(
                                        sla_breached,
                                        FALSE
                                    ) = TRUE
                                    AND status NOT IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                            ) AS sla_breaches,

                            (
                                SELECT COUNT(*)::INTEGER
                                FROM users
                                WHERE
                                    role = 'TECHNICIAN'
                                    AND status = 'ACTIVE'
                            ) AS technicians
                    `);


                const stats =
                    result.rows[0];


                return res.json({
                    success: true,
                    role:
                        "ADMIN",

                    stats: [
                        {
                            label:
                                "Total Users",
                            value:
                                stats.total_users,
                            description:
                                "Registered accounts"
                        },
                        {
                            label:
                                "Active Tickets",
                            value:
                                stats.active_tickets,
                            description:
                                "Currently open"
                        },
                        {
                            label:
                                "SLA Breaches",
                            value:
                                stats.sla_breaches,
                            description:
                                "Current breached tickets"
                        },
                        {
                            label:
                                "Technicians",
                            value:
                                stats.technicians,
                            description:
                                "Active support staff"
                        }
                    ]
                });
            }


            if (
                user.role ===
                "TECHNICIAN"
            ) {

                const result =
                    await query(
                        `
                            SELECT

                                COUNT(*)::INTEGER
                                    AS assigned,

                                COUNT(*) FILTER (
                                    WHERE status IN (
                                        'OPEN',
                                        'PENDING',
                                        'IN_PROGRESS'
                                    )
                                )::INTEGER
                                    AS active,

                                COUNT(*) FILTER (
                                    WHERE status IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                                )::INTEGER
                                    AS resolved

                            FROM tickets
                            WHERE assigned_to = $1
                        `,
                        [
                            userId
                        ]
                    );


                const stats =
                    result.rows[0];


                return res.json({
                    success: true,
                    role:
                        "TECHNICIAN",

                    stats: [
                        {
                            label:
                                "Assigned Tickets",
                            value:
                                stats.assigned,
                            description:
                                "Lifetime assignments"
                        },
                        {
                            label:
                                "Active Tickets",
                            value:
                                stats.active,
                            description:
                                "Currently assigned"
                        },
                        {
                            label:
                                "Resolved Tickets",
                            value:
                                stats.resolved,
                            description:
                                "Completed assignments"
                        },
                        {
                            label:
                                "Department",
                            value:
                                user.department ||
                                "—",
                            description:
                                "Assigned department"
                        }
                    ]
                });
            }


            const result =
                await query(
                    `
                        SELECT

                            COUNT(*)::INTEGER
                                AS created,

                            COUNT(*) FILTER (
                                WHERE status IN (
                                    'OPEN',
                                    'PENDING',
                                    'IN_PROGRESS'
                                )
                            )::INTEGER
                                AS active,

                            COUNT(*) FILTER (
                                WHERE status IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )
                            )::INTEGER
                                AS resolved

                        FROM tickets
                        WHERE requester_id = $1
                    `,
                    [
                        userId
                    ]
                );


            const stats =
                result.rows[0];


            return res.json({
                success: true,
                role:
                    "STAFF",

                stats: [
                    {
                        label:
                            "Tickets Created",
                        value:
                            stats.created,
                        description:
                            "Lifetime requests"
                    },
                    {
                        label:
                            "Open Tickets",
                        value:
                            stats.active,
                        description:
                            "Currently active"
                    },
                    {
                        label:
                            "Resolved Tickets",
                        value:
                            stats.resolved,
                        description:
                            "Completed requests"
                    },
                    {
                        label:
                            "Department",
                        value:
                            user.department ||
                            "—",
                        description:
                            "Assigned department"
                    }
                ]
            });


        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   CURRENT USER ACTIVITY
   GET /api/auth/activity
========================================================= */

router.get(
    "/activity",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session?.user?.id
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Authentication required."
                    });
            }


            let limit =
                Number(
                    req.query.limit
                ) || 5;


            limit =
                Math.max(
                    1,
                    Math.min(
                        limit,
                        20
                    )
                );


            const result =
                await query(
                    `
                        SELECT
                            a.id,
                            a.action,
                            a.entity_type,
                            a.entity_id,
                            a.severity,
                            a.metadata,
                            a.created_at,

                            target_user.full_name
                                AS entity_user_name,

                            target_user.email
                                AS entity_user_email,

                            t.ticket_number
                                AS entity_ticket_number,

                            t.subject
                                AS entity_ticket_subject

                        FROM audit_logs a

                        LEFT JOIN users target_user
                            ON a.entity_type = 'USER'
                            AND target_user.id::text =
                                a.entity_id::text

                        LEFT JOIN tickets t
                            ON a.entity_type = 'TICKET'
                            AND t.id::text =
                                a.entity_id::text

                        WHERE a.actor_id = $1

                        ORDER BY
                            a.created_at DESC,
                            a.id DESC

                        LIMIT $2
                    `,
                    [
                        req.session.user.id,
                        limit
                    ]
                );


            return res.json({
                success: true,

                activities:
                    result.rows.map(
                        row => ({
                            id:
                                row.id,

                            action:
                                row.action,

                            entityType:
                                row.entity_type,

                            entityId:
                                row.entity_id,

                            severity:
                                row.severity,

                            metadata:
                                row.metadata || {},

                            entityUserName:
                                row.entity_user_name || null,

                            entityUserEmail:
                                row.entity_user_email || null,

                            entityTicketNumber:
                                row.entity_ticket_number || null,

                            entityTicketSubject:
                                row.entity_ticket_subject || null,

                            createdAt:
                                row.created_at
                        })
                    )
            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   USER PREFERENCES
   GET /api/auth/preferences
========================================================= */

router.get(
    "/preferences",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session?.user?.id
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Authentication required."
                    });
            }


            const userId =
                req.session.user.id;


            await query(
                `
                    INSERT INTO user_preferences (
                        user_id
                    )
                    VALUES ($1)
                    ON CONFLICT (user_id)
                    DO NOTHING
                `,
                [
                    userId
                ]
            );


            const result =
                await query(
                    `
                        SELECT
                            assignment_alerts,
                            sla_alerts,
                            email_alerts,
                            daily_summary
                        FROM user_preferences
                        WHERE user_id = $1
                        LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            const row =
                result.rows[0];


            return res.json({
                success: true,

                preferences: {
                    assignmentAlerts:
                        row.assignment_alerts,

                    slaAlerts:
                        row.sla_alerts,

                    emailAlerts:
                        row.email_alerts,

                    dailySummary:
                        row.daily_summary
                }
            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   UPDATE USER PREFERENCES
   PUT /api/auth/preferences
========================================================= */

router.put(
    "/preferences",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session?.user?.id
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Authentication required."
                    });
            }


            const {
                assignmentAlerts,
                slaAlerts,
                emailAlerts,
                dailySummary
            } = req.body || {};


            const values = [
                assignmentAlerts,
                slaAlerts,
                emailAlerts,
                dailySummary
            ];


            if (
                values.some(
                    value =>
                        typeof value !==
                        "boolean"
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid preference values."
                    });
            }


            const result =
                await query(
                    `
                        INSERT INTO user_preferences (
                            user_id,
                            assignment_alerts,
                            sla_alerts,
                            email_alerts,
                            daily_summary
                        )
                        VALUES (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5
                        )

                        ON CONFLICT (user_id)

                        DO UPDATE SET
                            assignment_alerts =
                                EXCLUDED.assignment_alerts,

                            sla_alerts =
                                EXCLUDED.sla_alerts,

                            email_alerts =
                                EXCLUDED.email_alerts,

                            daily_summary =
                                EXCLUDED.daily_summary,

                            updated_at =
                                NOW()

                        RETURNING
                            assignment_alerts,
                            sla_alerts,
                            email_alerts,
                            daily_summary
                    `,
                    [
                        req.session.user.id,
                        assignmentAlerts,
                        slaAlerts,
                        emailAlerts,
                        dailySummary
                    ]
                );


            const row =
                result.rows[0];


            return res.json({
                success: true,

                message:
                    "Preferences saved.",

                preferences: {
                    assignmentAlerts:
                        row.assignment_alerts,

                    slaAlerts:
                        row.sla_alerts,

                    emailAlerts:
                        row.email_alerts,

                    dailySummary:
                        row.daily_summary
                }
            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   CHANGE PASSWORD
   PUT /api/auth/password
========================================================= */

router.put(
    "/password",
    authLimiter,
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !req.session.user
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Authentication required."
                    });
            }


            const currentPassword =
                String(
                    req.body.currentPassword ||
                    ""
                );


            const newPassword =
                String(
                    req.body.newPassword ||
                    ""
                );


            if (
                !currentPassword ||
                !newPassword
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Current password and new password are required."
                    });
            }
            const passwordRuntimeSettings =
                await getRuntimeSettings();

            if (
                !validPassword(
                    newPassword,
                    passwordRuntimeSettings.security
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            `New password must be at least ${passwordRuntimeSettings.security.minimumPasswordLength} characters and contain an uppercase letter, a number and a special character.`
                    });
            }


            const result =
                await query(
                    `
                        SELECT
                            id,
                            password_hash
                        FROM users
                        WHERE id = $1
                        LIMIT 1
                    `,
                    [
                        req.session.user.id
                    ]
                );


            if (
                result.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User account not found."
                    });
            }


            const valid =
                await verifyPassword(
                    currentPassword,
                    result.rows[0]
                        .password_hash
                );


            if (
                !valid
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Current password is incorrect."
                    });
            }


            const samePassword =
                await verifyPassword(
                    newPassword,
                    result.rows[0]
                        .password_hash
                );


            if (
                samePassword
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "New password must be different from your current password."
                    });
            }


            const newHash =
                await hashPassword(
                    newPassword
                );


            await query(
                `
                    UPDATE users
                    SET password_hash = $1
                    WHERE id = $2
                `,
                [
                    newHash,
                    req.session.user.id
                ]
            );


            await writeAudit({

                actorId:
                    req.session.user.id,

                action:
                    "PASSWORD_CHANGED",

                entityType:
                    "USER",

                entityId:
                    req.session.user.id,

                severity:
                    "WARNING",

                ipAddress:
                    getClientIp(req),

                userAgent:
                    getUserAgent(req)

            });


            return res.json({

                success:
                    true,

                message:
                    "Password updated successfully."

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