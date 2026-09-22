const express = require("express");

const {
    query
} = require("../db");

const {
    requireAuth
} = require("../middleware/auth");

const {
    requireAdmin
} = require("../middleware/roles");

const {
    writeAudit
} = require("../utils/audit");

const {
    getRuntimeSettings
} = require("../utils/runtime-settings");

const {
    createNotification
} = require("../utils/notifications");


const router = express.Router();

const MAX_TICKETS = 8;


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

function validId(value) {

    return /^\d+$/.test(
        String(value || "")
    );
}


function number(value) {

    return Number(value) || 0;
}


function formatResolution(minutes) {

    const value =
        Math.round(
            number(minutes)
        );


    if (!value) {

        return "—";
    }


    if (value < 60) {

        return `${value}m`;
    }


    const hours =
        Math.floor(
            value / 60
        );

    const mins =
        value % 60;


    if (hours < 24) {

        return `${hours}h ${mins}m`;
    }


    const days =
        Math.floor(
            hours / 24
        );


    return `${days}d ${hours % 24}h`;
}


function technicianObject(row) {

    const activeTickets =
        number(
            row.active_tickets
        );

    const totalAssigned =
        number(
            row.total_assigned
        );

    const slaBreaches =
        number(
            row.sla_breaches
        );


    let availability =
        "available";


    if (
        row.status !==
        "ACTIVE"
    ) {

        availability =
            "offline";

    } else if (
        activeTickets >=
        MAX_TICKETS
    ) {

        availability =
            "busy";
    }


    const specializations =
        Array.isArray(
            row.specializations
        )
            ? row.specializations
            : [];


    if (
        specializations.length === 0 &&
        row.department_name
    ) {

        specializations.push(
            row.department_name
        );
    }


    const slaCompliance =
        totalAssigned > 0
            ? Math.max(
                0,
                Math.round(
                    (
                        totalAssigned -
                        slaBreaches
                    ) /
                    totalAssigned *
                    100
                )
            )
            : 100;


    const tickets =
        Array.isArray(
            row.tickets
        )
            ? row.tickets.map(
                ticket => ({

                    id:
                        ticket.ticket_number ||
                        `#${ticket.id}`,

                    dbId:
                        ticket.id,

                    subject:
                        ticket.subject,

                    priority:
                        String(
                            ticket.priority ||
                            "MEDIUM"
                        ).toLowerCase(),

                    status:
                        ticket.status,

                    dueAt:
                        ticket.resolution_due_at

                })
            )
            : [];


    return {

        id:
            row.id,

        name:
            row.full_name,

        title:
            row.job_title ||
            row.department_name ||
            "IT Technician",

        email:
            row.email,

        departmentId:
            row.department_id,

        department:
            row.department_name ||
            "Unassigned",

        status:
            row.status,

        availability,

        specializations,

        activeTickets,

        maxTickets:
            MAX_TICKETS,

        resolvedToday:
            number(
                row.resolved_today
            ),

        resolvedMonth:
            number(
                row.resolved_month
            ),

        slaCompliance,

        averageResolution:
            formatResolution(
                row.avg_resolution_minutes
            ),

        tickets

    };
}


