require("dotenv").config();

const { Pool } = require("pg");


/* =========================================================
   DATABASE CONFIG
========================================================= */

const isProduction =
    process.env.NODE_ENV ===
    "production";


const useSsl =
    String(
        process.env.DATABASE_SSL ||
        ""
    ).toLowerCase() ===
        "true";


const poolConfig = {

    host:
        process.env.DB_HOST ||
        "127.0.0.1",

    port:
        Number(
            process.env.DB_PORT
        ) || 5432,

    database:
        process.env.DB_NAME ||
        "resolvedesk",

    user:
        process.env.DB_USER ||
        process.env.USER,

    max:
        10,

    idleTimeoutMillis:
        30000,

    connectionTimeoutMillis:
        5000

};


/* =========================================================
   PASSWORD

   Local Homebrew PostgreSQL may not require one.
========================================================= */

if (
    process.env.DB_PASSWORD
) {

    poolConfig.password =
        process.env.DB_PASSWORD;
}


/* =========================================================
   SSL

   Normally false locally.
   Can be enabled later for hosted PostgreSQL.
========================================================= */

if (
    useSsl ||
    (
        isProduction &&
        process.env.DATABASE_SSL !==
            "false"
    )
) {

    poolConfig.ssl = {
        rejectUnauthorized:
            false
    };
}


/* =========================================================
   CREATE POOL
========================================================= */

const pool =
    new Pool(
        poolConfig
    );


/* =========================================================
   POOL ERROR
========================================================= */

pool.on(
    "error",
    error => {

        console.error(
            "❌ Unexpected PostgreSQL pool error:"
        );

        console.error(
            error
        );
    }
);


/* =========================================================
   QUERY HELPER
========================================================= */

async function query(
    text,
    params = []
) {

    const start =
        Date.now();


    try {

        const result =
            await pool.query(
                text,
                params
            );


        if (
            process.env.NODE_ENV ===
            "development"
        ) {

            const duration =
                Date.now() -
                start;


            console.log(
                `🗄️ DB query ${duration}ms · rows: ${result.rowCount ?? 0}`
            );
        }


        return result;

    } catch (
        error
    ) {

        console.error(
            "❌ PostgreSQL query failed:"
        );


        console.error(
            error.message
        );


        throw error;
    }
}


/* =========================================================
   TRANSACTION HELPER
========================================================= */

async function withTransaction(
    callback
) {

    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const result =
            await callback(
                client
            );


        await client.query(
            "COMMIT"
        );


        return result;

    } catch (
        error
    ) {

        await client.query(
            "ROLLBACK"
        );


        throw error;

    } finally {

        client.release();
    }
}


/* =========================================================
   TEST CONNECTION
========================================================= */

async function testConnection() {

    const client =
        await pool.connect();


    try {

        const result =
            await client.query(`
                SELECT
                    current_database()
                        AS database,
                    current_user
                        AS user,
                    NOW()
                        AS server_time
            `);


        const info =
            result.rows[0];


        console.log(
            "✅ PostgreSQL connected"
        );


        console.log(
            `🗄️ Database: ${info.database}`
        );


        console.log(
            `👤 PostgreSQL user: ${info.user}`
        );


        return info;

    } finally {

        client.release();
    }
}


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function closePool() {

    await pool.end();


    console.log(
        "🛑 PostgreSQL pool closed"
    );
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    pool,

    query,

    withTransaction,

    testConnection,

    closePool

};