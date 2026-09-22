require("dotenv").config();

const fs =
    require("fs");

const path =
    require("path");

const {
    Client
} =
    require("pg");


/* =========================================================
   PATHS
========================================================= */

const projectFolder =
    path.join(
        __dirname,
        ".."
    );


const schemaFile =
    path.join(
        projectFolder,
        "database",
        "schema.sql"
    );


const seedFile =
    path.join(
        projectFolder,
        "database",
        "seed.sql"
    );


/* =========================================================
   CONFIG
========================================================= */

const DB_HOST =
    process.env.DB_HOST ||
    "127.0.0.1";


const DB_PORT =
    Number(
        process.env.DB_PORT
    ) ||
    5432;


const DB_NAME =
    process.env.DB_NAME ||
    "resolvedesk";


const DB_USER =
    process.env.DB_USER ||
    process.env.USER;


const DB_PASSWORD =
    process.env.DB_PASSWORD ||
    undefined;


const DATABASE_SSL =
    String(
        process.env.DATABASE_SSL ||
        "false"
    ).toLowerCase() ===
    "true";


const RESET_DATABASE =
    process.argv.includes(
        "--reset"
    );


/* =========================================================
   VALIDATE DATABASE NAME
========================================================= */

function validateDatabaseName(
    name
) {

    if (
        !/^[a-zA-Z0-9_-]+$/.test(
            name
        )
    ) {

        throw new Error(
            "DB_NAME contains unsupported characters."
        );
    }
}


/* =========================================================
   QUOTE IDENTIFIER
========================================================= */

function quoteIdentifier(
    value
) {

    return `"${String(
        value
    ).replaceAll(
        '"',
        '""'
    )}"`;
}


/* =========================================================
   CONNECTION CONFIG
========================================================= */

function createConfig(
    database
) {

    const config = {

        host:
            DB_HOST,

        port:
            DB_PORT,

        database,

        user:
            DB_USER

    };


    if (
        DB_PASSWORD
    ) {

        config.password =
            DB_PASSWORD;
    }


    if (
        DATABASE_SSL
    ) {

        config.ssl = {

            rejectUnauthorized:
                false

        };
    }


    return config;
}


/* =========================================================
   READ SQL FILE
========================================================= */

function readSqlFile(
    filePath
) {

    if (
        !fs.existsSync(
            filePath
        )
    ) {

        throw new Error(
            `SQL file not found: ${filePath}`
        );
    }


    return fs.readFileSync(
        filePath,
        "utf8"
    );
}


/* =========================================================
   CREATE DATABASE IF NEEDED
========================================================= */

async function ensureDatabase() {

    const client =
        new Client(
            createConfig(
                "postgres"
            )
        );


    await client.connect();


    try {

        const result =
            await client.query(
                `
                    SELECT 1
                    FROM pg_database
                    WHERE datname = $1
                `,
                [
                    DB_NAME
                ]
            );


        if (
            result.rowCount >
            0
        ) {

            console.log(
                `✅ Database "${DB_NAME}" already exists.`
            );


            return false;
        }


        console.log(
            `🛠️ Creating database "${DB_NAME}"...`
        );


        await client.query(
            `CREATE DATABASE ${quoteIdentifier(
                DB_NAME
            )}`
        );


        console.log(
            `✅ Database "${DB_NAME}" created.`
        );


        return true;

    } finally {

        await client.end();
    }
}


/* =========================================================
   GET TABLE COUNT
========================================================= */

async function getTableCount(
    client
) {

    const result =
        await client.query(`
            SELECT
                COUNT(*)::INTEGER
                    AS total
            FROM
                information_schema.tables
            WHERE
                table_schema = 'public'
                AND table_type = 'BASE TABLE'
        `);


    return Number(
        result.rows[0].total
    );
}


/* =========================================================
   RUN SCHEMA
========================================================= */

async function runSchema(
    client
) {

    console.log(
        "\n🏗️ Running database/schema.sql..."
    );


    const sql =
        readSqlFile(
            schemaFile
        );


    await client.query(
        sql
    );


    console.log(
        "✅ Database schema created."
    );
}


/* =========================================================
   RUN SEED
========================================================= */

async function runSeed(
    client
) {

    console.log(
        "\n🌱 Running database/seed.sql..."
    );


    const sql =
        readSqlFile(
            seedFile
        );


    await client.query(
        sql
    );


    console.log(
        "✅ Seed data inserted."
    );
}


