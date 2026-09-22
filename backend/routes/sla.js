/* =========================================================
   RESOLVEDESK SLA UTILITIES
========================================================= */

const SLA_DEFAULTS = {

    CRITICAL: {
        responseMinutes: 15,
        resolutionMinutes: 60
    },

    HIGH: {
        responseMinutes: 30,
        resolutionMinutes: 240
    },

    MEDIUM: {
        responseMinutes: 120,
        resolutionMinutes: 480
    },

    LOW: {
        responseMinutes: 240,
        resolutionMinutes: 1440
    }

};


/* =========================================================
   NORMALIZE PRIORITY
========================================================= */

function normalizePriority(
    priority
) {

    const value =
        String(
            priority ||
            "MEDIUM"
        )
            .trim()
            .toUpperCase();


    if (
        Object.prototype
            .hasOwnProperty.call(
                SLA_DEFAULTS,
                value
            )
    ) {

        return value;
    }


    return "MEDIUM";
}


/* =========================================================
   DEFAULT SLA
========================================================= */

function getDefaultSla(
    priority
) {

    const normalized =
        normalizePriority(
            priority
        );


    return {

        priority:
            normalized,

        ...SLA_DEFAULTS[
            normalized
        ]

    };
}


/* =========================================================
   NORMAL 24/7 MINUTES
========================================================= */

function addMinutes(
    date,
    minutes
) {

    const start =
        new Date(
            date
        );


    if (
        Number.isNaN(
            start.getTime()
        )
    ) {

        throw new Error(
            "Invalid SLA start date."
        );
    }


    return new Date(
        start.getTime() +
        Number(minutes) *
        60 *
        1000
    );
}


/* =========================================================
   BUSINESS HOURS HELPERS
========================================================= */

function getWorkingDays(
    value
) {

    const text =
        String(
            value ||
            "Monday – Friday"
        )
            .toLowerCase()
            .replace(
                /[–—]/g,
                "-"
            );


    if (
        text.includes(
            "every"
        )
    ) {

        return new Set([
            0, 1, 2, 3, 4, 5, 6
        ]);
    }


    if (
        text.includes(
            "saturday"
        )
    ) {

        return new Set([
            1, 2, 3, 4, 5, 6
        ]);
    }


    return new Set([
        1, 2, 3, 4, 5
    ]);
}


function parseTimeToMinutes(
    value,
    fallback
) {

    const text =
        String(
            value ||
            fallback
        );


    const match =
        /^(\d{2}):(\d{2})$/
            .exec(
                text
            );


    if (!match) {

        return parseTimeToMinutes(
            fallback,
            "08:00"
        );
    }


    const hour =
        Number(
            match[1]
        );


    const minute =
        Number(
            match[2]
        );


    if (
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {

        return parseTimeToMinutes(
            fallback,
            "08:00"
        );
    }


    return (
        hour *
        60
    ) +
    minute;
}


function getZonedDateParts(
    date,
    timeZone
) {

    let safeTimeZone =
        timeZone ||
        "Asia/Kuala_Lumpur";


    try {

        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    safeTimeZone
            }
        );

    } catch {

        safeTimeZone =
            "Asia/Kuala_Lumpur";
    }


    const formatter =
        new Intl.DateTimeFormat(
            "en-US",
            {

                timeZone:
                    safeTimeZone,

                weekday:
                    "short",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hourCycle:
                    "h23"

            }
        );


    const parts =
        formatter.formatToParts(
            date
        );


    const values =
        {};


    for (
        const part of parts
    ) {

        if (
            part.type !==
            "literal"
        ) {

            values[
                part.type
            ] =
                part.value;
        }
    }


    const dayMap = {

        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6

    };


    return {

        day:
            dayMap[
                values.weekday
            ],

        minutes:
            (
                Number(
                    values.hour
                ) *
                60
            ) +
            Number(
                values.minute
            )

    };
}


/* =========================================================
   ADD BUSINESS MINUTES
========================================================= */

