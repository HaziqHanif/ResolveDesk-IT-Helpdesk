const {
    query
} = require("../db");

const {
    createNotification
} = require("./notifications");


const TIME_ZONE =
    "Asia/Kuala_Lumpur";

const CHECK_INTERVAL_MS =
    5 * 60 * 1000;


/* =========================================================
   KUALA LUMPUR DATE / TIME
========================================================= */

function getLocalNow() {

    const parts =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    TIME_ZONE,

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hourCycle:
                    "h23"
            }
        )
            .formatToParts(
                new Date()
            );


    const values =
        Object.fromEntries(
            parts
                .filter(
                    part =>
                        part.type !==
                        "literal"
                )
                .map(
                    part => [
                        part.type,
                        part.value
                    ]
                )
        );


    return {
        date:
            `${values.year}-${values.month}-${values.day}`,

        hour:
            Number(
                values.hour
            ),

        minute:
            Number(
                values.minute
            )
    };
}


/* =========================================================
   USER TICKET SUMMARY
========================================================= */

async function getSummaryStats(
    user,
    date
) {

    const result =
        await query(
            `
                SELECT

                    COUNT(*) FILTER (
                        WHERE
                            t.status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )
                    )::INTEGER
                        AS active_tickets,


                    COUNT(*) FILTER (
                        WHERE
                            t.status IN (
                                'RESOLVED',
                                'CLOSED'
                            )

                            AND

                            timezone(
                                $3,
                                COALESCE(
                                    t.resolved_at,
                                    t.closed_at,
                                    t.updated_at
                                )
                            )::DATE =
                                $2::DATE
                    )::INTEGER
                        AS resolved_today,


                    COUNT(*) FILTER (
                        WHERE
                            t.status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )

                            AND

                            COALESCE(
                                t.sla_breached,
                                FALSE
                            ) = TRUE
                    )::INTEGER
                        AS sla_breached,


                    COUNT(*) FILTER (
                        WHERE
                            t.status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )

                            AND

                            t.assigned_to =
                                $1
                    )::INTEGER
                        AS my_queue

                FROM tickets t

                WHERE

                    CASE

                        WHEN
                            $4 = 'ADMIN'
                        THEN
                            TRUE

                        WHEN
                            $4 = 'TECHNICIAN'
                        THEN
                            t.assigned_to =
                                $1

                        ELSE
                            t.requester_id =
                                $1

                    END
            `,
            [
                user.id,
                date,
                TIME_ZONE,
                user.role
            ]
        );


    return (
        result.rows[0] ||
        {
            active_tickets:
                0,

            resolved_today:
                0,

            sla_breached:
                0,

            my_queue:
                0
        }
    );
}


/* =========================================================
   RUN DAILY SUMMARIES
========================================================= */

async function runDailySummaries(
    {
        force = false
    } = {}
) {

    const now =
        getLocalNow();


    /*
     * Normal scheduler sends only
     * after 08:00 Malaysia time.
     *
     * force=true exists only for
     * manual testing.
     */

    if (
        !force &&
        now.hour < 8
    ) {

        return {
            skipped:
                true,

            reason:
                "before_8am",

            date:
                now.date
        };
    }


    const users =
        await query(
            `
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    u.role

                FROM users u

                INNER JOIN user_preferences up
                    ON up.user_id =
                        u.id

                WHERE
                    u.status =
                        'ACTIVE'

                    AND

                    up.daily_summary =
                        TRUE

                    AND

                    up.daily_summary_last_sent_on
                        IS DISTINCT FROM
                        $1::DATE

                ORDER BY
                    u.id ASC
            `,
            [
                now.date
            ]
        );


    let sent =
        0;


    for (
        const user of
        users.rows
    ) {

        const stats =
            await getSummaryStats(
                user,
                now.date
            );


        const active =
            Number(
                stats.active_tickets
            ) || 0;

        const resolved =
            Number(
                stats.resolved_today
            ) || 0;

        const breached =
            Number(
                stats.sla_breached
            ) || 0;

        const myQueue =
            Number(
                stats.my_queue
            ) || 0;


        const summary = [
            `Active tickets: ${active}`,
            `Resolved today: ${resolved}`,
            `SLA breached: ${breached}`
        ];


        if (
            user.role ===
                "ADMIN" ||
            user.role ===
                "TECHNICIAN"
        ) {

            summary.push(
                `My queue: ${myQueue}`
            );
        }


        let link =
            "/tickets.html";


        if (
            user.role ===
            "ADMIN"
        ) {

            link =
                "/dashboard.html";
        }


        if (
            user.role ===
            "TECHNICIAN"
        ) {

            link =
                "/my-queue.html";
        }


        await createNotification({

            userId:
                user.id,

            type:
                "DAILY_SUPPORT_SUMMARY",

            title:
                "Daily Support Summary",

            body:
                summary.join(
                    " • "
                ),

            link
        });


        await query(
            `
                UPDATE user_preferences

                SET
                    daily_summary_last_sent_on =
                        $2::DATE,

                    updated_at =
                        NOW()

                WHERE
                    user_id =
                        $1
            `,
            [
                user.id,
                now.date
            ]
        );


        sent++;
    }


    return {
        success:
            true,

        date:
            now.date,

        sent
    };
}


/* =========================================================
   SCHEDULER
========================================================= */

function startDailySummaryScheduler() {

    const run =
        () => {

            runDailySummaries()
                .then(
                    result => {

                        if (
                            result.sent
                        ) {

                            console.log(
                                `📨 Daily summaries sent: ${result.sent}`
                            );
                        }
                    }
                )
                .catch(
                    error => {

                        console.error(
                            "❌ Daily summary error:",
                            error.message
                        );
                    }
                );
        };


    setTimeout(
        run,
        5000
    );


    setInterval(
        run,
        CHECK_INTERVAL_MS
    );
}


module.exports = {

    runDailySummaries,

    startDailySummaryScheduler
};
