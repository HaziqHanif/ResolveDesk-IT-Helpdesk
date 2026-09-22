const {
    query
} = require("../db");


/* =========================================================
   CLIENT IP
========================================================= */

function getClientIp(req) {

    if (!req) {
        return null;
    }


    return (
        req.clientIp ||
        req.ip ||
        req.socket?.remoteAddress ||
        null
    );
}


/* =========================================================
   USER AGENT
========================================================= */

function getUserAgent(req) {

    if (!req) {
        return null;
    }


    return (
        req.get?.("user-agent") ||
        req.headers?.["user-agent"] ||
        null
    );
}


/* =========================================================
   WRITE AUDIT LOG
========================================================= */

async function writeAudit({

    actorId = null,

    action,

    entityType = null,

    entityId = null,

    severity = "INFO",

    metadata = {},

    req = null,

    ipAddress = null,

    userAgent = null

}) {

    try {

        if (!action) {

            throw new Error(
                "Audit action is required."
            );
        }


        await query(
            `
                INSERT INTO audit_logs (
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    severity,
                    metadata,
                    ip_address,
                    user_agent
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6::jsonb,
                    $7,
                    $8
                )
            `,
            [
                actorId,
                String(action),
                entityType
                    ? String(entityType)
                    : null,
                entityId !== null &&
                entityId !== undefined
                    ? String(entityId)
                    : null,
                severity,
                JSON.stringify(
                    metadata || {}
                ),
                ipAddress ||
                    getClientIp(req),
                userAgent ||
                    getUserAgent(req)
            ]
        );


        return true;

    } catch (error) {

        /*
            Audit failure should normally
            not crash the main request.
        */

        console.error(
            "⚠️ Audit log failed:",
            error.message
        );


        return false;
    }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    writeAudit,

    getClientIp,

    getUserAgent

};