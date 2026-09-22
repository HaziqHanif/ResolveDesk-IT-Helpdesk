const {
    query
} =
    require("../db");


function cleanText(
    value,
    maxLength = 500
) {

    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );
}


async function createNotification({
    client = null,
    userId,
    type,
    title,
    body = null,
    link = null
}) {

    if (
        !userId
    ) {

        return null;
    }


    const safeType =
        cleanText(
            type,
            50
        ) ||
        "GENERAL";


    const safeTitle =
        cleanText(
            title,
            180
        );


    if (
        !safeTitle
    ) {

        return null;
    }


    const safeBody =
        body
            ? cleanText(
                body,
                2000
            )
            : null;


    const safeLink =
        link
            ? cleanText(
                link,
                1000
            )
            : null;


    const sql = `
        INSERT INTO notifications (
            user_id,
            type,
            title,
            body,
            link
        )

        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
        )

        RETURNING
            id,
            user_id,
            type,
            title,
            body,
            link,
            read_at,
            created_at
    `;


    const values = [

        userId,

        safeType,

        safeTitle,

        safeBody,

        safeLink

    ];


    const result =
        client
            ? await client.query(
                sql,
                values
            )
            : await query(
                sql,
                values
            );


    return (
        result.rows[0] ||
        null
    );
}


module.exports = {

    createNotification

};