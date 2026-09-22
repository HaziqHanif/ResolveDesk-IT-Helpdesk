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
    requireSupport
} =
    require("../middleware/roles");


const {
    writeAudit
} =
    require("../utils/audit");

    const {
    createNotification
} =
    require("../utils/notifications");


const {
    normalizePrefix,
    formatTicketNumber
} =
    require("../utils/ticket-number");


const {
    normalizePriority,
    getDefaultSla,
    calculateSlaDeadlines,
    getSlaStatus
} =
    require("../utils/sla");

    const {
    getRuntimeSettings
} =
    require("../utils/runtime-settings");


const router =
    express.Router();


/* =========================================================
   ALL TICKET ROUTES REQUIRE LOGIN
========================================================= */

router.use(
    requireAuth
);


/* =========================================================
   CONSTANTS
========================================================= */

const ALLOWED_PRIORITIES = [
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
];


const ALLOWED_STATUSES = [
    "OPEN",
    "IN_PROGRESS",
    "PENDING",
    "RESOLVED",
    "CLOSED"
];


const STATUS_TRANSITIONS = {

    OPEN: [
        "IN_PROGRESS",
        "PENDING",
        "RESOLVED"
    ],

    IN_PROGRESS: [
        "OPEN",
        "PENDING",
        "RESOLVED"
    ],

    PENDING: [
        "IN_PROGRESS",
        "RESOLVED"
    ],

    RESOLVED: [
        "IN_PROGRESS",
        "CLOSED"
    ],

    CLOSED: [
        "IN_PROGRESS"
    ]

};

/* =========================================================
   AUTO ASSIGNMENT
========================================================= */

const AUTO_ASSIGN_MAX_TICKETS =
    8;


async function findAutoAssignee(
    client,
    departmentId
) {

    const result =
        await client.query(
            `
                SELECT
                    u.id,
                    u.full_name,
                    u.department_id,

                    workload.active_tickets

                FROM users u

                CROSS JOIN LATERAL (

                    SELECT
                        COUNT(*)::INTEGER
                            AS active_tickets

                    FROM tickets t

                    WHERE
                        t.assigned_to =
                            u.id

                        AND
                        t.status NOT IN (
                            'RESOLVED',
                            'CLOSED'
                        )

                ) workload

                WHERE
                    u.role =
                        'TECHNICIAN'

                    AND
                    u.status =
                        'ACTIVE'

                    AND
                    u.department_id =
                        $1

                    AND
                    workload.active_tickets <
                        $2

                ORDER BY
                    workload.active_tickets ASC,
                    u.id ASC

                LIMIT 1
            `,
            [
                departmentId,
                AUTO_ASSIGN_MAX_TICKETS
            ]
        );


    return (
        result.rows[0] ||
        null
    );
}


/* =========================================================
   SYNC SLA BREACH STATUS
========================================================= */

async function syncSlaWarnings() {

    const runtimeSettings =
        await getRuntimeSettings();

    if (
        runtimeSettings
            ?.notifications
            ?.sla !== true
    ) {
        return 0;
    }

    return withTransaction(
        async client => {

            const warnings =
                await client.query(
                    `
                        SELECT
                            t.id,
                            t.ticket_number,
                            t.subject,
                            t.priority,
                            t.assigned_to,
                            t.department_id,
                            t.first_response_due_at AS due_at,
                            'FIRST_RESPONSE' AS warning_kind
                        FROM tickets t
                        WHERE
                            t.status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )
                            AND COALESCE(
                                t.sla_breached,
                                FALSE
                            ) = FALSE
                            AND t.first_response_at IS NULL
                            AND t.first_response_due_at IS NOT NULL
                            AND t.first_response_due_at > NOW()
                            AND t.first_response_due_at
                                <= NOW() + INTERVAL '15 minutes'

                        UNION ALL

                        SELECT
                            t.id,
                            t.ticket_number,
                            t.subject,
                            t.priority,
                            t.assigned_to,
                            t.department_id,
                            t.resolution_due_at AS due_at,
                            'RESOLUTION' AS warning_kind
                        FROM tickets t
                        WHERE
                            t.status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )
                            AND COALESCE(
                                t.sla_breached,
                                FALSE
                            ) = FALSE
                            AND t.resolved_at IS NULL
                            AND t.resolution_due_at IS NOT NULL
                            AND t.resolution_due_at > NOW()
                            AND t.resolution_due_at
                                <= NOW() + INTERVAL '30 minutes'

                        ORDER BY due_at ASC
                    `
                );

            let createdCount = 0;

            for (const ticket of warnings.rows) {

                const recipients =
                    await client.query(
                        `
                            SELECT id
                            FROM users
                            WHERE
                                status = 'ACTIVE'
                                AND (
                                    role = 'ADMIN'
                                    OR (
                                        $1::BIGINT IS NOT NULL
                                        AND role = 'TECHNICIAN'
                                        AND id = $1::BIGINT
                                    )
                                    OR (
                                        $1::BIGINT IS NULL
                                        AND role = 'TECHNICIAN'
                                        AND department_id =
                                            $2::BIGINT
                                    )
                                )
                            ORDER BY id ASC
                        `,
                        [
                            ticket.assigned_to,
                            ticket.department_id
                        ]
                    );

                const uniqueRecipients = [
                    ...new Set(
                        recipients.rows.map(
                            row => String(row.id)
                        )
                    )
                ];

                const firstResponse =
                    ticket.warning_kind ===
                    "FIRST_RESPONSE";

                const title =
                    firstResponse
                        ? `SLA warning: ${ticket.ticket_number} · First response`
                        : `SLA warning: ${ticket.ticket_number} · Resolution`;

                const body =
                    firstResponse
                        ? `${ticket.subject} · ${ticket.priority} priority · First response SLA due within 15 minutes`
                        : `${ticket.subject} · ${ticket.priority} priority · Resolution SLA due within 30 minutes`;

                const link =
                    `/ticket-detail.html?id=${ticket.id}`;

                for (const userId of uniqueRecipients) {

                    const existingWarning =
                        await client.query(
                            `
                                SELECT id
                                FROM notifications
                                WHERE
                                    user_id = $1::BIGINT
                                    AND type = 'SLA_WARNING'
                                    AND title = $2
                                    AND link = $3
                                LIMIT 1
                            `,
                            [
                                userId,
                                title,
                                link
                            ]
                        );

                    if (existingWarning.rowCount > 0) {
                        continue;
                    }

                    await createNotification({
                        client,
                        userId,
                        type: "SLA_WARNING",
                        title,
                        body,
                        link
                    });

                    createdCount += 1;
                }
            }

            return createdCount;
        }
    );
}


/* =========================================================
   SYNC SLA BREACH STATUS
========================================================= */

