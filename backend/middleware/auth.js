const {
    query
} = require("../db");


/* =========================================================
   REQUIRE AUTHENTICATION
========================================================= */

async function requireAuth(
    req,
    res,
    next
) {

    try {

        const sessionUser =
            req.session?.user;


        if (
            !sessionUser ||
            !sessionUser.id
        ) {

            return res
                .status(401)
                .json({

                    success:
                        false,

                    code:
                        "AUTH_REQUIRED",

                    message:
                        "Authentication required."

                });
        }


        /* =================================================
           RE-CHECK USER IN DATABASE

           This means a suspended/deactivated account
           cannot keep using an old active session.
        ================================================= */

        const result =
            await query(
                `
                    SELECT
                        u.id,
                        u.full_name,
                        u.email,
                        u.role,
                        u.status,
                        u.department_id,
                        d.name
                            AS department_name

                    FROM users u

                    LEFT JOIN departments d
                        ON d.id =
                            u.department_id

                    WHERE u.id = $1

                    LIMIT 1
                `,
                [
                    sessionUser.id
                ]
            );


        if (
            result.rowCount ===
            0
        ) {

            return destroyInvalidSession(
                req,
                res
            );
        }


        const user =
            result.rows[0];


        if (
            user.status !==
            "ACTIVE"
        ) {

            return destroyInvalidSession(
                req,
                res
            );
        }


        /* =================================================
           ATTACH USER TO REQUEST
        ================================================= */

        req.user = {

            id:
                user.id,

            fullName:
                user.full_name,

            email:
                user.email,

            role:
                user.role,

            status:
                user.status,

            departmentId:
                user.department_id,

            department:
                user.department_name

        };


        next();

    } catch (error) {

        next(error);
    }
}


/* =========================================================
   OPTIONAL AUTH

   Useful later for pages/endpoints that work
   for both guest and logged-in users.
========================================================= */

async function optionalAuth(
    req,
    res,
    next
) {

    try {

        if (
            !req.session?.user?.id
        ) {

            req.user =
                null;


            return next();
        }


        const result =
            await query(
                `
                    SELECT
                        u.id,
                        u.full_name,
                        u.email,
                        u.role,
                        u.status,
                        u.department_id,
                        d.name
                            AS department_name

                    FROM users u

                    LEFT JOIN departments d
                        ON d.id =
                            u.department_id

                    WHERE u.id = $1

                    LIMIT 1
                `,
                [
                    req.session.user.id
                ]
            );


        const user =
            result.rows[0];


        if (
            !user ||
            user.status !==
            "ACTIVE"
        ) {

            req.user =
                null;


            return next();
        }


        req.user = {

            id:
                user.id,

            fullName:
                user.full_name,

            email:
                user.email,

            role:
                user.role,

            status:
                user.status,

            departmentId:
                user.department_id,

            department:
                user.department_name

        };


        next();

    } catch (error) {

        next(error);
    }
}


/* =========================================================
   DESTROY INVALID SESSION
========================================================= */

function destroyInvalidSession(
    req,
    res
) {

    if (
        !req.session
    ) {

        return res
            .status(401)
            .json({

                success:
                    false,

                code:
                    "SESSION_INVALID",

                message:
                    "Your session is no longer valid."

            });
    }


    req.session.destroy(
        () => {

            res.clearCookie(
                "resolvedesk.sid"
            );


            return res
                .status(401)
                .json({

                    success:
                        false,

                    code:
                        "SESSION_INVALID",

                    message:
                        "Your session is no longer valid."

                });
        }
    );
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    requireAuth,

    optionalAuth

};