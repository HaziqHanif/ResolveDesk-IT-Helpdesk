require("dotenv").config();

const express =
    require("express");

const path =
    require("path");

const session =
    require("express-session");

const connectPgSimple =
    require("connect-pg-simple");

const rateLimit =
    require("express-rate-limit");

    const authRoutes =
    require("./routes/auth");

    const userRoutes =
    require("./routes/users");

    const ticketRoutes =
    require("./routes/tickets");

    const attachmentRoutes =
    require("./routes/attachments");

    const auditLogRoutes =
    require("./routes/audit-logs");

    const technicianRoutes =
    require("./routes/technicians");

const departmentRoutes =
    require("./routes/departments");

    const reportRoutes =
    require("./routes/reports");

    const knowledgeBaseRoutes =
    require("./routes/knowledge-base");

    const settingsRoutes =
    require("./routes/settings");

    const notificationRoutes =
    require("./routes/notifications");


const {
    pool,
    query,
    testConnection,
    closePool
} =
    require("./db");

    const {
    getRuntimeSettings
} =
    require("./utils/runtime-settings");


const {
    hashPassword
} =
    require("./utils/password");


/* =========================================================
   APP
========================================================= */

const app =
    express();


const PORT =
    Number(
        process.env.PORT
    ) || 3003;


const isProduction =
    process.env.NODE_ENV ===
    "production";


/* =========================================================
   PATHS
========================================================= */

const projectFolder =
    path.join(
        __dirname,
        ".."
    );


const frontendFolder =
    path.join(
        projectFolder,
        "frontend"
    );


/* =========================================================
   EXPRESS SECURITY
========================================================= */

app.disable(
    "x-powered-by"
);

app.use(
    (
        req,
        res,
        next
    ) => {

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.setHeader(
            "X-Frame-Options",
            "SAMEORIGIN"
        );

        res.setHeader(
            "Referrer-Policy",
            "strict-origin-when-cross-origin"
        );

        res.setHeader(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()"
        );

        if (isProduction) {
            res.setHeader(
                "Strict-Transport-Security",
                "max-age=31536000"
            );
        }

        next();
    }
);


if (
    isProduction
) {

    app.set(
        "trust proxy",
        1
    );
}


/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
    express.json(
        {
            limit:
                "2mb"
        }
    )
);


app.use(
    express.urlencoded(
        {
            extended:
                true,

            limit:
                "2mb"
        }
    )
);


/* =========================================================
   API RATE LIMIT
========================================================= */

const apiLimiter =
    rateLimit(
        {
            windowMs:
                15 *
                60 *
                1000,

            limit:
                300,

            standardHeaders:
                "draft-7",

            legacyHeaders:
                false,

            message: {

                success:
                    false,

                message:
                    "Too many requests. Please try again later."

            }
        }
    );


app.use(
    "/api",
    apiLimiter
);


/* =========================================================
   SESSION STORE
========================================================= */

const PgSession =
    connectPgSimple(
        session
    );


const SESSION_SECRET =
    process.env.SESSION_SECRET;


if (
    !SESSION_SECRET
) {

    throw new Error(
        "SESSION_SECRET is missing from .env"
    );
}


if (
    isProduction &&
    SESSION_SECRET.length <
        32
) {

    throw new Error(
        "SESSION_SECRET must be at least 32 characters in production."
    );
}


app.use(
    session(
        {

            store:
                new PgSession(
                    {
                        pool,

                        tableName:
                            "user_sessions",

                        createTableIfMissing:
                            false,

                        pruneSessionInterval:
                            60
                    }
                ),

            name:
                "resolvedesk.sid",

            secret:
                SESSION_SECRET,

            resave:
                false,

            saveUninitialized:
                false,

            rolling:
                true,

            cookie: {

                httpOnly:
                    true,

                sameSite:
                    "lax",

                secure:
                    isProduction,

                maxAge:
                    60 *
                    60 *
                    1000

            }

        }
    )
);


/* =========================================================
   REQUEST INFORMATION
========================================================= */