async function syncSlaBreaches() {

    const runtimeSettings =
        await getRuntimeSettings();


    return withTransaction(
        async client => {

            /*
                Only change tickets that have
                newly crossed an SLA deadline.

                Once a ticket has breached,
                repeated sync calls will not
                return it again.
            */

            const breached =
                await client.query(
                    `
                        UPDATE tickets

                        SET
                            sla_breached = TRUE

                        WHERE
                            COALESCE(
                                sla_breached,
                                FALSE
                            ) = FALSE

                            AND

                            (
                                (
                                    first_response_due_at
                                        IS NOT NULL

                                    AND

                                    COALESCE(
                                        first_response_at,
                                        NOW()
                                    ) >
                                        first_response_due_at
                                )

                                OR

                                (
                                    resolution_due_at
                                        IS NOT NULL

                                    AND

                                    COALESCE(
                                        resolved_at,
                                        NOW()
                                    ) >
                                        resolution_due_at
                                )
                            )

                        RETURNING
                            id,
                            ticket_number,
                            subject,
                            priority,
                            requester_id,
                            assigned_to,
                            department_id,
                            first_response_due_at,
                            resolution_due_at,
                            first_response_at,
                            resolved_at
                    `
                );


            if (
                breached.rowCount ===
                0
            ) {

                return 0;
            }


            /*
                SLA notifications can be
                disabled independently from
                SLA breach tracking.
            */

            if (
                runtimeSettings
                    ?.notifications
                    ?.sla !==
                true
            ) {

                return breached.rowCount;
            }


            for (
                const ticket of
                breached.rows
            ) {

                /*
                    Notify:
                    - all ACTIVE admins
                    - assigned ACTIVE technician
                    - if unassigned, ACTIVE technicians
                      in the ticket department
                */

                const recipients =
                    await client.query(
                        `
                            SELECT
                                id

                            FROM users

                            WHERE
                                status = 'ACTIVE'

                                AND

                                (
                                    role = 'ADMIN'

                                    OR

                                    (
                                        $1::BIGINT
                                            IS NOT NULL

                                        AND

                                        role =
                                            'TECHNICIAN'

                                        AND

                                        id =
                                            $1::BIGINT
                                    )

                                    OR

                                    (
                                        $1::BIGINT
                                            IS NULL

                                        AND

                                        role =
                                            'TECHNICIAN'

                                        AND

                                        department_id =
                                            $2::BIGINT
                                    )
                                )

                            ORDER BY
                                id ASC
                        `,
                        [
                            ticket.assigned_to,
                            ticket.department_id
                        ]
                    );


                const uniqueRecipients =
                    [
                        ...new Set(
                            recipients.rows.map(
                                row =>
                                    String(
                                        row.id
                                    )
                            )
                        )
                    ];


                for (
                    const userId of
                    uniqueRecipients
                ) {

                    await createNotification({

                        client,

                        userId,

                        type:
                            "SLA_BREACH",

                        title:
                            `SLA breached: ${ticket.ticket_number}`,

                        body:
                            `${ticket.subject} · ${ticket.priority} priority`,

                        link:
                            `/ticket-detail.html?id=${ticket.id}`

                    });
                }
            }


            return breached.rowCount;
        }
    );
}


/* =========================================================
   COMMON SELECT
========================================================= */

/* =========================================================
   COMMON SELECT
========================================================= */

const ticketSelect = `
    SELECT
        t.id,
        t.ticket_number,
        t.subject,
        t.description,

        t.requester_id,
        requester.full_name
            AS requester_name,
        requester.email
            AS requester_email,

        t.assigned_to,
        assignee.full_name
            AS assignee_name,
        assignee.email
            AS assignee_email,

        t.department_id,
        d.name
            AS department_name,
        d.code
            AS department_code,

        t.category_id,
        c.name
            AS category_name,

        t.sla_policy_id,
        sp.name
            AS sla_policy_name,

        t.priority,
        t.status,
        t.source,

        t.first_response_due_at,
        t.resolution_due_at,
        t.first_response_at,
        t.resolved_at,
        t.closed_at,

        t.resolution_note,
        t.sla_breached,

        t.created_at,
        t.updated_at

    FROM tickets t

    JOIN users requester
        ON requester.id =
            t.requester_id

    LEFT JOIN users assignee
        ON assignee.id =
            t.assigned_to

    LEFT JOIN departments d
        ON d.id =
            t.department_id

    LEFT JOIN categories c
        ON c.id =
            t.category_id

    LEFT JOIN sla_policies sp
        ON sp.id =
            t.sla_policy_id
`;


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


function safeText(
    value
) {

    return String(
        value || ""
    ).trim();
}


function ticketObject(
    row
) {

    if (!row) {
        return null;
    }


    return {

        id:
            row.id,

        ticketNumber:
            row.ticket_number,

        subject:
            row.subject,

        description:
            row.description,

        requesterId:
            row.requester_id,

        requesterName:
            row.requester_name,

        requesterEmail:
            row.requester_email,

        assignedTo:
            row.assigned_to,

        assigneeName:
            row.assignee_name ||
            null,

        assigneeEmail:
            row.assignee_email ||
            null,

        departmentId:
            row.department_id,

        department:
            row.department_name ||
            null,

        departmentCode:
            row.department_code ||
            null,

        categoryId:
            row.category_id,

        category:
            row.category_name ||
            null,

        slaPolicyId:
            row.sla_policy_id,

        slaPolicy:
            row.sla_policy_name ||
            null,

        priority:
            row.priority,

        status:
            row.status,

        source:
            row.source,

        firstResponseDueAt:
            row.first_response_due_at,

        resolutionDueAt:
            row.resolution_due_at,

        firstResponseAt:
            row.first_response_at,

        resolvedAt:
            row.resolved_at,

        closedAt:
            row.closed_at,

        resolutionNote:
            row.resolution_note ||
            null,

        slaBreached:
            row.sla_breached,

        createdAt:
            row.created_at,

        updatedAt:
            row.updated_at

    };
}


/* =========================================================
   HISTORY
========================================================= */

