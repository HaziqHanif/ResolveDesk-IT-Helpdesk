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


const {
    writeAudit
} =
    require("../utils/audit");


const router =
    express.Router();


/* =========================================================
   SECURITY
========================================================= */

router.use(
    requireAuth
);


/* =========================================================
   CONSTANTS
========================================================= */

const ALLOWED_VISIBILITY = [

    "ALL_STAFF",

    "TECHNICIANS_ONLY",

    "ADMINISTRATORS_ONLY"

];


const ALLOWED_STATUS = [

    "DRAFT",

    "PUBLISHED",

    "ARCHIVED"

];


/* =========================================================
   HELPERS
========================================================= */

function validId(
    value
) {

    return /^\d+$/.test(
        String(
            value ||
            ""
        )
    );
}


function clean(
    value
) {

    return String(
        value ||
        ""
    ).trim();
}


function normalizeVisibility(
    value
) {

    const normalized =
        clean(
            value
        )
            .toUpperCase()
            .replaceAll(
                " ",
                "_"
            );


    if (
        ALLOWED_VISIBILITY.includes(
            normalized
        )
    ) {

        return normalized;
    }


    return "ALL_STAFF";
}


function slugify(
    value
) {

    return String(
        value ||
        ""
    )
        .toLowerCase()
        .normalize(
            "NFKD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        )
        .slice(
            0,
            220
        ) ||
        "article";
}


async function uniqueSlug(
    title,
    excludeId = null
) {

    const base =
        slugify(
            title
        );


    let candidate =
        base;


    for (
        let attempt = 1;
        attempt <= 100;
        attempt++
    ) {

        const values =
            [
                candidate
            ];


        let sql = `
            SELECT id

            FROM knowledge_base

            WHERE
                slug = $1
        `;


        if (
            excludeId !==
            null
        ) {

            values.push(
                excludeId
            );


            sql += `
                AND
                id <> $2
            `;
        }


        sql += `
            LIMIT 1
        `;


        const result =
            await query(
                sql,
                values
            );


        if (
            result.rowCount ===
            0
        ) {

            return candidate;
        }


        candidate =
            `${base}-${attempt + 1}`;
    }


    return `${
        base
    }-${
        Date.now()
    }`;
}


async function validateCategory(
    categoryId
) {

    if (
        categoryId ===
            null ||
        categoryId ===
            undefined ||
        categoryId ===
            ""
    ) {

        return null;
    }


    if (
        !validId(
            categoryId
        )
    ) {

        const error =
            new Error(
                "Invalid category."
            );


        error.statusCode =
            400;


        throw error;
    }


    const result =
        await query(
            `
                SELECT id

                FROM categories

                WHERE
                    id = $1

                LIMIT 1
            `,
            [
                categoryId
            ]
        );


    if (
        result.rowCount ===
        0
    ) {

        const error =
            new Error(
                "Knowledge Base category was not found."
            );


        error.statusCode =
            400;


        throw error;
    }


    return Number(
        categoryId
    );
}


function accessCondition(
    role
) {

    if (
        role ===
        "ADMIN"
    ) {

        return `
            TRUE
        `;
    }


    if (
        role ===
        "TECHNICIAN"
    ) {

        return `
            kb.visibility IN (
                'ALL_STAFF',
                'TECHNICIANS_ONLY'
            )
        `;
    }


    return `
        kb.visibility =
            'ALL_STAFF'
    `;
}


/* =========================================================
   COMMON SELECT
========================================================= */

function knowledgeSelect(
    role
) {

    return `
        SELECT

            kb.id,
            kb.title,
            kb.slug,
            kb.summary,
            kb.content,
            kb.category_id,

            c.name
                AS category_name,

            kb.author_id,

            author.full_name
                AS author_name,

            author.email
                AS author_email,

            kb.status,
            kb.visibility,
            kb.views,
            kb.helpful_yes,
            kb.helpful_no,
            kb.published_at,
            kb.created_at,
            kb.updated_at

        FROM knowledge_base kb

        LEFT JOIN categories c
            ON c.id =
                kb.category_id

        LEFT JOIN users author
            ON author.id =
                kb.author_id

        WHERE
            kb.status =
                'PUBLISHED'

            AND
            ${accessCondition(
                role
            )}
    `;
}


/* =========================================================
   FORMAT
========================================================= */

function articleObject(
    row
) {

    return {

        id:
            row.id,

        title:
            row.title,

        slug:
            row.slug,

        summary:
            row.summary ||
            "",

        content:
            row.content,

        categoryId:
            row.category_id,

        category:
            row.category_name ||
            "Uncategorised",

        authorId:
            row.author_id,

        author:
            row.author_name ||
            "ResolveDesk",

        authorEmail:
            row.author_email ||
            null,

        status:
            row.status,

        visibility:
            row.visibility,

        views:
            Number(
                row.views
            ) ||
            0,

        helpfulYes:
            Number(
                row.helpful_yes
            ) ||
            0,

        helpfulNo:
            Number(
                row.helpful_no
            ) ||
            0,

        publishedAt:
            row.published_at,

        createdAt:
            row.created_at,

        updatedAt:
            row.updated_at

    };
}


/* =========================================================
   LIST KB ARTICLES

   GET /api/knowledge-base
========================================================= */

router.get(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const [
                articlesResult,
                categoryResult
            ] =
                await Promise.all([

                    query(`
                        ${
                            knowledgeSelect(
                                req.user.role
                            )
                        }

                        ORDER BY

                            kb.updated_at DESC,

                            kb.id DESC
                    `),

                    query(`
                        SELECT

                            id,
                            name,
                            department_id

                        FROM categories

                        ORDER BY
                            name ASC
                    `)

                ]);


            const articles =
                articlesResult.rows.map(
                    articleObject
                );


            const totalViews =
                articles.reduce(
                    (
                        total,
                        article
                    ) =>
                        total +
                        article.views,
                    0
                );


            const helpfulYes =
                articles.reduce(
                    (
                        total,
                        article
                    ) =>
                        total +
                        article.helpfulYes,
                    0
                );


            const helpfulNo =
                articles.reduce(
                    (
                        total,
                        article
                    ) =>
                        total +
                        article.helpfulNo,
                    0
                );


            const feedbackTotal =
                helpfulYes +
                helpfulNo;


            const helpfulRate =
                feedbackTotal
                    ? Math.round(
                        helpfulYes /
                        feedbackTotal *
                        100
                    )
                    : null;


            return res.json({

                success:
                    true,

                articles,

                categories:
                    categoryResult.rows.map(
                        row => ({

                            id:
                                row.id,

                            name:
                                row.name,

                            departmentId:
                                row.department_id

                        })
                    ),

                stats: {

                    articles:
                        articles.length,

                    categories:
                        new Set(
                            articles
                                .map(
                                    article =>
                                        article.categoryId
                                )
                                .filter(Boolean)
                        ).size,

                    totalViews,

                    helpfulYes,

                    helpfulNo,

                    helpfulRate

                }

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


/* =========================================================
   VIEW ARTICLE + INCREMENT VIEW

   GET /api/knowledge-base/:id
========================================================= */

router.get(
    "/:id",
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
                            "Invalid article ID."

                    });
            }


            const found =
                await query(
                    `
                        ${
                            knowledgeSelect(
                                req.user.role
                            )
                        }

                        AND
                            kb.id = $1

                        LIMIT 1
                    `,
                    [
                        req.params.id
                    ]
                );


            if (
                found.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Knowledge article not found."

                    });
            }


            await query(
                `
                    UPDATE knowledge_base

                    SET
                        views =
                            views + 1

                    WHERE
                        id = $1
                `,
                [
                    req.params.id
                ]
            );


            found.rows[0].views =
                Number(
                    found.rows[0]
                        .views
                ) +
                1;


            return res.json({

                success:
                    true,

                article:
                    articleObject(
                        found.rows[0]
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
   CREATE ARTICLE

   POST /api/knowledge-base
   ADMIN ONLY
========================================================= */

router.post(
    "/",
    requireAdmin,
    async (
        req,
        res,
        next
    ) => {

        try {

            const title =
                clean(
                    req.body?.title
                );


            const summary =
                clean(
                    req.body?.summary
                );


            const content =
                clean(
                    req.body?.content
                );


            if (
                !title ||
                !summary ||
                !content
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Title, summary and content are required."

                    });
            }


            const categoryId =
                await validateCategory(
                    req.body?.categoryId
                );


            const visibility =
                normalizeVisibility(
                    req.body?.visibility
                );


            const slug =
                await uniqueSlug(
                    title
                );


            const result =
                await query(
                    `
                        INSERT INTO knowledge_base (

                            title,
                            slug,
                            summary,
                            content,
                            category_id,
                            author_id,
                            status,
                            visibility,
                            published_at

                        )

                        VALUES (

                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            'PUBLISHED',
                            $7,
                            NOW()

                        )

                        RETURNING id
                    `,
                    [

                        title,

                        slug,

                        summary,

                        content,

                        categoryId,

                        req.user.id,

                        visibility

                    ]
                );


            const id =
                result.rows[0]
                    .id;


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "KNOWLEDGE_ARTICLE_CREATED",

                entityType:
                    "KNOWLEDGE_ARTICLE",

                entityId:
                    id,

                metadata: {

                    title,

                    categoryId,

                    visibility

                },

                req

            });


            return res
                .status(201)
                .json({

                    success:
                        true,

                    message:
                        "Knowledge article published.",

                    id

                });

        } catch (
            error
        ) {

            if (
                error.statusCode
            ) {

                return res
                    .status(
                        error.statusCode
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
   UPDATE ARTICLE

   PUT /api/knowledge-base/:id
   ADMIN ONLY
========================================================= */

router.put(
    "/:id",
    requireAdmin,
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
                            "Invalid article ID."

                    });
            }


            const current =
                await query(
                    `
                        SELECT *

                        FROM knowledge_base

                        WHERE
                            id = $1

                        LIMIT 1
                    `,
                    [
                        req.params.id
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
                            "Knowledge article not found."

                    });
            }


            const old =
                current.rows[0];


            const title =
                clean(
                    req.body?.title
                ) ||
                old.title;


            const summary =
                req.body?.summary !==
                    undefined
                    ? clean(
                        req.body.summary
                    )
                    : old.summary;


            const content =
                req.body?.content !==
                    undefined
                    ? clean(
                        req.body.content
                    )
                    : old.content;


            const categoryId =
                req.body?.categoryId !==
                    undefined
                    ? await validateCategory(
                        req.body.categoryId
                    )
                    : old.category_id;


            const visibility =
                req.body?.visibility !==
                    undefined
                    ? normalizeVisibility(
                        req.body.visibility
                    )
                    : old.visibility;


            const requestedStatus =
                clean(
                    req.body?.status
                )
                    .toUpperCase();


            const status =
                ALLOWED_STATUS.includes(
                    requestedStatus
                )
                    ? requestedStatus
                    : old.status;


            const slug =
                title !==
                    old.title
                    ? await uniqueSlug(
                        title,
                        Number(
                            req.params.id
                        )
                    )
                    : old.slug;


            await query(
                `
                    UPDATE knowledge_base

                    SET
                        title = $1,
                        slug = $2,
                        summary = $3,
                        content = $4,
                        category_id = $5,
                        visibility = $6,
                        status = $7,
                        published_at =
                            CASE
                                WHEN
                                    $7 = 'PUBLISHED'
                                    AND
                                    published_at IS NULL

                                    THEN NOW()

                                ELSE
                                    published_at
                            END

                    WHERE
                        id = $8
                `,
                [

                    title,

                    slug,

                    summary,

                    content,

                    categoryId,

                    visibility,

                    status,

                    req.params.id

                ]
            );


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "KNOWLEDGE_ARTICLE_UPDATED",

                entityType:
                    "KNOWLEDGE_ARTICLE",

                entityId:
                    req.params.id,

                metadata: {
                    title,
                    categoryId,
                    visibility,
                    status
                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Knowledge article updated."

            });

        } catch (
            error
        ) {

            if (
                error.statusCode
            ) {

                return res
                    .status(
                        error.statusCode
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
   ARCHIVE ARTICLE

   DELETE /api/knowledge-base/:id
   ADMIN ONLY
========================================================= */

router.delete(
    "/:id",
    requireAdmin,
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
                            "Invalid article ID."

                    });
            }


            const result =
                await query(
                    `
                        UPDATE knowledge_base

                        SET
                            status =
                                'ARCHIVED'

                        WHERE
                            id = $1

                        RETURNING
                            id,
                            title
                    `,
                    [
                        req.params.id
                    ]
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
                            "Knowledge article not found."

                    });
            }


            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "KNOWLEDGE_ARTICLE_ARCHIVED",

                entityType:
                    "KNOWLEDGE_ARTICLE",

                entityId:
                    req.params.id,

                metadata: {

                    title:
                        result.rows[0]
                            .title

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Knowledge article archived."

            });

        } catch (
            error
        ) {

            next(error);
        }
    }
);


