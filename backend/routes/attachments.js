const express =
    require("express");

const path =
    require("path");

const fs =
    require("fs");


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
    handleAttachmentUpload,
    deleteUploadedFiles,
    uploadDirectory
} =
    require("../middleware/upload");


const {
    writeAudit
} =
    require("../utils/audit");


const router =
    express.Router();


/* =========================================================
   AUTH REQUIRED
========================================================= */

router.use(
    requireAuth
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


/* =========================================================
   SAFE ATTACHMENT OBJECT
========================================================= */

function attachmentObject(
    row
) {

    return {

        id:
            row.id,

        ticketId:
            row.ticket_id,

        uploadedBy:
            row.uploaded_by,

        uploadedByName:
            row.uploaded_by_name ||
            null,

        originalName:
            row.original_name,

        mimeType:
            row.mime_type,

        sizeBytes:
            row.size_bytes,

        createdAt:
            row.created_at,

        viewUrl:
            `/api/attachments/${
                row.id
            }/view`,

        downloadUrl:
            `/api/attachments/${
                row.id
            }/download`

    };
}


/* =========================================================
   CHECK TICKET ACCESS
========================================================= */

async function getAccessibleTicket(
    executor,
    req,
    ticketId
) {

    const result =
        await executor.query(
            `
                SELECT
                    id,
                    requester_id,
                    assigned_to,
                    department_id,
                    status

                FROM tickets

                WHERE id = $1

                LIMIT 1
            `,
            [
                ticketId
            ]
        );


    if (
        result.rowCount ===
        0
    ) {

        return {

            found:
                false,

            allowed:
                false,

            ticket:
                null

        };
    }


    const ticket =
        result.rows[0];


    /* =====================================================
       ADMIN
    ===================================================== */

    if (
        req.user.role ===
        "ADMIN"
    ) {

        return {

            found:
                true,

            allowed:
                true,

            ticket

        };
    }


    /* =====================================================
       STAFF

       Can access own ticket only.
    ===================================================== */

    if (
        req.user.role ===
        "STAFF"
    ) {

        return {

            found:
                true,

            allowed:
                String(
                    ticket.requester_id
                ) ===
                String(
                    req.user.id
                ),

            ticket

        };
    }


    /* =====================================================
       TECHNICIAN

       Can access:
       - assigned ticket
       - unassigned ticket in own department
    ===================================================== */

    if (
        req.user.role ===
        "TECHNICIAN"
    ) {

        const assignedToMe =
            String(
                ticket.assigned_to ||
                ""
            ) ===
            String(
                req.user.id
            );


        const unassignedInDepartment =
            !ticket.assigned_to &&
            req.user.departmentId &&
            String(
                ticket.department_id
            ) ===
            String(
                req.user.departmentId
            );


        return {

            found:
                true,

            allowed:
                assignedToMe ||
                unassignedInDepartment,

            ticket

        };
    }


    return {

        found:
            true,

        allowed:
            false,

        ticket

    };
}


/* =========================================================
   ADD TICKET HISTORY
========================================================= */

async function addHistory(
    client,
    {
        ticketId,
        actorId,
        action,
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
                NULL,
                NULL,
                $4::jsonb
            )
        `,
        [
            ticketId,
            actorId,
            action,
            JSON.stringify(
                metadata ||
                {}
            )
        ]
    );
}


/* =========================================================
   RESOLVE PHYSICAL FILE
========================================================= */

function getPhysicalFilePath(
    storedName
) {

    /*
        basename prevents path traversal
        even if bad data somehow enters DB.
    */

    const safeName =
        path.basename(
            String(
                storedName ||
                ""
            )
        );


    return path.join(
        uploadDirectory,
        safeName
    );
}


/* =========================================================
   LIST TICKET ATTACHMENTS

   GET
   /api/attachments/ticket/:ticketId
========================================================= */

router.get(
    "/ticket/:ticketId",
    async (
        req,
        res,
        next
    ) => {

        try {

            if (
                !validId(
                    req.params.ticketId
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


            const access =
                await getAccessibleTicket(
                    {
                        query
                    },
                    req,
                    req.params.ticketId
                );


            if (
                !access.found
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
                !access.allowed
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        message:
                            "You do not have access to this ticket."

                    });
            }


            const result =
                await query(
                    `
                        SELECT
                            a.id,
                            a.ticket_id,
                            a.uploaded_by,
                            a.original_name,
                            a.stored_name,
                            a.mime_type,
                            a.size_bytes,
                            a.file_path,
                            a.created_at,

                            u.full_name
                                AS uploaded_by_name

                        FROM ticket_attachments a

                        LEFT JOIN users u
                            ON u.id =
                                a.uploaded_by

                        WHERE
                            a.ticket_id = $1

                        ORDER BY
                            a.created_at ASC
                    `,
                    [
                        req.params.ticketId
                    ]
                );


            return res.json({

                success:
                    true,

                count:
                    result.rowCount,

                attachments:
                    result.rows.map(
                        attachmentObject
                    )

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   UPLOAD ATTACHMENTS

   POST
   /api/attachments/ticket/:ticketId

   multipart field:
   attachments
========================================================= */

router.post(
    "/ticket/:ticketId",

    handleAttachmentUpload,

    async (
        req,
        res,
        next
    ) => {

        const files =
            req.files ||
            [];


        try {

            /* =================================================
               VALIDATE TICKET ID
            ================================================= */

            if (
                !validId(
                    req.params.ticketId
                )
            ) {

                await deleteUploadedFiles(
                    files
                );


                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Invalid ticket ID."

                    });
            }


            /* =================================================
               FILE REQUIRED
            ================================================= */

            if (
                files.length ===
                0
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Select at least one attachment."

                    });
            }


            /* =================================================
               DATABASE TRANSACTION
            ================================================= */

            const inserted =
                await withTransaction(
                    async client => {

                        /* =====================================
                           ACCESS CHECK
                        ===================================== */

                        const access =
                            await getAccessibleTicket(
                                client,
                                req,
                                req.params.ticketId
                            );


                        if (
                            !access.found
                        ) {

                            const error =
                                new Error(
                                    "Ticket not found."
                                );


                            error.status =
                                404;


                            throw error;
                        }


                        if (
                            !access.allowed
                        ) {

                            const error =
                                new Error(
                                    "You do not have permission to upload attachments to this ticket."
                                );


                            error.status =
                                403;


                            throw error;
                        }


                        /* =====================================
                           CLOSED TICKET
                        ===================================== */

                        if (
                            access.ticket.status ===
                            "CLOSED"
                        ) {

                            const error =
                                new Error(
                                    "Attachments cannot be added to a closed ticket."
                                );


                            error.status =
                                400;


                            throw error;
                        }


                        const created =
                            [];


                        /* =====================================
                           INSERT EACH FILE
                        ===================================== */

                        for (
                            const file of files
                        ) {

                            const relativePath =
                                path
                                    .relative(
                                        path.join(
                                            __dirname,
                                            ".."
                                        ),
                                        file.path
                                    )
                                    .replaceAll(
                                        "\\",
                                        "/"
                                    );


                            const result =
                                await client.query(
                                    `
                                        INSERT INTO ticket_attachments (
                                            ticket_id,
                                            uploaded_by,
                                            original_name,
                                            stored_name,
                                            mime_type,
                                            size_bytes,
                                            file_path
                                        )
                                        VALUES (
                                            $1,
                                            $2,
                                            $3,
                                            $4,
                                            $5,
                                            $6,
                                            $7
                                        )

                                        RETURNING
                                            id,
                                            ticket_id,
                                            uploaded_by,
                                            original_name,
                                            stored_name,
                                            mime_type,
                                            size_bytes,
                                            file_path,
                                            created_at
                                    `,
                                    [
                                        req.params.ticketId,
                                        req.user.id,
                                        file.originalname,
                                        file.filename,
                                        file.mimetype,
                                        file.size,
                                        relativePath
                                    ]
                                );


                            created.push(
                                result.rows[0]
                            );
                        }


                        /* =====================================
                           HISTORY
                        ===================================== */

                        await addHistory(
                            client,
                            {

                                ticketId:
                                    req.params.ticketId,

                                actorId:
                                    req.user.id,

                                action:
                                    "ATTACHMENTS_ADDED",

                                metadata: {

                                    count:
                                        created.length,

                                    attachmentIds:
                                        created.map(
                                            attachment =>
                                                attachment.id
                                        ),

                                    files:
                                        created.map(
                                            attachment => ({

                                                id:
                                                    attachment.id,

                                                name:
                                                    attachment.original_name,

                                                mimeType:
                                                    attachment.mime_type,

                                                sizeBytes:
                                                    attachment.size_bytes

                                            })
                                        )

                                }

                            }
                        );


                        return created;
                    }
                );


            /* =================================================
               AUDIT
            ================================================= */

            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "TICKET_ATTACHMENTS_ADDED",

                entityType:
                    "TICKET",

                entityId:
                    req.params.ticketId,

                severity:
                    "INFO",

                metadata: {

                    count:
                        inserted.length,

                    attachmentIds:
                        inserted.map(
                            item =>
                                item.id
                        )

                },

                req

            });


            /* =================================================
               RESPONSE
            ================================================= */

            return res
                .status(201)
                .json({

                    success:
                        true,

                    message:
                        `${
                            inserted.length
                        } attachment${
                            inserted.length ===
                            1
                                ? ""
                                : "s"
                        } uploaded successfully.`,

                    attachments:
                        inserted.map(
                            attachmentObject
                        )

                });

        } catch (error) {

            /*
                Multer writes file first.
                If DB or permission fails,
                delete those physical files.
            */

            await deleteUploadedFiles(
                files
            );


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
   INLINE PREVIEW

   GET
   /api/attachments/:id/view
========================================================= */

router.get(
    "/:id/view",
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
                            "Invalid attachment ID."

                    });
            }


            const result =
                await query(
                    `
                        SELECT
                            id,
                            ticket_id,
                            uploaded_by,
                            original_name,
                            stored_name,
                            mime_type,
                            size_bytes,
                            created_at

                        FROM ticket_attachments

                        WHERE id = $1

                        LIMIT 1
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
                            "Attachment not found."

                    });
            }


            const attachment =
                result.rows[0];


            /* =================================================
               PERMISSION
            ================================================= */

            const access =
                await getAccessibleTicket(
                    {
                        query
                    },
                    req,
                    attachment.ticket_id
                );


            if (
                !access.found ||
                !access.allowed
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        message:
                            "You do not have permission to view this attachment."

                    });
            }


            /* =================================================
               PHYSICAL FILE
            ================================================= */

            const fullPath =
                getPhysicalFilePath(
                    attachment.stored_name
                );


            if (
                !fs.existsSync(
                    fullPath
                )
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Attachment file is missing from storage."

                    });
            }


            /* =================================================
               SECURITY HEADERS
            ================================================= */

            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );


            res.setHeader(
                "Content-Type",
                attachment.mime_type
            );


            res.setHeader(
                "Content-Disposition",
                `inline; filename*=UTF-8''${
                    encodeURIComponent(
                        attachment.original_name
                    )
                }`
            );


            return res.sendFile(
                fullPath
            );

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   DOWNLOAD ATTACHMENT

   GET
   /api/attachments/:id/download