async function addHistory(
    client,
    {
        ticketId,
        actorId,
        action,
        oldValue = null,
        newValue = null,
        metadata = {}
    }
) {

    await client.query(
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
                $3,
                $4::jsonb,
                $5::jsonb,
                $6::jsonb
            )
        `,
        [
            ticketId,
            actorId,
            action,

            oldValue === null
                ? null
                : JSON.stringify(
                    oldValue
                ),

            newValue === null
                ? null
                : JSON.stringify(
                    newValue
                ),

            JSON.stringify(
                metadata || {}
            )
        ]
    );
}


/* =========================================================
   GENERATE UNIQUE TICKET NUMBER
========================================================= */

async function uniqueTicketNumber(
    client,
    prefix = "RD",
    startingNumber = 1000
) {

    const safePrefix =
        normalizePrefix(
            prefix
        );


    const safeStartingNumber =
        Math.max(
            1,
            Math.floor(
                Number(
                    startingNumber
                ) || 1000
            )
        );


    const result =
        await client.query(
            `
                INSERT INTO ticket_number_counters (
                    prefix,
                    next_number,
                    updated_at
                )

                VALUES (
                    $1,
                    $2 + 1,
                    NOW()
                )

                ON CONFLICT (prefix)

                DO UPDATE SET

                    next_number =
                        GREATEST(
                            ticket_number_counters.next_number,
                            $2
                        ) + 1,

                    updated_at =
                        NOW()

                RETURNING
                    next_number - 1
                        AS issued_number
            `,
            [
                safePrefix,
                safeStartingNumber
            ]
        );


    return formatTicketNumber(
        safePrefix,
        result.rows[0]
            .issued_number
    );
}

/* =========================================================
   SLA POLICY
========================================================= */

async function getSlaPolicy(
    client,
    priority
) {

    const normalized =
        normalizePriority(
            priority
        );


    const result =
        await client.query(
            `
                SELECT
                    id,
                    name,
                    priority,
                    first_response_minutes,
                    resolution_minutes,
                    warning_threshold_minutes,
                    business_hours_only

                FROM sla_policies

                WHERE
                    priority = $1
                    AND is_active = TRUE

                ORDER BY id ASC

                LIMIT 1
            `,
            [
                normalized
            ]
        );


    if (
        result.rowCount >
        0
    ) {

        return result.rows[0];
    }


    /*
        Fallback only if DB policy
        is unexpectedly missing.
    */

    const fallback =
        getDefaultSla(
            normalized
        );


    return {

        id:
            null,

        name:
            `${normalized} Default`,

        priority:
            normalized,

        first_response_minutes:
            fallback.responseMinutes,

        resolution_minutes:
            fallback.resolutionMinutes,

        warning_threshold_minutes:
            null,

        business_hours_only:
            false

    };
}


/* =========================================================
   ROLE ACCESS
========================================================= */

function addRoleAccess(
    req,
    conditions,
    values
) {

    /*
        ADMIN:
        Can view all tickets.
    */

    if (
        req.user.role ===
        "ADMIN"
    ) {

        return;
    }


    /*
        STAFF:
        Own tickets only.
    */

    if (
        req.user.role ===
        "STAFF"
    ) {

        values.push(
            req.user.id
        );


        conditions.push(
            `t.requester_id = $${values.length}`
        );


        return;
    }


    /*
        TECHNICIAN:
        Assigned tickets plus
        unassigned tickets in their department.
    */

    if (
        req.user.role ===
        "TECHNICIAN"
    ) {

        values.push(
            req.user.id
        );


        const userPosition =
            values.length;


        if (
            req.user.departmentId
        ) {

            values.push(
                req.user.departmentId
            );


            const departmentPosition =
                values.length;


            conditions.push(`
                (
                    t.assigned_to =
                        $${userPosition}

                    OR

                    (
                        t.assigned_to IS NULL
                        AND
                        t.department_id =
                            $${departmentPosition}
                    )
                )
            `);

        } else {

            conditions.push(
                `t.assigned_to = $${userPosition}`
            );
        }
    }

    /*
        Fail closed:
        unknown roles must never receive
        unrestricted ticket access.
    */
    conditions.push(
        "1 = 0"
    );

}


/* =========================================================
   VERIFY SUPPORT ACCESS TO SPECIFIC TICKET
========================================================= */

function technicianCanManage(
    req,
    ticket
) {

    if (
        req.user.role ===
        "ADMIN"
    ) {

        return true;
    }


    if (
        req.user.role !==
        "TECHNICIAN"
    ) {

        return false;
    }


    return (
        String(
            ticket.assigned_to ||
            ""
        ) ===
        String(
            req.user.id
        )
    );
}


/* =========================================================
   META OPTIONS

   GET /api/tickets/meta/options
========================================================= */

router.get(
    "/meta/options",
    async (
        req,
        res,
        next
    ) => {

        try {

            const [
                categories,
                departments,
                technicians,
                slaPolicies
            ] =
                await Promise.all([

                    query(`
                        SELECT
                            id,
                            name,
                            description,
                            default_priority,
                            department_id

                        FROM categories

                        WHERE is_active = TRUE

                        ORDER BY name ASC
                    `),

                    query(`
                        SELECT
                            id,
                            name,
                            code

                        FROM departments

                        WHERE is_active = TRUE

                        ORDER BY name ASC
                    `),

                    query(`
                        SELECT
                            id,
                            full_name,
                            email,
                            department_id

                        FROM users

                        WHERE
                            role = 'TECHNICIAN'
                            AND status = 'ACTIVE'

                        ORDER BY full_name ASC
                    `),

                    query(`
                        SELECT
                            id,
                            name,
                            priority,
                            first_response_minutes,
                            resolution_minutes,
                            warning_threshold_minutes,
                            business_hours_only

                        FROM sla_policies

                        WHERE is_active = TRUE

                        ORDER BY
                            CASE priority
                                WHEN 'CRITICAL' THEN 1
                                WHEN 'HIGH' THEN 2
                                WHEN 'MEDIUM' THEN 3
                                WHEN 'LOW' THEN 4
                                ELSE 5
                            END
                    `)

                ]);

const runtimeSettings =
    await getRuntimeSettings();

const attachmentLimitMb =
    Math.max(
        1,
        Number(
            runtimeSettings
                ?.tickets
                ?.attachmentLimitMb
        ) || 10
    );

            return res.json({

                success:
                    true,

                categories:
                    categories.rows,

                departments:
                    departments.rows,

                technicians:
                    technicians.rows.map(
                        technician => ({

                            id:
                                technician.id,

                            fullName:
                                technician.full_name,

                            email:
                                technician.email,

                            departmentId:
                                technician.department_id

                        })
                    ),

               slaPolicies:
    slaPolicies.rows.map(
        policy => ({

            id:
                policy.id,

            name:
                policy.name,

            priority:
                policy.priority,

            firstResponseMinutes:
                policy.first_response_minutes,

            resolutionMinutes:
                policy.resolution_minutes,

            warningThresholdMinutes:
                policy.warning_threshold_minutes,

            businessHoursOnly:
                policy.business_hours_only

        })
    ),

attachmentLimitMb:
    attachmentLimitMb

});

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   MY QUEUE

   GET /api/tickets/my-queue

   TECHNICIAN / ADMIN
========================================================= */

router.get(
    "/my-queue",
    requireSupport,
    async (
        req,
        res,
        next
    ) => {

        try {

            await syncSlaBreaches();
            await syncSlaWarnings();

            const values =
                [
                    req.user.id
                ];


            let where;


            if (
                req.user.role ===
                "ADMIN"
            ) {

                where = `
                    WHERE
                        t.assigned_to = $1
                `;

            } else {

                where = `
                    WHERE
                        (
                            t.assigned_to = $1
                `;


                if (
                    req.user.departmentId
                ) {

                    values.push(
                        req.user.departmentId
                    );


                    where += `
                            OR (
                                t.assigned_to IS NULL
                                AND
                                t.department_id = $2
                            )
                    `;
                }


                where += `
                        )
                `;
            }


            where += `
                AND t.status
                    NOT IN (
                        'RESOLVED',
                        'CLOSED'
                    )
            `;


            const result =
                await query(
                    `
                        ${ticketSelect}

                        ${where}

                        ORDER BY

                            CASE t.priority
                                WHEN 'CRITICAL' THEN 1
                                WHEN 'HIGH' THEN 2
                                WHEN 'MEDIUM' THEN 3
                                WHEN 'LOW' THEN 4
                                ELSE 5
                            END,

                            t.created_at ASC
                    `,
                    values
                );


            return res.json({

                success:
                    true,

                count:
                    result.rowCount,

                tickets:
                    result.rows.map(
                        ticketObject
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   CREATE TICKET

   POST /api/tickets
========================================================= */

router.post(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const subject =
                safeText(
                    req.body.subject
                );


            const description =
                safeText(
                    req.body.description
                );


            const categoryId =
                req.body.categoryId;


            const departmentId =
                req.body.departmentId;

                const runtimeSettings =
    await getRuntimeSettings();


            if (
                subject.length <
                3
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Ticket subject must contain at least 3 characters."

                    });
            }


            if (
                description.length <
                5
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Please provide more information about the issue."

                    });
            }


            if (
                !validId(
                    categoryId
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "A valid category is required."

                    });
            }


            if (
                !validId(
                    departmentId
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "A valid department is required."

                    });
            }


            const created =
                await withTransaction(
                    async client => {

                        /* =================================
                           CATEGORY
                        ================================= */

                        const categoryResult =
                            await client.query(
                                `
                                    SELECT
                                        id,
                                        name,
                                        default_priority,
                                        department_id

                                    FROM categories

                                    WHERE
                                        id = $1
                                        AND is_active = TRUE

                                    LIMIT 1
                                `,
                                [
                                    categoryId
                                ]
                            );


                        if (
                            categoryResult.rowCount ===
                            0
                        ) {

                            const error =
                                new Error(
                                    "Selected category does not exist."
                                );


                            error.status =
                                400;


                            throw error;
                        }


                        const category =
                            categoryResult.rows[0];

                            if (
    category.department_id &&
    Number(category.department_id) !==
        Number(departmentId)
) {
    const error =
        new Error(
            "Selected category does not belong to the selected department."
        );

    error.status = 400;

    throw error;
}


                        /* =================================
                           DEPARTMENT
                        ================================= */

                        const departmentResult =
                            await client.query(
                                `
                                    SELECT
                                        id,
                                        name

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

                            const error =
                                new Error(
                                    "Selected department does not exist."
                                );


                            error.status =
                                400;


                            throw error;
                        }


                        /* =================================
                           PRIORITY
                        ================================= */

                        let priority =
    safeText(
        req.body.priority ||
        category.default_priority ||
        runtimeSettings
            .tickets
            .defaultPriority ||
        "MEDIUM"
    ).toUpperCase();


                        priority =
                            normalizePriority(
                                priority
                            );


                        if (
                            !ALLOWED_PRIORITIES.includes(
                                priority
                            )
                        ) {

                           priority =
    normalizePriority(
        runtimeSettings
            .tickets
            .defaultPriority ||
        "MEDIUM"
    );
                        }

                        /* =================================
                           SLA
                        ================================= */

                        const policy =
                            await getSlaPolicy(
                                client,
                                priority
                            );


                        const createdAt =
                            new Date();


                        const deadlines =
    calculateSlaDeadlines({

        priority,

        createdAt,

        responseMinutes:
            policy.first_response_minutes,

        resolutionMinutes:
            policy.resolution_minutes,

        businessHoursOnly:
            runtimeSettings
                ?.organization
                ?.pauseSlaOutsideHours ===
            true,

        timeZone:
            runtimeSettings
                ?.organization
                ?.timeZone,

        workingDays:
            runtimeSettings
                ?.organization
                ?.workingDays,

        businessStart:
            runtimeSettings
                ?.organization
                ?.businessStart,

        businessEnd:
            runtimeSettings
                ?.organization
                ?.businessEnd

    });


                        /* =================================
                           TICKET NUMBER
                        ================================= */

                        const ticketNumber =
    await uniqueTicketNumber(
        client,
        runtimeSettings
            .tickets
            .prefix,
        runtimeSettings
            .tickets
            .startingNumber
    );

                            /* =================================
   AUTO ASSIGNMENT
================================= */

