const multer =
    require("multer");

const path =
    require("path");

const fs =
    require("fs");

const crypto =
    require("crypto");


const {
    getRuntimeSettings
} =
    require("../utils/runtime-settings");


/* =========================================================
   UPLOAD DIRECTORY
========================================================= */

const uploadDirectory =
    path.join(
        __dirname,
        "..",
        "uploads"
    );


if (
    !fs.existsSync(
        uploadDirectory
    )
) {

    fs.mkdirSync(
        uploadDirectory,
        {
            recursive: true
        }
    );
}


/* =========================================================
   LIMITS
========================================================= */

const MAX_FILES =
    5;


const DEFAULT_MAX_FILE_SIZE =
    10 *
    1024 *
    1024;


/* =========================================================
   ALLOWED MIME TYPES
========================================================= */

const allowedMimeTypes =
    new Map([

        [
            "image/jpeg",
            ".jpg"
        ],

        [
            "image/png",
            ".png"
        ],

        [
            "image/webp",
            ".webp"
        ],

        [
            "application/pdf",
            ".pdf"
        ],

        [
            "text/plain",
            ".txt"
        ]

    ]);


/* =========================================================
   STORAGE
========================================================= */

const storage =
    multer.diskStorage({

        destination: (
            req,
            file,
            callback
        ) => {

            callback(
                null,
                uploadDirectory
            );
        },


        filename: (
            req,
            file,
            callback
        ) => {

            const extension =
                allowedMimeTypes.get(
                    file.mimetype
                ) ||
                "";


            const random =
                crypto
                    .randomBytes(18)
                    .toString("hex");


            const storedName =
                `${
                    Date.now()
                }-${
                    random
                }${
                    extension
                }`;


            callback(
                null,
                storedName
            );
        }

    });


/* =========================================================
   FILE FILTER
========================================================= */

function fileFilter(
    req,
    file,
    callback
) {

    if (
        !allowedMimeTypes.has(
            file.mimetype
        )
    ) {

        const error =
            new Error(
                "Unsupported file type. Only JPG, PNG, WEBP, PDF and TXT files are allowed."
            );


        error.code =
            "INVALID_FILE_TYPE";


        return callback(
            error
        );
    }


    callback(
        null,
        true
    );
}


/* =========================================================
   MULTER FACTORY
========================================================= */

function createAttachmentUpload(
    maxFileSize =
        DEFAULT_MAX_FILE_SIZE
) {

    return multer({

        storage,

        limits: {

            files:
                MAX_FILES,

            fileSize:
                maxFileSize

        },

        fileFilter

    }).array(
        "attachments",
        MAX_FILES
    );
}


/*
    Compatibility middleware using
    the original 10 MB limit.

    Existing routes importing
    attachmentUpload will not break.
*/

const attachmentUpload =
    createAttachmentUpload(
        DEFAULT_MAX_FILE_SIZE
    );


/* =========================================================
   CLEANUP
========================================================= */

async function deleteUploadedFiles(
    files = []
) {

    await Promise.all(

        files.map(

            async file => {

                if (
                    !file?.path
                ) {

                    return;
                }


                try {

                    await fs.promises.unlink(
                        file.path
                    );

                } catch (
                    error
                ) {

                    if (
                        error.code !==
                        "ENOENT"
                    ) {

                        console.error(
                            "⚠️ Upload cleanup failed:",
                            error.message
                        );
                    }
                }
            }
        )
    );
}


/* =========================================================
   DYNAMIC ATTACHMENT MIDDLEWARE
========================================================= */

async function handleAttachmentUpload(
    req,
    res,
    next
) {

    let limitMb =
        10;


    try {

        const settings =
            await getRuntimeSettings();


        limitMb =
            Math.max(
                1,
                Number(
                    settings
                        ?.tickets
                        ?.attachmentLimitMb
                ) ||
                10
            );

    } catch (
        error
    ) {

        console.warn(
            "⚠️ Unable to read attachment settings:",
            error.message
        );
    }


    const dynamicUpload =
        createAttachmentUpload(
            limitMb *
            1024 *
            1024
        );


    dynamicUpload(

        req,

        res,

        async error => {

            if (
                !error
            ) {

                return next();
            }


            await deleteUploadedFiles(
                req.files ||
                []
            );


            if (
                error instanceof
                multer.MulterError
            ) {

                if (
                    error.code ===
                    "LIMIT_FILE_SIZE"
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            message:
                                `Each attachment must be ${limitMb}MB or smaller.`

                        });
                }


                if (
                    error.code ===
                    "LIMIT_FILE_COUNT"
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            message:
                                `A maximum of ${MAX_FILES} attachments is allowed.`

                        });
                }


                if (
                    error.code ===
                    "LIMIT_UNEXPECTED_FILE"
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            message:
                                "Unexpected attachment field."

                        });
                }


                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            error.message ||
                            "Attachment upload failed."

                    });
            }


            if (
                error.code ===
                "INVALID_FILE_TYPE"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            error.message

                    });
            }


            console.error(
                "❌ Attachment upload:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Unable to upload attachment."

                });
        }
    );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    attachmentUpload,

    handleAttachmentUpload,

    deleteUploadedFiles,

    uploadDirectory,

    createAttachmentUpload,

    MAX_FILES

};