========================================================= */

router.get(
    "/:id/download",
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
                            "Invalid attachment ID."

                    });
            }


            const result =
                await query(
                    `
                        SELECT
                            id,
                            ticket_id,
                            uploaded_by,
                            original_name,
                            stored_name,
                            mime_type,
                            size_bytes,
                            created_at

                        FROM ticket_attachments

                        WHERE id = $1

                        LIMIT 1
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
                            "Attachment not found."

                    });
            }


            const attachment =
                result.rows[0];


            /* =================================================
               ACCESS
            ================================================= */

            const access =
                await getAccessibleTicket(
                    {
                        query
                    },
                    req,
                    attachment.ticket_id
                );


            if (
                !access.found ||
                !access.allowed
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        message:
                            "You do not have permission to access this attachment."

                    });
            }


            /* =================================================
               PHYSICAL FILE
            ================================================= */

            const fullPath =
                getPhysicalFilePath(
                    attachment.stored_name
                );


            if (
                !fs.existsSync(
                    fullPath
                )
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Attachment file is missing from storage."

                    });
            }


            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );


            return res.download(
                fullPath,
                attachment.original_name
            );

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   DELETE ATTACHMENT

   DELETE
   /api/attachments/:id

   Allowed:
   ADMIN
   OR original uploader while ticket isn't CLOSED
========================================================= */

router.delete(
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
                            "Invalid attachment ID."

                    });
            }


            /* =================================================
               FIND ATTACHMENT
            ================================================= */

            const attachmentResult =
                await query(
                    `
                        SELECT
                            id,
                            ticket_id,
                            uploaded_by,
                            original_name,
                            stored_name,
                            mime_type,
                            size_bytes,
                            created_at

                        FROM ticket_attachments

                        WHERE id = $1

                        LIMIT 1
                    `,
                    [
                        req.params.id
                    ]
                );


            if (
                attachmentResult.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Attachment not found."

                    });
            }


            const attachment =
                attachmentResult.rows[0];


            /* =================================================
               ACCESS TICKET
            ================================================= */

            const access =
                await getAccessibleTicket(
                    {
                        query
                    },
                    req,
                    attachment.ticket_id
                );


            if (
                !access.found
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
                !access.allowed
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        message:
                            "You do not have permission to access this attachment."

                    });
            }


            /* =================================================
               DELETE PERMISSION
            ================================================= */

            const isAdmin =
                req.user.role ===
                "ADMIN";


            const isUploader =
                String(
                    attachment.uploaded_by ||
                    ""
                ) ===
                String(
                    req.user.id
                );


            const ticketClosed =
                access.ticket.status ===
                "CLOSED";


            const canDelete =
                isAdmin ||
                (
                    isUploader &&
                    !ticketClosed
                );


            if (
                !canDelete
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        message:
                            "You do not have permission to delete this attachment."

                    });
            }


            /* =================================================
               DATABASE DELETE + HISTORY
            ================================================= */

            await withTransaction(
                async client => {

                    await client.query(
                        `
                            DELETE FROM ticket_attachments

                            WHERE id = $1
                        `,
                        [
                            attachment.id
                        ]
                    );


                    await addHistory(
                        client,
                        {

                            ticketId:
                                attachment.ticket_id,

                            actorId:
                                req.user.id,

                            action:
                                "ATTACHMENT_REMOVED",

                            metadata: {

                                attachmentId:
                                    attachment.id,

                                originalName:
                                    attachment.original_name,

                                mimeType:
                                    attachment.mime_type,

                                sizeBytes:
                                    attachment.size_bytes

                            }

                        }
                    );
                }
            );


            /* =================================================
               DELETE PHYSICAL FILE
            ================================================= */

            const fullPath =
                getPhysicalFilePath(
                    attachment.stored_name
                );


            try {

                await fs.promises.unlink(
                    fullPath
                );

            } catch (error) {

                /*
                    Database deletion already succeeded.
                    ENOENT means file was already missing.
                */

                if (
                    error.code !==
                    "ENOENT"
                ) {

                    console.error(
                        "⚠️ Unable to delete attachment file:",
                        error.message
                    );
                }
            }


            /* =================================================
               AUDIT
            ================================================= */

            await writeAudit({

                actorId:
                    req.user.id,

                action:
                    "TICKET_ATTACHMENT_REMOVED",

                entityType:
                    "TICKET",

                entityId:
                    attachment.ticket_id,

                severity:
                    "INFO",

                metadata: {

                    attachmentId:
                        attachment.id,

                    originalName:
                        attachment.original_name

                },

                req

            });


            return res.json({

                success:
                    true,

                message:
                    "Attachment removed successfully."

            });

        } catch (error) {

            next(error);
        }
    }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports =
    router;