/* =========================================================
   LIST TECHNICIANS

   GET /api/technicians
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const techResult =
                await query(`
                    SELECT

                        u.id,
                        u.full_name,
                        u.email,
                        u.status,
                        u.job_title,
                        u.department_id,

                        d.name
                            AS department_name,

                        COALESCE(
                            specs.specializations,
                            ARRAY[]::TEXT[]
                        )
                            AS specializations,

                        COALESCE(
                            metrics.active_tickets,
                            0
                        )
                            AS active_tickets,

                        COALESCE(
                            metrics.total_assigned,
                            0
                        )
                            AS total_assigned,

                        COALESCE(
                            metrics.resolved_today,
                            0
                        )
                            AS resolved_today,

                        COALESCE(
                            metrics.resolved_month,
                            0
                        )
                            AS resolved_month,

                        COALESCE(
                            metrics.sla_breaches,
                            0
                        )
                            AS sla_breaches,

                        COALESCE(
                            metrics.avg_resolution_minutes,
                            0
                        )
                            AS avg_resolution_minutes,

                        COALESCE(
                            recent.tickets,
                            '[]'::JSON
                        )
                            AS tickets

                    FROM users u

                    LEFT JOIN departments d
                        ON d.id =
                            u.department_id


                    LEFT JOIN LATERAL (

                        SELECT
                            ARRAY_AGG(
                                c.name::TEXT
                                ORDER BY c.name
                            )
                                AS specializations

                        FROM categories c

                        WHERE
                            c.department_id =
                                u.department_id

                    ) specs
                        ON TRUE


                    LEFT JOIN LATERAL (

                        SELECT

                            COUNT(*)::INTEGER
                                AS total_assigned,

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
                                    COALESCE(
                                        t.resolved_at,
                                        t.closed_at
                                    )::DATE =
                                        CURRENT_DATE
                            )::INTEGER
                                AS resolved_today,

                            COUNT(*) FILTER (
                                WHERE
                                    t.status IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                                    AND
                                    DATE_TRUNC(
                                        'month',
                                        COALESCE(
                                            t.resolved_at,
                                            t.closed_at
                                        )
                                    ) =
                                    DATE_TRUNC(
                                        'month',
                                        NOW()
                                    )
                            )::INTEGER
                                AS resolved_month,

                            COUNT(*) FILTER (
                                WHERE
                                    t.sla_breached = TRUE
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
                            )::INTEGER
                                AS sla_breaches,

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
                                    t.status IN (
                                        'RESOLVED',
                                        'CLOSED'
                                    )
                                    AND
                                    COALESCE(
                                        t.resolved_at,
                                        t.closed_at
                                    ) IS NOT NULL
                            )
                                AS avg_resolution_minutes

                        FROM tickets t

                        WHERE
                            t.assigned_to =
                                u.id

                    ) metrics
                        ON TRUE


                    LEFT JOIN LATERAL (

                        SELECT
                            COALESCE(
                                JSON_AGG(x),
                                '[]'::JSON
                            )
                                AS tickets

                        FROM (

                            SELECT

                                t.id,
                                t.ticket_number,
                                t.subject,
                                t.priority,
                                t.status,
                                t.resolution_due_at

                            FROM tickets t

                            WHERE
                                t.assigned_to =
                                    u.id

                                AND
                                t.status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )

                            ORDER BY

                                CASE t.priority
                                    WHEN 'CRITICAL'
                                        THEN 1
                                    WHEN 'HIGH'
                                        THEN 2
                                    WHEN 'MEDIUM'
                                        THEN 3
                                    ELSE 4
                                END,

                                t.resolution_due_at
                                    NULLS LAST,

                                t.created_at ASC

                            LIMIT 8

                        ) x

                    ) recent
                        ON TRUE


                    WHERE
                        u.role =
                            'TECHNICIAN'

                    ORDER BY

                        CASE
                            WHEN u.status = 'ACTIVE'
                                THEN 1
                            ELSE 2
                        END,

                        u.full_name ASC
                `);


            const ticketResult =
                await query(`
                    SELECT

                        t.id,
                        t.ticket_number,
                        t.subject,
                        t.priority,
                        t.status,
                        t.assigned_to,

                        assignee.full_name
                            AS assignee_name,

                        d.name
                            AS department_name

                    FROM tickets t

                    LEFT JOIN users assignee
                        ON assignee.id =
                            t.assigned_to

                    LEFT JOIN departments d
                        ON d.id =
                            t.department_id

                    WHERE
                        t.status NOT IN (
                            'RESOLVED',
                            'CLOSED'
                        )

                    ORDER BY

                        CASE
                            WHEN t.assigned_to
                                IS NULL
                                THEN 1
                            ELSE 2
                        END,

                        CASE t.priority
                            WHEN 'CRITICAL'
                                THEN 1
                            WHEN 'HIGH'
                                THEN 2
                            WHEN 'MEDIUM'
                                THEN 3
                            ELSE 4
                        END,

                        t.created_at ASC

                    LIMIT 150
                `);


            return res.json({

                success:
                    true,

                technicians:
                    techResult.rows.map(
                        technicianObject
                    ),

                assignmentTickets:
                    ticketResult.rows.map(
                        row => ({

                            id:
                                row.id,

                            ticketNumber:
                                row.ticket_number,

                            subject:
                                row.subject,

                            priority:
                                row.priority,

                            status:
                                row.status,

                            assignedTo:
                                row.assigned_to,

                            assigneeName:
                                row.assignee_name ||
                                null,

                            department:
                                row.department_name ||
                                null

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
   ASSIGN TICKET

   POST /api/technicians/assign
========================================================= */

