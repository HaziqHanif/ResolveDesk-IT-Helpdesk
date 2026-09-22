/* =========================================================
   RESOLVEDESK TICKET NUMBER UTILITIES
========================================================= */

function normalizePrefix(
    value
) {

    const prefix =
        String(
            value ||
            "RD"
        )
            .trim()
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ""
            )
            .slice(
                0,
                6
            );


    return prefix ||
        "RD";
}


function formatTicketNumber(
    prefix,
    number
) {

    const safePrefix =
        normalizePrefix(
            prefix
        );


    const safeNumber =
        Math.max(
            1,
            Math.floor(
                Number(
                    number
                ) || 1
            )
        );


    return (
        `${safePrefix}-${safeNumber}`
    );
}


module.exports = {

    normalizePrefix,

    formatTicketNumber

};