let autoAssignee =
    null;


if (
    runtimeSettings
        .tickets
        .autoAssignment ===
    true
) {

    autoAssignee =
        await findAutoAssignee(
            client,
            departmentId
        );
}


const autoAssigneeId =
    autoAssignee
        ? autoAssignee.id
        : null;


                        /* =================================
                           INSERT
                        ================================= */

                    const result =
    await client.query(
        `
            INSERT INTO tickets (
                ticket_number,
                subject,
                description,
                requester_id,
                assigned_to,
                department_id,
                category_id,
                sla_policy_id,
                priority,
                status,
                source,
                first_response_due_at,
                resolution_due_at,
                sla_breached,
                created_at
            )

            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                'OPEN',
                'PORTAL',
                $10,
                $11,
                FALSE,
                $12
            )

            RETURNING *
        `,
        [
            ticketNumber,
            subject,
            description,
            req.user.id,
            autoAssigneeId,
            departmentId,
            categoryId,
            policy.id,
            priority,
            deadlines.responseDueAt,
            deadlines.resolutionDueAt,
            createdAt
        ]
    );


                        const ticket =
                            result.rows[0];

/* =================================
   AUTO ASSIGNMENT HISTORY
================================= */

if (
    autoAssignee
) {

    await addHistory(
        client,
        {

            ticketId:
                ticket.id,

            actorId:
                null,

            action:
                "AUTO_ASSIGNED",

            oldValue: {

                assignedTo:
                    null

            },

            newValue: {

                assignedTo:
                    Number(
                        autoAssignee.id
                    )

            },

            metadata: {

                technicianName:
                    autoAssignee
                        .full_name,

                departmentId:
                    Number(
                        departmentId
                    ),

                activeTicketsBefore:
                    Number(
                        autoAssignee
                            .active_tickets
                    ) || 0,

                maxTickets:
                    AUTO_ASSIGN_MAX_TICKETS,

                source:
                    "AUTO_ASSIGNMENT"

            }

        }
    );


    await client.query(
        `
            INSERT INTO audit_logs (
                actor_id,
                action,
                entity_type,
                entity_id,
                severity,
                metadata
            )

            VALUES (
                NULL,
                'TICKET_AUTO_ASSIGNED',
                'TICKET',
                $1,
                'INFO',
                $2::JSONB
            )
        `,
        [

            String(
                ticket.id
            ),

            JSON.stringify({

                ticketNumber:
                    ticket.ticket_number,

                assignedTo:
                    Number(
                        autoAssignee.id
                    ),

                technicianName:
                    autoAssignee
                        .full_name,

                departmentId:
                    Number(
                        departmentId
                    ),

                activeTicketsBefore:
                    Number(
                        autoAssignee
                            .active_tickets
                    ) || 0,

                maxTickets:
                    AUTO_ASSIGN_MAX_TICKETS,

                source:
                    "AUTO_ASSIGNMENT"

            })

        ]
    );
}

/* =================================
   NEW TICKET NOTIFICATIONS
================================= */

if (
    runtimeSettings
        ?.notifications
        ?.newTicket ===
    true
) {

    const recipientResult =
        await client.query(
            `
                SELECT
                    id

                FROM users

                WHERE
                    status = 'ACTIVE'

                    AND
                    (
                        role = 'ADMIN'

                        OR

                        (
                            role = 'TECHNICIAN'
                            AND department_id = $1
                        )
                    )

                    AND id <> $2

                    AND (
                        $3::BIGINT IS NULL
                        OR id <> $3
                    )

                ORDER BY
                    id ASC
            `,
            [
                departmentId,
                req.user.id,
                autoAssigneeId
            ]
        );


    for (
        const recipient
        of recipientResult.rows
    ) {

        await createNotification({

            client,

            userId:
                recipient.id,

            type:
                "NEW_TICKET",

            title:
                `New ticket ${ticket.ticket_number}`,

            body:
                `${subject} · ${priority} priority`,

            link:
                `/ticket-detail.html?id=${ticket.id}`

        });
    }
}


/* =================================
   AUTO ASSIGNMENT NOTIFICATION
================================= */

if (
    runtimeSettings
        ?.notifications
        ?.assignment ===
        true &&

    autoAssigneeId
) {

    await createNotification({

        client,

        userId:
            autoAssigneeId,

        type:
            "TICKET_ASSIGNED",

        title:
            `Ticket ${ticket.ticket_number} assigned to you`,

        body:
            subject,

        link:
            `/ticket-detail.html?id=${ticket.id}`

    });
}