app.use(
    (
        req,
        res,
        next
    ) => {

        req.clientIp =
            (
                req.headers[
                    "x-forwarded-for"
                ] ||
                req.socket.remoteAddress ||
                ""
            )
                .toString()
                .split(",")[0]
                .trim();


        next();
    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    async (
        req,
        res
    ) => {

        try {

            const result =
                await query(`
                    SELECT
                        current_database()
                            AS database,
                        NOW()
                            AS server_time
                `);


            res.json(
                {
                    success:
                        true,

                    service:
                        "ResolveDesk",

                    status:
                        "online",

                    database: {

                        connected:
                            true,

                        name:
                            result.rows[0]
                                .database

                    },

                    serverTime:
                        result.rows[0]
                            .server_time,

                    environment:
                        process.env.NODE_ENV ||
                        "development"

                }
            );

        } catch (
            error
        ) {

            res.status(
                503
            )
            .json(
                {
                    success:
                        false,

                    service:
                        "ResolveDesk",

                    status:
                        "degraded",

                    database: {

                        connected:
                            false

                    }

                }
            );
        }
    }
);




/* =========================================================
   MAINTENANCE MODE GATE

   - Health remains available
   - Auth endpoints remain reachable
   - Admins retain full API access
   - Staff / technicians / guests are blocked
========================================================= */

app.use(
    "/api",
    async (
        req,
        res,
        next
    ) => {

        try {

            /*
             * Keep authentication endpoints available.
             *
             * Login itself performs an additional role check,
             * allowing ADMIN while rejecting normal users
             * during maintenance.
             */

            if (
                req.originalUrl ===
                    "/api/health" ||
                req.originalUrl.startsWith(
                    "/api/auth/"
                )
            ) {

                return next();
            }


            const runtimeSettings =
                await getRuntimeSettings();


            if (
                !runtimeSettings
                    .system
                    .maintenanceMode
            ) {

                return next();
            }


            const sessionRole =
                req.session
                    ?.user
                    ?.role;


            /*
             * Administrators must retain access so
             * maintenance mode can be disabled again.
             */

            if (
                sessionRole ===
                "ADMIN"
            ) {

                return next();
            }


            return res
                .status(503)
                .json({

                    success:
                        false,

                    code:
                        "MAINTENANCE_MODE",

                    message:
                        "ResolveDesk is currently under maintenance. Please try again later."

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
   API ROUTES
========================================================= */

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/users",
    userRoutes
);
app.use(
    "/api/tickets",
    ticketRoutes
);

app.use(
    "/api/attachments",
    attachmentRoutes
);

app.use(
    "/api/audit-logs",
    auditLogRoutes
);

app.use(
    "/api/technicians",
    technicianRoutes
);

app.use(
    "/api/departments",
    departmentRoutes
);

app.use(
    "/api/reports",
    reportRoutes
);

app.use(
    "/api/knowledge-base",
    knowledgeBaseRoutes
);

app.use(
    "/api/settings",
    settingsRoutes
);

app.use(
    "/api/notifications",
    notificationRoutes
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

app.use(
    express.static(
        frontendFolder
    )
);


/* =========================================================
   ROOT
========================================================= */

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.sendFile(
            path.join(
                frontendFolder,
                "login.html"
            )
        );
    }
);


/* =========================================================
   API 404
========================================================= */

app.use(
    "/api",
    (
        req,
        res
    ) => {

        res.status(
            404
        )
        .json(
            {
                success:
                    false,

                message:
                    "API endpoint not found."
            }
        );
    }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "❌ Server error:"
        );


        console.error(
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );
        }


        res.status(
            500
        )
        .json(
            {
                success:
                    false,

                message:
                    "Internal server error."
            }
        );
    }
);


/* =========================================================
   DEFAULT ADMIN
========================================================= */

async function createDefaultAdmin() {

    const name =
        (
            process.env.ADMIN_NAME ||
            "ResolveDesk Admin"
        ).trim();


    const email =
        (
            process.env.ADMIN_EMAIL ||
            "admin@resolvedesk.local"
        )
            .trim()
            .toLowerCase();


    const password =
        process.env.ADMIN_PASSWORD ||
        "";


    /* =====================================================
       DO NOT CREATE WITH EMPTY PASSWORD
    ===================================================== */

    if (
        !password
    ) {

        console.warn(
            "⚠️ ADMIN_PASSWORD is empty."
        );


        console.warn(
            "⚠️ Default admin was not created."
        );


        return;
    }


    if (
        password.length <
        10
    ) {

        throw new Error(
            "ADMIN_PASSWORD must contain at least 10 characters."
        );
    }


    /* =====================================================
       CHECK EXISTING ACCOUNT
    ===================================================== */

    const existing =
        await query(
            `
                SELECT
                    id,
                    full_name,
                    email,
                    role,
                    status
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

        console.log(
            "✅ Default admin account already exists."
        );


        console.log(
            `🔐 Admin: ${email}`
        );


        /*
            IMPORTANT:
            We do NOT reset existing
            admin passwords automatically.
        */


        return existing.rows[0];
    }


    /* =====================================================
       IT DEPARTMENT
    ===================================================== */

    const departmentResult =
        await query(`
            SELECT id
            FROM departments
            WHERE UPPER(code) = 'IT'
            LIMIT 1
        `);


    const departmentId =
        departmentResult.rows[0]
            ?.id ||
        null;


    /* =====================================================
       HASH PASSWORD
    ===================================================== */

    const passwordHash =
        await hashPassword(
            password
        );


    /* =====================================================
       INSERT ADMIN
    ===================================================== */

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
                    'ADMIN',
                    $4,
                    'ACTIVE',
                    'System Administrator',
                    NOW()
                )
                RETURNING
                    id,
                    full_name,
                    email,
                    role,
                    status,
                    department_id,
                    created_at
            `,
            [
                name,
                email,
                passwordHash,
                departmentId
            ]
        );


    const admin =
        result.rows[0];


    console.log(
        "✅ Default administrator created."
    );


    console.log(
        `🔐 Admin email: ${admin.email}`
    );


    console.log(
        "🔒 Admin password stored as scrypt hash."
    );


    return admin;
}


/* =========================================================
   SERVER
========================================================= */

let server;


const {
    startAutoCloseWorker,
    stopAutoCloseWorker
} =
    require(
        "./utils/auto-close"
    );


const {
    startDailySummaryScheduler
} =
    require(
        "./utils/daily-summary"
    );


/* =========================================================
   START
========================================================= */

/* =========================================================
   START
========================================================= */

async function startServer() {

    console.log(
        "\n========================================"
    );


    console.log(
        "           RESOLVEDESK"
    );


    console.log(
        "========================================\n"
    );


    /* =====================================================
       DATABASE
    ===================================================== */

    await testConnection();


    /* =====================================================
       ADMIN
    ===================================================== */

    await createDefaultAdmin();


    /* =====================================================
       LISTENER
    ===================================================== */

    server =
        app.listen(
            PORT,
            () => {

                 startAutoCloseWorker();
                startDailySummaryScheduler();

                console.log(
                    "\n========================================"
                );


                console.log(
                    "       RESOLVEDESK SERVER ONLINE"
                );


                console.log(
                    "========================================"
                );


                console.log(
                    `🚀 App: http://localhost:${PORT}`
                );


                console.log(
                    `🔐 Login: http://localhost:${PORT}/login.html`
                );


                console.log(
                    `📝 Register: http://localhost:${PORT}/register.html`
                );


                console.log(
                    `📊 Dashboard: http://localhost:${PORT}/dashboard.html`
                );


                console.log(
                    `❤️ Health: http://localhost:${PORT}/api/health`
                );


                console.log(
                    `🗄️ Database: ${process.env.DB_NAME || "resolvedesk"}`
                );


                console.log(
                    `⚙️ Environment: ${process.env.NODE_ENV || "development"}`
                );


                console.log(
                    "========================================\n"
                );
            }
        );
}


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

let shuttingDown =
    false;


async function shutdown(
    signal
) {

    if (
        shuttingDown
    ) {

        return;
    }


    shuttingDown =
        true;


    console.log(
        `\n🛑 ${signal} received. Shutting down ResolveDesk...`
    );


    const finish =
        async () => {

            try {

                stopAutoCloseWorker();
                await closePool();

            } catch (
                error
            ) {

                console.error(
                    "PostgreSQL shutdown error:",
                    error.message
                );
            }


            process.exit(
                0
            );
        };


    if (
        server
    ) {

        server.close(
            finish
        );


        setTimeout(
            () => {

                console.error(
                    "⚠️ Forced shutdown after timeout."
                );


                process.exit(
                    1
                );

            },
            8000
        )
        .unref();

    } else {

        await finish();
    }
}


process.on(
    "SIGINT",
    () =>
        shutdown(
            "SIGINT"
        )
);


process.on(
    "SIGTERM",
    () =>
        shutdown(
            "SIGTERM"
        )
);


/* =========================================================
   UNHANDLED REJECTION
========================================================= */

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "❌ Unhandled rejection:"
        );


        console.error(
            error
        );
    }
);


/* =========================================================
   START APPLICATION
========================================================= */

startServer()
    .catch(
        async error => {

            console.error(
                "\n❌ ResolveDesk failed to start."
            );


            console.error(
                error.message
            );


            try {

                await closePool();

            } catch (
                closeError
            ) {

                // Ignore shutdown errors here.
            }


            process.exit(
                1
            );
        }
    );