/* =========================================================
   VERIFY DATABASE
========================================================= */

async function verifyDatabase(
    client
) {

    console.log(
        "\n🔍 Verifying ResolveDesk database..."
    );


    const result =
        await client.query(`
            SELECT

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM departments
                )
                    AS departments,

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM categories
                )
                    AS categories,

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM sla_policies
                )
                    AS sla_policies,

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM knowledge_base
                )
                    AS knowledge_articles,

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM app_settings
                )
                    AS app_settings,

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM users
                )
                    AS users,

                (
                    SELECT
                        COUNT(*)::INTEGER
                    FROM tickets
                )
                    AS tickets
        `);


    const counts =
        result.rows[0];


    const tableCount =
        await getTableCount(
            client
        );


    console.log(
        "\n========================================"
    );

    console.log(
        "       RESOLVEDESK DATABASE"
    );

    console.log(
        "========================================"
    );


    console.log(
        `🗄️ Database: ${DB_NAME}`
    );


    console.log(
        `👤 PostgreSQL User: ${DB_USER}`
    );


    console.log(
        `📦 Tables: ${tableCount}`
    );


    console.log(
        `🏢 Departments: ${counts.departments}`
    );


    console.log(
        `🏷️ Categories: ${counts.categories}`
    );


    console.log(
        `⏱️ SLA Policies: ${counts.sla_policies}`
    );


    console.log(
        `📚 Knowledge Articles: ${counts.knowledge_articles}`
    );


    console.log(
        `⚙️ App Settings: ${counts.app_settings}`
    );


    console.log(
        `👥 Users: ${counts.users}`
    );


    console.log(
        `🎫 Tickets: ${counts.tickets}`
    );


    console.log(
        "========================================"
    );
}


/* =========================================================
   INITIALIZE DATABASE
========================================================= */

async function initializeDatabase() {

    console.log(
        "\n========================================"
    );

    console.log(
        "       RESOLVEDESK DB INITIALIZER"
    );

    console.log(
        "========================================\n"
    );


    validateDatabaseName(
        DB_NAME
    );


    console.log(
        `Host     : ${DB_HOST}`
    );


    console.log(
        `Port     : ${DB_PORT}`
    );


    console.log(
        `Database : ${DB_NAME}`
    );


    console.log(
        `User     : ${DB_USER}`
    );


    if (
        !DB_USER
    ) {

        throw new Error(
            "DB_USER is not configured."
        );
    }


    const databaseCreated =
        await ensureDatabase();


    const client =
        new Client(
            createConfig(
                DB_NAME
            )
        );


    await client.connect();


    try {

        console.log(
            "\n✅ Connected to PostgreSQL."
        );


        const existingTables =
            await getTableCount(
                client
            );


        /* =================================================
           NEW / EMPTY DATABASE
        ================================================= */

        if (
            databaseCreated ||
            existingTables ===
                0
        ) {

            await runSchema(
                client
            );


            await runSeed(
                client
            );

        }

        /* =================================================
           EXPLICIT RESET
        ================================================= */

        else if (
            RESET_DATABASE
        ) {

            console.log(
                "\n⚠️ RESET MODE ENABLED"
            );


            console.log(
                "⚠️ Existing ResolveDesk tables and data will be rebuilt."
            );


            await runSchema(
                client
            );


            await runSeed(
                client
            );

        }

        /* =================================================
           DATABASE ALREADY INITIALIZED
        ================================================= */

        else {

            console.log(
                `\nℹ️ Database already contains ${existingTables} tables.`
            );


            console.log(
                "ℹ️ Skipping schema.sql to protect existing data."
            );


            console.log(
                "🌱 Applying safe seed updates..."
            );


            await runSeed(
                client
            );
        }


        await verifyDatabase(
            client
        );


        console.log(
            "\n✅ ResolveDesk database initialization complete.\n"
        );

    } finally {

        await client.end();
    }
}


/* =========================================================
   RUN
========================================================= */

initializeDatabase()
    .catch(
        error => {

            console.error(
                "\n❌ ResolveDesk database initialization failed."
            );


            console.error(
                error.message
            );


            if (
                process.env.NODE_ENV ===
                "development"
            ) {

                console.error(
                    error
                );
            }


            process.exitCode =
                1;
        }
    );