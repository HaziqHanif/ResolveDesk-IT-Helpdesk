const {
    withTransaction
} =
    require("../db");


const {
    getRuntimeSettings
} =
    require("./runtime-settings");


const {
    writeAudit
} =
    require("./audit");


/* =========================================================
   AUTO CLOSE CONFIG
========================================================= */

const AUTO_CLOSE_INTERVAL_MS =
    5 * 60 * 1000;


const AUTO_CLOSE_BATCH_SIZE =
    100;


let autoCloseTimer =
    null;


let autoCloseRunning =
    false;


/* =========================================================
   CLOSE ELIGIBLE TICKETS
========================================================= */

async function closeEligibleTickets(
    autoCloseDays
) {

    return withTransaction(
        async client => {

            /*
             * Lock only tickets that are eligible.
             *
             * SKIP LOCKED prevents duplicate processing
             * if more than one ResolveDesk instance is
             * running at the same time.
             */

            const candidates =
                await client.query(
                    `
                        SELECT
                            id,
                            ticket_number,
                            subject,
                            resolved_at

                        FROM tickets

                        WHERE
                            status = 'RESOLVED'

                            AND resolved_at
                                IS NOT NULL

                            AND resolved_at <=
                                NOW() -
                                (
                                    $1::INTEGER *
                                    INTERVAL '1 day'
                                )

                        ORDER BY
                            resolved_at ASC

                        LIMIT ${AUTO_CLOSE_BATCH_SIZE}

                        FOR UPDATE
                        SKIP LOCKED
                    `,
                    [
                        autoCloseDays
                    ]
                );


            const closedTickets =
                [];


            for (
                const ticket
                of candidates.rows
            ) {

                const result =
                    await client.query(
                        `
                            UPDATE tickets

                            SET
                                status =
                                    'CLOSED',

                                closed_at =
                                    NOW()

                            WHERE
                                id = $1

                                AND status =
                                    'RESOLVED'

                            RETURNING
                                id,
                                ticket_number,
                                subject,
                                resolved_at,
                                closed_at
                        `,
                        [
                            ticket.id
                        ]
                    );


                if (
                    result.rowCount ===
                    0
                ) {

                    continue;
                }


                const updatedTicket =
                    result.rows[0];


                /*
                 * Ticket history is part
                 * of the SAME transaction.
                 */

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
                            NULL,
                            'AUTO_CLOSED',
                            $2::JSONB,
                            $3::JSONB,
                            $4::JSONB
                        )
                    `,
                    [
                        updatedTicket.id,

                        JSON.stringify({
                            status:
                                "RESOLVED"
                        }),

                        JSON.stringify({
                            status:
                                "CLOSED"
                        }),

                        JSON.stringify({
                            source:
                                "AUTO_CLOSE_WORKER",

                            autoCloseDays
                        })
                    ]
                );


                closedTickets.push(
                    updatedTicket
                );
            }


            return closedTickets;
        }
    );
}


/* =========================================================
   RUN AUTO CLOSE ONCE
========================================================= */

async function runAutoCloseOnce() {

    /*
     * Prevent overlapping runs inside
     * the same Node process.
     */

    if (
        autoCloseRunning
    ) {

        return {
            skipped:
                true,

            reason:
                "ALREADY_RUNNING",

            closed:
                0
        };
    }


    autoCloseRunning =
        true;


    try {

        const settings =
            await getRuntimeSettings();


        const autoCloseEnabled =
            settings
                ?.tickets
                ?.autoClose ===
            true;


        if (
            !autoCloseEnabled
        ) {

            return {
                enabled:
                    false,

                closed:
                    0
            };
        }


        const configuredDays =
            Number.parseInt(
                settings
                    ?.tickets
                    ?.autoCloseDays,
                10
            );


        const autoCloseDays =
            Number.isFinite(
                configuredDays
            ) &&
            configuredDays > 0
                ? configuredDays
                : 3;


        const closedTickets =
            await closeEligibleTickets(
                autoCloseDays
            );


        /*
         * Audit is intentionally outside
         * the ticket transaction because
         * existing ResolveDesk audit helper
         * uses the normal DB query helper.
         */

        for (
            const ticket
            of closedTickets
        ) {

            await writeAudit({

                actorId:
                    null,

                action:
                    "TICKET_AUTO_CLOSED",

                entityType:
                    "TICKET",

                entityId:
                    ticket.id,

                severity:
                    "INFO",

                metadata: {

                    ticketNumber:
                        ticket.ticket_number,

                    subject:
                        ticket.subject,

                    previousStatus:
                        "RESOLVED",

                    status:
                        "CLOSED",

                    resolvedAt:
                        ticket.resolved_at,

                    closedAt:
                        ticket.closed_at,

                    autoCloseDays,

                    source:
                        "AUTO_CLOSE_WORKER"
                }

            });
        }


        if (
            closedTickets.length >
            0
        ) {

            console.log(
                `🧹 Auto-close: ${closedTickets.length} ticket(s) closed after ${autoCloseDays} day(s).`
            );
        }


        return {

            enabled:
                true,

            autoCloseDays,

            closed:
                closedTickets.length,

            tickets:
                closedTickets
                    .map(
                        ticket =>
                            ticket.ticket_number
                    )
        };

    } finally {

        autoCloseRunning =
            false;
    }
}


/* =========================================================
   START WORKER
========================================================= */

function startAutoCloseWorker() {

    if (
        autoCloseTimer
    ) {

        return;
    }


    console.log(
        "🧹 Auto-close worker started."
    );


    /*
     * Run immediately once when
     * ResolveDesk starts.
     */

    runAutoCloseOnce()
        .catch(
            error => {

                console.error(
                    "❌ Auto-close worker error:",
                    error.message
                );
            }
        );


    /*
     * Then check every 5 minutes.
     */

    autoCloseTimer =
        setInterval(
            () => {

                runAutoCloseOnce()
                    .catch(
                        error => {

                            console.error(
                                "❌ Auto-close worker error:",
                                error.message
                            );
                        }
                    );

            },
            AUTO_CLOSE_INTERVAL_MS
        );


    /*
     * Do not keep the entire Node
     * process alive just because
     * this timer exists.
     */

    if (
        typeof autoCloseTimer.unref ===
        "function"
    ) {

        autoCloseTimer.unref();
    }
}


/* =========================================================
   STOP WORKER
========================================================= */

function stopAutoCloseWorker() {

    if (
        !autoCloseTimer
    ) {

        return;
    }


    clearInterval(
        autoCloseTimer
    );


    autoCloseTimer =
        null;


    console.log(
        "🧹 Auto-close worker stopped."
    );
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    runAutoCloseOnce,

    startAutoCloseWorker,

    stopAutoCloseWorker
};