/* =========================================================
   HELPFUL FEEDBACK

   POST /api/knowledge-base/:id/helpful
========================================================= */

router.post(
    "/:id/helpful",
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
                            "Invalid article ID."

                    });
            }


            const helpful =
                req.body?.helpful;


            if (
                typeof helpful !==
                "boolean"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Helpful must be true or false."

                    });
            }


            /*
                Confirm that this user is
                actually allowed to see it.
            */

            const accessible =
                await query(
                    `
                        ${
                            knowledgeSelect(
                                req.user.role
                            )
                        }

                        AND
                            kb.id = $1

                        LIMIT 1
                    `,
                    [
                        req.params.id
                    ]
                );


            if (
                accessible.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Knowledge article not found."

                    });
            }


            const column =
                helpful
                    ? "helpful_yes"
                    : "helpful_no";


            const result =
                await query(
                    `
                        UPDATE knowledge_base

                        SET
                            ${column} =
                                ${column} + 1

                        WHERE
                            id = $1

                        RETURNING
                            helpful_yes,
                            helpful_no
                    `,
                    [
                        req.params.id
                    ]
                );


            return res.json({

                success:
                    true,

                helpfulYes:
                    Number(
                        result.rows[0]
                            .helpful_yes
                    ),

                helpfulNo:
                    Number(
                        result.rows[0]
                            .helpful_no
                    )

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