router.post(
    "/assign",
    async (
        req,
        res,
        next
    ) => {

        try {

            const ticketId =
                req.body?.ticketId;

            const technicianId =
                req.body?.technicianId;


            if (
                !validId(
                    ticketId
                ) ||
                !validId(
                    technicianId
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Valid ticket and technician are required."

                    });
            }


            const technician =
                await query(
                    `
                        SELECT

                            id,
                            full_name,
                            status

                        FROM users

                        WHERE
                            id = $1
                            AND
                            role = 'TECHNICIAN'

                        LIMIT 1
                    `,
                    [
                        technicianId
                    ]
                );


            if (
                technician.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Technician not found."

                    });
            }


            if (
                technician.rows[0]
                    .status !==
                "ACTIVE"
            ) {

                return res
                    .status(409)
                    .json({

                        success:
                            false,

                        message:
                            "Technician is not active."

                    });
            }


            const workload =
                await query(
                    `
                        SELECT
                            COUNT(*)::INTEGER
                                AS total

                        FROM tickets

                        WHERE
                            assigned_to = $1

                            AND
                            status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )

                            AND
                            id <> $2
                    `,
                    [
                        technicianId,
                        ticketId
                    ]
                );


            if (
                number(
                    workload.rows[0]
                        .total
                ) >=
                MAX_TICKETS
            ) {

                return res
                    .status(409)
                    .json({

                        success:
                            false,

                        message:
                            "Technician is at maximum workload."

                    });
            }


            const current =
                await query(
                    `
                       SELECT

    id,

    ticket_number,

    subject,

    assigned_to,

    status

FROM tickets
                        WHERE
                            id = $1

                        LIMIT 1
                    `,
                    [
                        ticketId
                    ]
                );


            if (
                current.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Ticket not found."

                    });
            }


            if (
                [
                    "RESOLVED",
                    "CLOSED"
                ].includes(
                    current.rows[0]
                        .status
                )
            ) {

                return res
                    .status(409)
                    .json({

                        success:
                            false,

                        message:
                            "Completed tickets cannot be assigned."

                    });
            }


            const oldAssignedTo =
                current.rows[0]
                    .assigned_to;


            await query(
                `
                    UPDATE tickets

                    SET
                        assigned_to = $1

                    WHERE
                        id = $2
                `,
                [
                    technicianId,
                    ticketId
                ]
            );


            await query(
                `
                    INSERT INTO ticket_history (

                        ticket_id,
                        actor_id,
                        action,
                        old_value,
                        new_value,
                        metadata

                    )

                    VALUES (

                        $1,
                        $2,
                        'TICKET_ASSIGNED',
                        $3::JSONB,
                        $4::JSONB,
                        $5::JSONB

                    )
                `,
                [
                    ticketId,

                    req.user.id,

                    JSON.stringify({

                        assignedTo:
                            oldAssignedTo

                    }),

                    JSON.stringify({

                        assignedTo:
                            Number(
                                technicianId
                            )

                    }),

                    JSON.stringify({

                        technicianName:
                            technician.rows[0]
                                .full_name

                    })
                ]
            );

          /* =================================
   ASSIGNMENT NOTIFICATION
================================= */

const runtimeSettings =
    await getRuntimeSettings();

if (
    runtimeSettings
        ?.notifications
        ?.assignment === true &&
    Number(oldAssignedTo) !==
        Number(technicianId)
) {

    await createNotification({

        userId:
            Number(
                technicianId
            ),

        type:
            "TICKET_ASSIGNED",

        title:
            `Ticket ${
                current.rows[0]
                    .ticket_number
            } assigned to you`,

        body:
            current.rows[0]
                .subject,

        link:
            `/ticket-detail.html?id=${ticketId}`

    });
}  


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "TICKET_ASSIGNED",

                entityType:
                    "TICKET",

                entityId:
                    ticketId,

                metadata: {

                    ticketNumber:
                        current.rows[0]
                            .ticket_number,

                    oldAssignedTo,

                    assignedTo:
                        Number(
                            technicianId
                        ),

                    technicianName:
                        technician.rows[0]
                            .full_name

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Ticket assigned successfully."

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