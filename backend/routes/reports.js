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


const router =
    express.Router();


/* =========================================================
   SECURITY
========================================================= */

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
            value || ""
        )
    );
}


function normalizePeriod(
    value
) {

    const allowed =
        [
            7,
            30,
            90,
            365
        ];


    const parsed =
        Number(
            value
        );


    return allowed.includes(
        parsed
    )
        ? parsed
        : 30;
}


function integer(
    value
) {

    return Number(
        value
    ) || 0;
}


function percent(
    successful,
    total
) {

    const denominator =
        integer(
            total
        );


    if (
        denominator <= 0
    ) {

        return 100;
    }


    return Math.max(
        0,
        Math.min(
            100,
            Math.round(
                integer(
                    successful
                ) /
                denominator *
                100
            )
        )
    );
}


/* =========================================================
   GET REPORT OVERVIEW

   GET /api/reports/overview

   ?period=30
   &departmentId=1
   &categoryId=2
========================================================= */

router.get(
    "/overview",
    async (
        req,
        res,
        next
    ) => {

        try {

            const period =
                normalizePeriod(
                    req.query.period
                );


            const departmentId =
                validId(
                    req.query.departmentId
                )
                    ? Number(
                        req.query.departmentId
                    )
                    : null;


            const categoryId =
                validId(
                    req.query.categoryId
                )
                    ? Number(
                        req.query.categoryId
                    )
                    : null;


            const values =
                [
                    period
                ];


            const conditions =
                [
                    `
                        t.created_at >=
                            NOW() -
                            (
                                $1::INTEGER *
                                INTERVAL '1 day'
                            )
                    `
                ];


            if (
                departmentId !==
                null
            ) {

                values.push(
                    departmentId
                );


                conditions.push(
                    `t.department_id = $${values.length}`
                );
            }


            if (
                categoryId !==
                null
            ) {

                values.push(
                    categoryId
                );


                conditions.push(
                    `t.category_id = $${values.length}`
                );
            }


            const where =
                conditions.join(
                    " AND "
                );


            /* =============================================
               FILTER OPTIONS
            ============================================= */

            const [
                departmentOptions,
                categoryOptions
            ] =
                await Promise.all([

                    query(`
                        SELECT

                            id,
                            name,
                            code

                        FROM departments

                        WHERE
                            is_active = TRUE

                        ORDER BY
                            name ASC
                    `),

                    query(`
                        SELECT

                            c.id,
                            c.name,
                            c.department_id,

                            d.name
                                AS department_name

                        FROM categories c

                        LEFT JOIN departments d
                            ON d.id =
                                c.department_id

                        ORDER BY
                            c.name ASC
                    `)

                ]);


            /* =============================================
               MAIN KPI
            ============================================= */

            const statsResult =
                await query(
                    `
                        SELECT

                            COUNT(*)::INTEGER
                                AS total_tickets,

                            COUNT(*) FILTER (
                                WHERE
                                    t.status IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                            )::INTEGER
                                AS resolved_tickets,

                            COUNT(*) FILTER (
                                WHERE
                                    t.status NOT IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                            )::INTEGER
                                AS active_tickets,


                            AVG(
                                EXTRACT(
                                    EPOCH FROM (
                                        COALESCE(
                                            t.resolved_at,
                                            t.closed_at
                                        )
                                        -
                                        t.created_at
                                    )
                                ) / 60
                            )
                            FILTER (
                                WHERE
                                    COALESCE(
                                        t.resolved_at,
                                        t.closed_at
                                    ) IS NOT NULL
                            )
                                AS avg_resolution_minutes,


                            AVG(
                                EXTRACT(
                                    EPOCH FROM (
                                        t.first_response_at
                                        -
                                        t.created_at
                                    )
                                ) / 60
                            )
                            FILTER (
                                WHERE
                                    t.first_response_at
                                        IS NOT NULL
                            )
                                AS avg_first_response_minutes,


                            COUNT(*) FILTER (
                                WHERE
                                    t.resolution_due_at
                                        IS NOT NULL
                            )::INTEGER
                                AS resolution_tracked,


                            COUNT(*) FILTER (
                                WHERE
                                    t.resolution_due_at
                                        IS NOT NULL

                                    AND (

                                        t.sla_breached =
                                            TRUE

                                        OR (

                                            COALESCE(
                                                t.resolved_at,
                                                t.closed_at
                                            )
                                                IS NOT NULL

                                            AND

                                            COALESCE(
                                                t.resolved_at,
                                                t.closed_at
                                            ) >
                                                t.resolution_due_at
                                        )

                                        OR (

                                            COALESCE(
                                                t.resolved_at,
                                                t.closed_at
                                            )
                                                IS NULL

                                            AND

                                            NOW() >
                                                t.resolution_due_at
                                        )

                                    )
                            )::INTEGER
                                AS resolution_breached,


                            COUNT(*) FILTER (
                                WHERE
                                    t.first_response_due_at
                                        IS NOT NULL
                            )::INTEGER
                                AS response_tracked,


                            COUNT(*) FILTER (
                                WHERE
                                    t.first_response_due_at
                                        IS NOT NULL

                                    AND (

                                        (

                                            t.first_response_at
                                                IS NOT NULL

                                            AND

                                            t.first_response_at >
                                                t.first_response_due_at
                                        )

                                        OR (

                                            t.first_response_at
                                                IS NULL

                                            AND

                                            NOW() >
                                                t.first_response_due_at
                                        )

                                    )
                            )::INTEGER
                                AS response_breached

                        FROM tickets t

                        WHERE
                            ${where}
                    `,
                    values
                );


            const stat =
                statsResult.rows[0];


            const resolutionTracked =
                integer(
                    stat.resolution_tracked
                );


            const resolutionBreached =
                integer(
                    stat.resolution_breached
                );


            const responseTracked =
                integer(
                    stat.response_tracked
                );


            const responseBreached =
                integer(
                    stat.response_breached
                );


            const resolutionCompliance =
                percent(

                    resolutionTracked -
                        resolutionBreached,

                    resolutionTracked
                );


            const responseCompliance =
                percent(

                    responseTracked -
                        responseBreached,

                    responseTracked
                );


            /* =============================================
               CATEGORY BREAKDOWN
            ============================================= */

            const categoriesResult =
                await query(
                    `
                        SELECT

                            COALESCE(
                                c.id,
                                0
                            )
                                AS id,

                            COALESCE(
                                c.name,
                                'Uncategorised'
                            )
                                AS name,

                            COUNT(*)::INTEGER
                                AS total

                        FROM tickets t

                        LEFT JOIN categories c
                            ON c.id =
                                t.category_id

                        WHERE
                            ${where}

                        GROUP BY
                            c.id,
                            c.name

                        ORDER BY
                            total DESC,
                            name ASC
                    `,
                    values
                );


            /* =============================================
               PRIORITY BREAKDOWN
            ============================================= */

            const priorityResult =
                await query(
                    `
                        SELECT

                            t.priority,

                            COUNT(*)::INTEGER
                                AS total

                        FROM tickets t

                        WHERE
                            ${where}

                        GROUP BY
                            t.priority

                        ORDER BY

                            CASE
                                t.priority

                                WHEN 'CRITICAL'
                                    THEN 1

                                WHEN 'HIGH'
                                    THEN 2

                                WHEN 'MEDIUM'
                                    THEN 3

                                ELSE 4
                            END
                    `,
                    values
                );


            /* =============================================
               STATUS BREAKDOWN
            ============================================= */

            const statusResult =
                await query(
                    `
                        SELECT

                            t.status,

                            COUNT(*)::INTEGER
                                AS total

                        FROM tickets t

                        WHERE
                            ${where}

                        GROUP BY
                            t.status

                        ORDER BY
                            t.status ASC
                    `,
                    values
                );


            /* =============================================
               TECHNICIAN PERFORMANCE
            ============================================= */

            const technicianResult =
                await query(
                    `
                        SELECT

                            u.id,

                            u.full_name,

                            COALESCE(
                                u.job_title,
                                d.name,
                                'IT Technician'
                            )
                                AS specialty,


                            COUNT(*) FILTER (
                                WHERE
                                    t.status IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                            )::INTEGER
                                AS resolved,


                            COUNT(*) FILTER (
                                WHERE
                                    t.status NOT IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                            )::INTEGER
                                AS active,


                            AVG(
                                EXTRACT(
                                    EPOCH FROM (
                                        COALESCE(
                                            t.resolved_at,
                                            t.closed_at
                                        )
                                        -
                                        t.created_at
                                    )
                                ) / 60
                            )
                            FILTER (
                                WHERE
                                    COALESCE(
                                        t.resolved_at,
                                        t.closed_at
                                    ) IS NOT NULL
                            )
                                AS average_resolution_minutes,


                            COUNT(*) FILTER (
                                WHERE
                                    t.resolution_due_at
                                        IS NOT NULL
                            )::INTEGER
                                AS sla_tracked,


                            COUNT(*) FILTER (
                                WHERE
                                    t.resolution_due_at
                                        IS NOT NULL

                                    AND (

                                        t.sla_breached =
                                            TRUE

                                        OR (

                                            COALESCE(
                                                t.resolved_at,
                                                t.closed_at
                                            )
                                                IS NOT NULL

                                            AND

                                            COALESCE(
                                                t.resolved_at,
                                                t.closed_at
                                            ) >
                                                t.resolution_due_at
                                        )

                                        OR (

                                            COALESCE(
                                                t.resolved_at,
                                                t.closed_at
                                            )
                                                IS NULL

                                            AND

                                            NOW() >
                                                t.resolution_due_at
                                        )

                                    )
                            )::INTEGER
                                AS sla_breached


                        FROM tickets t

                        JOIN users u
                            ON u.id =
                                t.assigned_to

                        LEFT JOIN departments d
                            ON d.id =
                                u.department_id

                        WHERE
                            ${where}

                            AND
                            u.role =
                                'TECHNICIAN'

                        GROUP BY

                            u.id,
                            u.full_name,
                            u.job_title,
                            d.name

                        ORDER BY

                            resolved DESC,
                            active DESC,
                            u.full_name ASC
                    `,
                    values
                );


            const technicians =
                technicianResult.rows.map(
                    row => {

                        const tracked =
                            integer(
                                row.sla_tracked
                            );


                        const breached =
                            integer(
                                row.sla_breached
                            );


                        return {

                            id:
                                row.id,

                            name:
                                row.full_name,

                            specialty:
                                row.specialty,

                            resolved:
                                integer(
                                    row.resolved
                                ),

                            active:
                                integer(
                                    row.active
                                ),

                            averageMinutes:
                                Math.round(
                                    Number(
                                        row.average_resolution_minutes
                                    ) ||
                                    0
                                ),

                            sla:
                                percent(
                                    tracked -
                                        breached,
                                    tracked
                                )

                        };
                    }
                );


            /* =============================================
               DAILY TREND

               Return one row per day.
               Frontend will compress larger periods
               into chart buckets.
            ============================================= */

            const trendResult =
                await query(
                    `
                        WITH date_series AS (

                            SELECT
                                GENERATE_SERIES(

                                    CURRENT_DATE -
                                        (
                                            $1::INTEGER -
                                            1
                                        ),

                                    CURRENT_DATE,

                                    INTERVAL '1 day'

                                )::DATE
                                    AS report_date

                        ),

                        filtered AS (

                            SELECT
                                t.*

                            FROM tickets t

                            WHERE
                                ${where}

                        )

                        SELECT

                            ds.report_date,

                            COUNT(f.id) FILTER (
                                WHERE
                                    f.created_at::DATE =
                                        ds.report_date
                            )::INTEGER
                                AS created,

                            COUNT(f.id) FILTER (
                                WHERE
                                    COALESCE(
                                        f.resolved_at,
                                        f.closed_at
                                    )::DATE =
                                        ds.report_date
                            )::INTEGER
                                AS resolved

                        FROM date_series ds

                        LEFT JOIN filtered f
                            ON (
                                f.created_at::DATE =
                                    ds.report_date

                                OR

                                COALESCE(
                                    f.resolved_at,
                                    f.closed_at
                                )::DATE =
                                    ds.report_date
                            )

                        GROUP BY
                            ds.report_date

                        ORDER BY
                            ds.report_date ASC
                    `,
                    values
                );


            /* =============================================
               REOPEN RATE
            ============================================= */

            const reopenResult =
                await query(
                    `
                        SELECT

                            COUNT(
                                DISTINCT t.id
                            )
                            FILTER (
                                WHERE
                                    th.new_value->>'status'
                                        IN (
                                            'RESOLVED',
                                            'CLOSED'
                                        )
                            )::INTEGER
                                AS resolved_ever,


                            COUNT(
                                DISTINCT t.id
                            )
                            FILTER (
                                WHERE
                                    th.old_value->>'status'
                                        IN (
                                            'RESOLVED',
                                            'CLOSED'
                                        )

                                    AND

                                    th.new_value->>'status' =
                                        'IN_PROGRESS'
                            )::INTEGER
                                AS reopened

                        FROM tickets t

                        LEFT JOIN ticket_history th
                            ON th.ticket_id =
                                t.id

                        WHERE
                            ${where}
                    `,
                    values
                );


            const reopened =
                integer(
                    reopenResult.rows[0]
                        .reopened
                );


            const resolvedEver =
                integer(
                    reopenResult.rows[0]
                        .resolved_ever
                );


            const reopenRate =
                resolvedEver > 0
                    ? Math.round(
                        reopened /
                        resolvedEver *
                        1000
                    ) / 10
                    : 0;


            /* =============================================
               RESPONSE
            ============================================= */

            return res.json({

                success:
                    true,

                filters: {

                    period,

                    departmentId,

                    categoryId

                },

                options: {

                    departments:
                        departmentOptions.rows.map(
                            row => ({

                                id:
                                    row.id,

                                name:
                                    row.name,

                                code:
                                    row.code

                            })
                        ),

                    categories:
                        categoryOptions.rows.map(
                            row => ({

                                id:
                                    row.id,

                                name:
                                    row.name,

                                departmentId:
                                    row.department_id,

                                department:
                                    row.department_name ||
                                    null

                            })
                        )

                },

                stats: {

                    totalTickets:
                        integer(
                            stat.total_tickets
                        ),

                    resolvedTickets:
                        integer(
                            stat.resolved_tickets
                        ),

                    activeTickets:
                        integer(
                            stat.active_tickets
                        ),

                    averageResolutionMinutes:
                        Math.round(
                            Number(
                                stat.avg_resolution_minutes
                            ) ||
                            0
                        ),

                    averageFirstResponseMinutes:
                        Math.round(
                            Number(
                                stat.avg_first_response_minutes
                            ) ||
                            0
                        ),

                    slaCompliance:
                        resolutionCompliance,

                    responseSla:
                        responseCompliance,

                    resolutionSla:
                        resolutionCompliance,

                    withinSla:
                        Math.max(
                            0,
                            resolutionTracked -
                                resolutionBreached
                        ),

                    breached:
                        resolutionBreached,

                    reopenRate

                },

                categories:
                    categoriesResult.rows.map(
                        row => ({

                            id:
                                row.id,

                            name:
                                row.name,

                            total:
                                integer(
                                    row.total
                                )

                        })
                    ),

                priorities:
                    priorityResult.rows.map(
                        row => ({

                            priority:
                                row.priority,

                            total:
                                integer(
                                    row.total
                                )

                        })
                    ),

                statuses:
                    statusResult.rows.map(
                        row => ({

                            status:
                                row.status,

                            total:
                                integer(
                                    row.total
                                )

                        })
                    ),

                technicians,

                trend:
                    trendResult.rows.map(
                        row => ({

                            date:
                                row.report_date,

                            created:
                                integer(
                                    row.created
                                ),

                            resolved:
                                integer(
                                    row.resolved
                                )

                        })
                    ),

                summary: {

                    firstResponseMinutes:
                        Math.round(
                            Number(
                                stat.avg_first_response_minutes
                            ) ||
                            0
                        ),

                    reopenRate,

                    /*
                        No trustworthy KB-deflection
                        measurement exists in this
                        report endpoint yet.

                        Do not invent a percentage.
                    */
                    selfServiceRate:
                        null

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