function addBusinessMinutes(
    date,
    minutes,
    options = {}
) {

    const start =
        new Date(
            date
        );


    if (
        Number.isNaN(
            start.getTime()
        )
    ) {

        throw new Error(
            "Invalid SLA start date."
        );
    }


    let remaining =
        Math.max(
            0,
            Math.ceil(
                Number(
                    minutes
                ) || 0
            )
        );


    if (
        remaining === 0
    ) {

        return start;
    }


    const timeZone =
        options.timeZone ||
        "Asia/Kuala_Lumpur";


    const workingDays =
        getWorkingDays(
            options.workingDays
        );


    let businessStart =
        parseTimeToMinutes(
            options.businessStart,
            "08:00"
        );


    let businessEnd =
        parseTimeToMinutes(
            options.businessEnd,
            "17:00"
        );


    /*
        ResolveDesk currently uses
        same-day business shifts.
    */

    if (
        businessEnd <=
        businessStart
    ) {

        businessStart =
            8 * 60;

        businessEnd =
            17 * 60;
    }


    let cursor =
        new Date(
            start.getTime()
        );


    /*
        Move through real time minute by minute.

        SLA minutes are consumed only while
        the configured service desk is open.

        Even a multi-day SLA is only a few
        thousand iterations, so this stays
        simple and predictable.
    */

    const MAX_ITERATIONS =
        1000000;


    for (
        let i = 0;

        i <
        MAX_ITERATIONS;

        i += 1
    ) {

        const local =
            getZonedDateParts(
                cursor,
                timeZone
            );


        const workingDay =
            workingDays.has(
                local.day
            );


        const withinHours =
            local.minutes >=
                businessStart &&
            local.minutes <
                businessEnd;


        if (
            workingDay &&
            withinHours
        ) {

            remaining -=
                1;


            if (
                remaining <= 0
            ) {

                return new Date(
                    cursor.getTime() +
                    60 *
                    1000
                );
            }
        }


        cursor =
            new Date(
                cursor.getTime() +
                60 *
                1000
            );
    }


    throw new Error(
        "Unable to calculate business-hours SLA deadline."
    );
}


/* =========================================================
   CALCULATE SLA DEADLINES
========================================================= */

function calculateSlaDeadlines({

    priority,

    createdAt =
        new Date(),

    responseMinutes =
        null,

    resolutionMinutes =
        null,

    businessHoursOnly =
        false,

    timeZone =
        "Asia/Kuala_Lumpur",

    workingDays =
        "Monday – Friday",

    businessStart =
        "08:00",

    businessEnd =
        "17:00"

}) {

    const policy =
        getDefaultSla(
            priority
        );


    const response =
        Number.isFinite(
            Number(
                responseMinutes
            )
        ) &&
        Number(
            responseMinutes
        ) > 0

            ? Number(
                responseMinutes
            )

            : policy
                .responseMinutes;


    const resolution =
        Number.isFinite(
            Number(
                resolutionMinutes
            )
        ) &&
        Number(
            resolutionMinutes
        ) > 0

            ? Number(
                resolutionMinutes
            )

            : policy
                .resolutionMinutes;


    const start =
        new Date(
            createdAt
        );


    if (
        Number.isNaN(
            start.getTime()
        )
    ) {

        throw new Error(
            "Invalid SLA start date."
        );
    }


    const schedule = {

        timeZone,

        workingDays,

        businessStart,

        businessEnd

    };


    return {

        priority:
            policy.priority,

        responseMinutes:
            response,

        resolutionMinutes:
            resolution,

        businessHoursOnly:
            Boolean(
                businessHoursOnly
            ),

        responseDueAt:
            businessHoursOnly

                ? addBusinessMinutes(
                    start,
                    response,
                    schedule
                )

                : addMinutes(
                    start,
                    response
                ),

        resolutionDueAt:
            businessHoursOnly

                ? addBusinessMinutes(
                    start,
                    resolution,
                    schedule
                )

                : addMinutes(
                    start,
                    resolution
                )

    };
}


/* =========================================================
   SLA STATUS
========================================================= */

function getSlaStatus({

    responseDueAt,

    resolutionDueAt,

    firstResponseAt =
        null,

    resolvedAt =
        null,

    now =
        new Date()

}) {

    const current =
        new Date(
            now
        );


    const responseDue =
        responseDueAt
            ? new Date(
                responseDueAt
            )
            : null;


    const resolutionDue =
        resolutionDueAt
            ? new Date(
                resolutionDueAt
            )
            : null;


    const firstResponse =
        firstResponseAt
            ? new Date(
                firstResponseAt
            )
            : null;


    const resolved =
        resolvedAt
            ? new Date(
                resolvedAt
            )
            : null;


    const responseBreached =
        responseDue
            ? (
                firstResponse
                    ? firstResponse >
                        responseDue
                    : current >
                        responseDue
            )
            : false;


    const resolutionBreached =
        resolutionDue
            ? (
                resolved
                    ? resolved >
                        resolutionDue
                    : current >
                        resolutionDue
            )
            : false;


    return {

        responseBreached,

        resolutionBreached,

        breached:
            responseBreached ||
            resolutionBreached

    };
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    SLA_DEFAULTS,

    normalizePriority,

    getDefaultSla,

    addMinutes,

    addBusinessMinutes,

    calculateSlaDeadlines,

    getSlaStatus

};