return ticket;

                    }
                );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "TICKET_CREATED",

                entityType:
                    "TICKET",

                entityId:
                    created.id,

                severity:
                    created.priority ===
                        "CRITICAL"
                        ? "WARNING"
                        : "INFO",

                metadata: {

                    ticketNumber:
                        created.ticket_number,

                    priority:
                        created.priority

                },

                req

            });


            const completeResult =
                await query(
                    `
                        ${ticketSelect}

                        WHERE t.id = $1

                        LIMIT 1
                    `,
                    [
                        created.id
                    ]
                );


            return res
                .status(201)
                .json({

                    success:
                        true,

                    message:
                        "Ticket created successfully.",

                    ticket:
                        ticketObject(
                            completeResult.rows[0]
                        )

                });

        } catch (error) {

            if (
                error.status
            ) {

                return res
                    .status(
                        error.status
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
   LIST TICKETS

   GET /api/tickets

   Query examples:
   ?status=OPEN
   ?priority=HIGH
   ?categoryId=1
   ?search=printer
========================================================= */

/* =========================================================
   LIST TICKETS

   GET /api/tickets

   Query examples:
   ?status=OPEN
   ?priority=HIGH
   ?categoryId=1
   ?search=printer
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            await syncSlaBreaches();
            await syncSlaWarnings();

            const conditions =
                [];


            const values =
                [];


            function value(
                item
            ) {

                values.push(
                    item
                );


                return `$${values.length}`;
            }


            /* =============================================
               ROLE ACCESS
            ============================================= */

            addRoleAccess(
                req,
                conditions,
                values
            );


            /* =============================================
               SEARCH
            ============================================= */

            const search =
                safeText(
                    req.query.search
                );


            if (
                search
            ) {

                const position =
                    value(
                        `%${search}%`
                    );


                conditions.push(`
                    (
                        t.ticket_number
                            ILIKE ${position}

                        OR

                        t.subject
                            ILIKE ${position}

                        OR

                        t.description
                            ILIKE ${position}

                        OR

                        requester.full_name
                            ILIKE ${position}
                    )
                `);
            }


            /* =============================================
               STATUS
            ============================================= */

            const status =
                safeText(
                    req.query.status
                ).toUpperCase();


            if (
                status &&
                ALLOWED_STATUSES.includes(
                    status
                )
            ) {

                conditions.push(
                    `t.status = ${value(status)}`
                );
            }


            /* =============================================
               PRIORITY
            ============================================= */

            const priority =
                safeText(
                    req.query.priority
                ).toUpperCase();


            if (
                priority &&
                ALLOWED_PRIORITIES.includes(
                    priority
                )
            ) {

                conditions.push(
                    `t.priority = ${value(priority)}`
                );
            }


            /* =============================================
               CATEGORY
            ============================================= */

            if (
                validId(
                    req.query.categoryId
                )
            ) {

                conditions.push(
                    `t.category_id = ${value(req.query.categoryId)}`
                );
            }


            /* =============================================
               DEPARTMENT
            ============================================= */

            if (
                validId(
                    req.query.departmentId
                )
            ) {

                conditions.push(
                    `t.department_id = ${value(req.query.departmentId)}`
                );
            }


            /* =============================================
               PAGINATION
            ============================================= */

            const limit =
                Math.min(
                    Math.max(
                        Number(
                            req.query.limit
                        ) || 50,
                        1
                    ),
                    100
                );


            const offset =
                Math.max(
                    Number(
                        req.query.offset
                    ) || 0,
                    0
                );


            const where =
                conditions.length
                    ? `WHERE ${conditions.join(" AND ")}`
                    : "";


            values.push(
                limit
            );


            const limitPosition =
                values.length;


            values.push(
                offset
            );


            const offsetPosition =
                values.length;


            const result =
                await query(
                    `
                        ${ticketSelect}

                        ${where}

                        ORDER BY

                            CASE t.status
                                WHEN 'OPEN' THEN 1
                                WHEN 'IN_PROGRESS' THEN 2
                                WHEN 'PENDING' THEN 3
                                WHEN 'RESOLVED' THEN 4
                                WHEN 'CLOSED' THEN 5
                                ELSE 6
                            END,

                            CASE t.priority
                                WHEN 'CRITICAL' THEN 1
                                WHEN 'HIGH' THEN 2
                                WHEN 'MEDIUM' THEN 3
                                WHEN 'LOW' THEN 4
                                ELSE 5
                            END,

                            t.created_at DESC

                        LIMIT $${limitPosition}
                        OFFSET $${offsetPosition}
                    `,
                    values
                );


            return res.json({

                success:
                    true,

                count:
                    result.rowCount,

                limit,

                offset,

                tickets:
                    result.rows.map(
                        ticketObject
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);



/* =========================================================
   GET SINGLE TICKET

   GET /api/tickets/:id
========================================================= */

router.get(
    "/:id",
    async (
        req,
        res,
        next
    ) => {

        try {

            await syncSlaBreaches();
            await syncSlaWarnings();

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
                            "Invalid ticket ID."

                    });
            }


            const conditions = [
                "t.id = $1"
            ];


            const values = [
                req.params.id
            ];


            addRoleAccess(
                req,
                conditions,
                values
            );


            const result =
                await query(
                    `
                        ${ticketSelect}

                        WHERE
                            ${conditions.join(" AND ")}

                        LIMIT 1
                    `,
                    values
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
                            "Ticket not found."

                    });
            }


            const history =
                await query(
                    `
                        SELECT
                            h.id,
                            h.action,
                            h.old_value,
                            h.new_value,
                            h.metadata,
                            h.created_at,

                            h.actor_id,

                            u.full_name
                                AS actor_name,

                            u.role
                                AS actor_role

                        FROM ticket_history h

                        LEFT JOIN users u
                            ON u.id =
                                h.actor_id

                        WHERE
                            h.ticket_id = $1

                        ORDER BY
                            h.created_at ASC
                    `,
                    [
                        req.params.id
                    ]
                );


            return res.json({

                success:
                    true,

                ticket:
                    ticketObject(
                        result.rows[0]
                    ),

                history:
                    history.rows.map(
                        item => ({

                            id:
                                item.id,

                            action:
                                item.action,

                            oldValue:
                                item.old_value,

                            newValue:
                                item.new_value,

                            metadata:
                                item.metadata,

                            actorId:
                                item.actor_id,

                            actorName:
                                item.actor_name,

                            actorRole:
                                item.actor_role,

                            createdAt:
                                item.created_at

                        })
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   TICKET COMMENTS

   GET /api/tickets/:id/comments
========================================================= */

router.get(
    "/:id/comments",
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
                            "Invalid ticket ID."

                    });
            }


            const conditions = [
                "t.id = $1"
            ];


            const values = [
                req.params.id
            ];


            addRoleAccess(
                req,
                conditions,
                values
            );


            const ticketResult =
                await query(
                    `
                        SELECT
                            t.id,
                            t.requester_id,
                            t.assigned_to
                        FROM tickets t
                        WHERE
                            ${conditions.join(" AND ")}
                        LIMIT 1
                    `,
                    values
                );


            if (
                ticketResult.rowCount ===
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


            const supportUser =
                req.user.role ===
                    "ADMIN" ||
                req.user.role ===
                    "TECHNICIAN";


            const comments =
                await query(
                    `
                        SELECT
                            c.id,
                            c.ticket_id,
                            c.user_id,
                            c.body,
                            c.is_internal,
                            c.created_at,
                            c.updated_at,

                            u.full_name
                                AS author_name,

                            u.role
                                AS author_role

                        FROM ticket_comments c

                        JOIN users u
                            ON u.id =
                                c.user_id

                        WHERE
                            c.ticket_id = $1

                            ${
                                supportUser
                                    ? ""
                                    : "AND c.is_internal = false"
                            }

                        ORDER BY
                            c.created_at ASC,
                            c.id ASC
                    `,
                    [
                        req.params.id
                    ]
                );


            return res.json({

                success:
                    true,

                comments:
                    comments.rows.map(
                        item => ({

                            id:
                                item.id,

                            ticketId:
                                item.ticket_id,

                            userId:
                                item.user_id,

                            body:
                                item.body,

                            isInternal:
                                item.is_internal,

                            authorName:
                                item.author_name,

                            authorRole:
                                item.author_role,

                            createdAt:
                                item.created_at,

                            updatedAt:
                                item.updated_at

                        })
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   ADD TICKET COMMENT

   POST /api/tickets/:id/comments
========================================================= */

router.post(
    "/:id/comments",
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
                            "Invalid ticket ID."

                    });
            }


            const body =
                safeText(
                    req.body.body
                );


            const requestedInternal =
                req.body.isInternal ===
                    true;


            if (!body) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Reply cannot be empty."

                    });
            }


            if (
                body.length >
                5000
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Reply cannot exceed 5000 characters."

                    });
            }


            const supportUser =
                req.user.role ===
                    "ADMIN" ||
                req.user.role ===
                    "TECHNICIAN";


            if (
                requestedInternal &&
                !supportUser
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        message:
                            "Internal notes are only available to the support team."

                    });
            }


            const runtimeSettings =
                await getRuntimeSettings();


            const result =
                await withTransaction(
                    async client => {

                        const conditions = [
                            "t.id = $1"
                        ];


                        const values = [
                            req.params.id
                        ];


                        addRoleAccess(
                            req,
                            conditions,
                            values
                        );


                        const ticketResult =
                            await client.query(
                                `
                                    SELECT
                                        t.id,
                                        t.ticket_number,
                                        t.subject,
                                        t.requester_id,
                                        t.assigned_to,
                                        t.status

                                    FROM tickets t

                                    WHERE
                                        ${conditions.join(" AND ")}

                                    LIMIT 1

                                    FOR UPDATE
                                `,
                                values
                            );


                        if (
                            ticketResult.rowCount ===
                            0
                        ) {

                            const error =
                                new Error(
                                    "Ticket not found."
                                );


                            error.status =
                                404;


                            throw error;
                        }


                        const ticket =
                            ticketResult.rows[0];


                        const commentResult =
                            await client.query(
                                `
                                    INSERT INTO ticket_comments
                                    (
                                        ticket_id,
                                        user_id,
                                        body,
                                        is_internal
                                    )
                                    VALUES
                                    (
                                        $1,
                                        $2,
                                        $3,
                                        $4
                                    )
                                    RETURNING *
                                `,
                                [
                                    ticket.id,
                                    req.user.id,
                                    body,
                                    requestedInternal
                                ]
                            );


                        const comment =
                            commentResult.rows[0];


                        await addHistory(
                            client,
                            {

                                ticketId:
                                    ticket.id,

                                actorId:
                                    req.user.id,

                                action:
                                    requestedInternal
                                        ? "INTERNAL_NOTE_ADDED"
                                        : "PUBLIC_REPLY_ADDED",

                                oldValue:
                                    null,

                                newValue: {

                                    commentId:
                                        comment.id,

                                    isInternal:
                                        requestedInternal

                                },

                                metadata: {

                                    preview:
                                        body.slice(
                                            0,
                                            180
                                        )

                                }

                            }
                        );


                        /* =================================
                           PUBLIC REPLY NOTIFICATION
                        ================================= */

                        if (
                            !requestedInternal &&
                            runtimeSettings
                                ?.notifications
                                ?.replies === true
                        ) {

                            let recipientId =
                                null;


                            if (
                                req.user.role ===
                                    "STAFF"
                            ) {

                                recipientId =
                                    ticket.assigned_to;

                            } else {

                                recipientId =
                                    ticket.requester_id;
                            }


                            if (
                                recipientId &&
                                Number(
                                    recipientId
                                ) !==
                                    Number(
                                        req.user.id
                                    )
                            ) {

                                await createNotification({

                                    client,

                                    userId:
                                        recipientId,

                                    type:
                                        "TICKET_REPLY",

                                    title:
                                        `New reply on ${ticket.ticket_number}`,

                                    body:
                                        body.slice(
                                            0,
                                            240
                                        ),

                                    link:
                                        `/ticket-detail.html?id=${ticket.id}`

                                });
                            }
                        }


                        return {
                            ticket,
                            comment
                        };
                    }
                );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    requestedInternal
                        ? "INTERNAL_NOTE_ADDED"
                        : "PUBLIC_REPLY_ADDED",

                entityType:
                    "TICKET",

                entityId:
                    result.ticket.id,

                severity:
                    "INFO",

                metadata: {

                    commentId:
                        result.comment.id,

                    isInternal:
                        result.comment.is_internal

                },

                req

            });


            return res
                .status(201)
                .json({

                    success:
                        true,

                    message:
                        result.comment.is_internal
                            ? "Internal note added."
                            : "Reply posted successfully.",

                    comment: {

                        id:
                            result.comment.id,

                        ticketId:
                            result.comment.ticket_id,

                        userId:
                            result.comment.user_id,

                        body:
                            result.comment.body,

                        isInternal:
                            result.comment.is_internal,

                        authorName:
                            req.user.fullName ||
                            req.user.full_name ||
                            null,

                        authorRole:
                            req.user.role,

                        createdAt:
                            result.comment.created_at,

                        updatedAt:
                            result.comment.updated_at

                    }

                });

        } catch (error) {

            if (
                error.status
            ) {

                return res
                    .status(
                        error.status
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
   ASSIGN TICKET

   PATCH /api/tickets/:id/assign

   ADMIN:
   Can assign technician / unassign.

   TECHNICIAN:
   Can self-assign an unassigned ticket
   within own department.
========================================================= */

router.patch(
    "/:id/assign",
    requireSupport,
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
                            "Invalid ticket ID."

                    });
            }


            const requestedAssignee =
                req.body.assignedTo;


            const updated =
                await withTransaction(
                    async client => {

                        const ticketResult =
                            await client.query(
                                `
                                    SELECT *
                                    FROM tickets
                                    WHERE id = $1
                                    FOR UPDATE
                                `,
                                [
                                    req.params.id
                                ]
                            );


                        if (
                            ticketResult.rowCount ===
                            0
                        ) {

                            const error =
                                new Error(
                                    "Ticket not found."
                                );


                            error.status =
                                404;


                            throw error;
                        }


                        const ticket =
                            ticketResult.rows[0];


                        let assigneeId =
                            null;


                        /* =================================
                           TECHNICIAN SELF ASSIGNMENT
                        ================================= */

                        if (
                            req.user.role ===
                            "TECHNICIAN"
                        ) {

                            if (
                                ticket.assigned_to
                            ) {

                                const error =
                                    new Error(
                                        "This ticket is already assigned."
                                    );


                                error.status =
                                    403;


                                throw error;
                            }


                            if (
                                !req.user.departmentId ||
                                String(
                                    ticket.department_id
                                ) !==
                                String(
                                    req.user.departmentId
                                )
                            ) {

                                const error =
                                    new Error(
                                        "You cannot assign this ticket to yourself."
                                    );


                                error.status =
                                    403;


                                throw error;
                            }


                            assigneeId =
                                req.user.id;

                        } else {

                            /* =============================
                               ADMIN ASSIGNMENT
                            ============================= */

                            if (
                                requestedAssignee !== null &&
                                requestedAssignee !== "" &&
                                requestedAssignee !== undefined
                            ) {

                                if (
                                    !validId(
                                        requestedAssignee
                                    )
                                ) {

                                    const error =
                                        new Error(
                                            "Invalid technician ID."
                                        );


                                    error.status =
                                        400;


                                    throw error;
                                }


                                const technician =
                                    await client.query(
                                        `
                                            SELECT
                                                id,
                                                full_name,
                                                department_id

                                            FROM users

                                            WHERE
                                                id = $1
                                                AND role = 'TECHNICIAN'
                                                AND status = 'ACTIVE'

                                            LIMIT 1
                                        `,
                                        [
                                            requestedAssignee
                                        ]
                                    );


                                if (
                                    technician.rowCount ===
                                    0
                                ) {

                                    const error =
                                        new Error(
                                            "Active technician not found."
                                        );


                                    error.status =
                                        400;


                                    throw error;
                                }


                                assigneeId =
                                    technician.rows[0].id;
                            }
                        }


                        const result =
                            await client.query(
                                `
                                    UPDATE tickets

                                    SET assigned_to = $1

                                    WHERE id = $2

                                    RETURNING *
                                `,
                                [
                                    assigneeId,
                                    ticket.id
                                ]
                            );


                       await addHistory(
    client,
    {
        ticketId:
            ticket.id,
        actorId:
            req.user.id,
        action:
            assigneeId
                ? "TICKET_ASSIGNED"
                : "TICKET_UNASSIGNED",
        oldValue: {
            assignedTo:
                ticket.assigned_to
        },
        newValue: {
            assignedTo:
                assigneeId
        }
    }
);


/* =================================
   MANUAL ASSIGNMENT NOTIFICATION
================================= */

const assignmentRuntimeSettings =
    await getRuntimeSettings();


if (
    assignmentRuntimeSettings
        ?.notifications
        ?.assignment === true &&
    assigneeId &&
    Number(assigneeId) !==
        Number(ticket.assigned_to)
) {

    await createNotification({
        client,

        userId:
            assigneeId,

        type:
            "TICKET_ASSIGNED",

        title:
            `Ticket ${ticket.ticket_number} assigned to you`,

        body:
            ticket.subject,

        link:
            `/ticket-detail.html?id=${ticket.id}`
    });
}


return result.rows[0];

                    }
                );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    updated.assigned_to
                        ? "TICKET_ASSIGNED"
                        : "TICKET_UNASSIGNED",

                entityType:
                    "TICKET",

                entityId:
                    updated.id,

                metadata: {
                    assignedTo:
                        updated.assigned_to
                },

                req

            });


            const result =
                await query(
                    `
                        ${ticketSelect}

                        WHERE t.id = $1

                        LIMIT 1
                    `,
                    [
                        updated.id
                    ]
                );


            return res.json({

                success:
                    true,

                message:
                    updated.assigned_to
                        ? "Ticket assigned successfully."
                        : "Ticket unassigned successfully.",

                ticket:
                    ticketObject(
                        result.rows[0]
                    )

            });

        } catch (error) {

            if (
                error.status
            ) {

                return res
                    .status(
                        error.status
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
   CHANGE STATUS

   PATCH /api/tickets/:id/status
========================================================= */

router.patch(
    "/:id/status",
    requireSupport,
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
                            "Invalid ticket ID."

                    });
            }


            const newStatus =
                safeText(
                    req.body.status
                ).toUpperCase();


            const resolutionNote =
                safeText(
                    req.body.resolutionNote
                );

                const runtimeSettings =
    await getRuntimeSettings();


            if (
                !ALLOWED_STATUSES.includes(
                    newStatus
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid ticket status."

                    });
            }


            const updated =
                await withTransaction(
                    async client => {

                        const existingResult =
                            await client.query(
                                `
                                    SELECT *
                                    FROM tickets
                                    WHERE id = $1
                                    FOR UPDATE
                                `,
                                [
                                    req.params.id
                                ]
                            );


                        if (
                            existingResult.rowCount ===
                            0
                        ) {

                            const error =
                                new Error(
                                    "Ticket not found."
                                );


                            error.status =
                                404;


                            throw error;
                        }


                        const existing =
                            existingResult.rows[0];


                        if (
                            !technicianCanManage(
                                req,
                                existing
                            )
                        ) {

                            const error =
                                new Error(
                                    "You do not have permission to update this ticket."
                                );


                            error.status =
                                403;


                            throw error;
                        }


                        if (
                            existing.status ===
                            newStatus
                        ) {

                            return existing;
                        }

                        const reopening =
    (
        existing.status ===
            "RESOLVED" ||
        existing.status ===
            "CLOSED"
    ) &&
    newStatus ===
        "IN_PROGRESS";


if (
    reopening &&
    !runtimeSettings
        .tickets
        .allowReopen
) {

    const error =
        new Error(
            "Ticket reopening is disabled by system settings."
        );


    error.status =
        400;


    throw error;
}

                        const transitions =
                            STATUS_TRANSITIONS[
                                existing.status
                            ] || [];


                        if (
                            !transitions.includes(
                                newStatus
                            )
                        ) {

                            const error =
                                new Error(
                                    `Ticket cannot move from ${existing.status} to ${newStatus}.`
                                );


                            error.status =
                                400;


                            throw error;
                        }

                        const completingTicket =
    newStatus ===
        "RESOLVED" ||
    newStatus ===
        "CLOSED";


const existingResolutionNote =
    safeText(
        existing.resolution_note
    );


if (
    completingTicket &&
    runtimeSettings
        .tickets
        .requireResolution &&
    !resolutionNote &&
    !existingResolutionNote
) {

    const error =
        new Error(
            "A resolution note is required before resolving or closing this ticket."
        );


    error.status =
        400;


    throw error;
}


                        const now =
                            new Date();


                        let firstResponseAt =
                            existing.first_response_at;


                        let resolvedAt =
                            existing.resolved_at;


                        let closedAt =
                            existing.closed_at;


                        let finalResolutionNote =
                            existing.resolution_note;


                        /* =================================
                           FIRST RESPONSE
                        ================================= */

                        if (
                            !firstResponseAt &&
                            newStatus !==
                            "OPEN"
                        ) {

                            firstResponseAt =
                                now;
                        }


                        /* =================================
                           RESOLVED
                        ================================= */

                        if (
                            newStatus ===
                            "RESOLVED"
                        ) {

                            resolvedAt =
                                now;


                            closedAt =
                                null;


                            if (
                                resolutionNote
                            ) {

                                finalResolutionNote =
                                    resolutionNote;
                            }
                        }


                        /* =================================
                           CLOSED
                        ================================= */

                        if (
                            newStatus ===
                            "CLOSED"
                        ) {

                            if (
                                !resolvedAt
                            ) {

                                resolvedAt =
                                    now;
                            }


                            closedAt =
                                now;


                            if (
                                resolutionNote
                            ) {

                                finalResolutionNote =
                                    resolutionNote;
                            }
                        }


                        /* =================================
                           REOPEN
                        ================================= */

                        if (
                            (
                                existing.status ===
                                    "RESOLVED" ||
                                existing.status ===
                                    "CLOSED"
                            ) &&
                            newStatus ===
                                "IN_PROGRESS"
                        ) {

                            resolvedAt =
                                null;


                            closedAt =
                                null;


                            finalResolutionNote =
                                null;
                        }


                        const sla =
                            getSlaStatus({

                                responseDueAt:
                                    existing.first_response_due_at,

                                resolutionDueAt:
                                    existing.resolution_due_at,

                                firstResponseAt,

                                resolvedAt,

                                now

                            });


                        const result =
                            await client.query(
                                `
                                    UPDATE tickets

                                    SET
                                        status = $1,
                                        first_response_at = $2,
                                        resolved_at = $3,
                                        closed_at = $4,
                                        resolution_note = $5,
                                        sla_breached = $6

                                    WHERE id = $7

                                    RETURNING *
                                `,
                                [
                                    newStatus,
                                    firstResponseAt,
                                    resolvedAt,
                                    closedAt,
                                    finalResolutionNote,
                                    sla.breached,
                                    existing.id
                                ]
                            );


                        await addHistory(
                            client,
                            {
                                ticketId:
                                    existing.id,

                                actorId:
                                    req.user.id,

                                action:
                                    "STATUS_CHANGED",

                                oldValue: {
                                    status:
                                        existing.status
                                },

                                newValue: {
                                    status:
                                        newStatus
                                },

                                metadata: {
                                    resolutionNote:
                                        resolutionNote ||
                                        null
                                }

                            }
                        );


                        /* =================================
                           RESOLVED NOTIFICATION
                        ================================= */

                        if (
                            newStatus ===
                                "RESOLVED" &&
                            runtimeSettings
                                ?.notifications
                                ?.resolved === true &&
                            existing.requester_id &&
                            Number(
                                existing.requester_id
                            ) !==
                                Number(
                                    req.user.id
                                )
                        ) {

                            await createNotification({

                                client,

                                userId:
                                    existing.requester_id,

                                type:
                                    "TICKET_RESOLVED",

                                title:
                                    `Ticket ${existing.ticket_number} has been resolved`,

                                body:
                                    existing.subject,

                                link:
                                    `/ticket-detail.html?id=${existing.id}`

                            });
                        }


                        return result.rows[0];
                    }
                );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "TICKET_STATUS_CHANGED",

                entityType:
                    "TICKET",

                entityId:
                    updated.id,

                severity:
                    updated.status ===
                        "CLOSED"
                        ? "INFO"
                        : (
                            updated.sla_breached
                                ? "WARNING"
                                : "INFO"
                        ),

                metadata: {
                    status:
                        updated.status
                },

                req

            });


            const result =
                await query(
                    `
                        ${ticketSelect}

                        WHERE t.id = $1

                        LIMIT 1
                    `,
                    [
                        updated.id
                    ]
                );


            return res.json({

                success:
                    true,

                message:
                    "Ticket status updated.",

                ticket:
                    ticketObject(
                        result.rows[0]
                    )

            });

        } catch (error) {

            if (
                error.status
            ) {

                return res
                    .status(
                        error.status
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
   CHANGE PRIORITY

   PATCH /api/tickets/:id/priority
========================================================= */

router.patch(
    "/:id/priority",
    requireSupport,
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
                            "Invalid ticket ID."

                    });
            }


            const priority =
                safeText(
                    req.body.priority
                ).toUpperCase();


            if (
                !ALLOWED_PRIORITIES.includes(
                    priority
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid ticket priority."

                    });
            }


            const updated =
                await withTransaction(
                    async client => {

                        const existingResult =
                            await client.query(
                                `
                                    SELECT *
                                    FROM tickets
                                    WHERE id = $1
                                    FOR UPDATE
                                `,
                                [
                                    req.params.id
                                ]
                            );


                        if (
                            existingResult.rowCount ===
                            0
                        ) {

                            const error =
                                new Error(
                                    "Ticket not found."
                                );


                            error.status =
                                404;


                            throw error;
                        }


                        const existing =
                            existingResult.rows[0];


                        if (
                            !technicianCanManage(
                                req,
                                existing
                            )
                        ) {

                            const error =
                                new Error(
                                    "You do not have permission to change this ticket priority."
                                );


                            error.status =
                                403;


                            throw error;
                        }


                        if (
                            existing.priority ===
                            priority
                        ) {

                            return existing;
                        }

const priorityRuntimeSettings =
    await getRuntimeSettings();

                        const policy =
                            await getSlaPolicy(
                                client,
                                priority
                            );


                        /*
                            Recalculate from original
                            ticket creation time.

                            This prevents changing priority
                            from artificially restarting SLA.
                        */

                        const deadlines =
    calculateSlaDeadlines({

        priority,

        createdAt:
            existing.created_at,

        responseMinutes:
            policy.first_response_minutes,

        resolutionMinutes:
            policy.resolution_minutes,

        businessHoursOnly:
            priorityRuntimeSettings
                ?.organization
                ?.pauseSlaOutsideHours ===
            true,

        timeZone:
            priorityRuntimeSettings
                ?.organization
                ?.timeZone,

        workingDays:
            priorityRuntimeSettings
                ?.organization
                ?.workingDays,

        businessStart:
            priorityRuntimeSettings
                ?.organization
                ?.businessStart,

        businessEnd:
            priorityRuntimeSettings
                ?.organization
                ?.businessEnd

    });

                        const sla =
                            getSlaStatus({

                                responseDueAt:
                                    deadlines.responseDueAt,

                                resolutionDueAt:
                                    deadlines.resolutionDueAt,

                                firstResponseAt:
                                    existing.first_response_at,

                                resolvedAt:
                                    existing.resolved_at

                            });


                        const result =
                            await client.query(
                                `
                                    UPDATE tickets

                                    SET
                                        priority = $1,
                                        sla_policy_id = $2,
                                        first_response_due_at = $3,
                                        resolution_due_at = $4,
                                        sla_breached = $5

                                    WHERE id = $6

                                    RETURNING *
                                `,
                                [
                                    priority,
                                    policy.id,
                                    deadlines.responseDueAt,
                                    deadlines.resolutionDueAt,
                                    sla.breached,
                                    existing.id
                                ]
                            );


                        await addHistory(
                            client,
                            {
                                ticketId:
                                    existing.id,

                                actorId:
                                    req.user.id,

                                action:
                                    "PRIORITY_CHANGED",

                                oldValue: {
                                    priority:
                                        existing.priority
                                },

                                newValue: {
                                    priority
                                },

                                metadata: {
                                    slaPolicyId:
                                        policy.id
                                }

                            }
                        );


                        return result.rows[0];
                    }
                );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "TICKET_PRIORITY_CHANGED",

                entityType:
                    "TICKET",

                entityId:
                    updated.id,

                severity:
                    priority ===
                        "CRITICAL"
                        ? "WARNING"
                        : "INFO",

                metadata: {
                    priority
                },

                req

            });


            const result =
                await query(
                    `
                        ${ticketSelect}

                        WHERE t.id = $1

                        LIMIT 1
                    `,
                    [
                        updated.id
                    ]
                );


            return res.json({

                success:
                    true,

                message:
                    "Ticket priority updated.",

                ticket:
                    ticketObject(
                        result.rows[0]
                    )

            });

        } catch (error) {

            if (
                error.status
            ) {

                return res
                    .status(
                        error.status
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
   EXPORT
========================================================= */

module.exports =
    router;