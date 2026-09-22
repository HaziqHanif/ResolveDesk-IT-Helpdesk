/* =========================================================
   ROLE MIDDLEWARE
========================================================= */

function requireRole(
    ...allowedRoles
) {

    const normalizedRoles =
        allowedRoles
            .flat()
            .map(
                role =>
                    String(role)
                        .trim()
                        .toUpperCase()
            );


    return (
        req,
        res,
        next
    ) => {

        if (
            !req.user
        ) {

            return res
                .status(401)
                .json({

                    success:
                        false,

                    message:
                        "Authentication required."

                });
        }


        const role =
            String(
                req.user.role ||
                ""
            ).toUpperCase();


        if (
            !normalizedRoles.includes(
                role
            )
        ) {

            return res
                .status(403)
                .json({

                    success:
                        false,

                    code:
                        "ACCESS_DENIED",

                    message:
                        "You do not have permission to perform this action."

                });
        }


        next();
    };
}


/* =========================================================
   COMMON ROLE GUARDS
========================================================= */

const requireAdmin =
    requireRole(
        "ADMIN"
    );


const requireTechnician =
    requireRole(
        "TECHNICIAN"
    );


const requireStaff =
    requireRole(
        "STAFF"
    );


const requireSupport =
    requireRole(
        "ADMIN",
        "TECHNICIAN"
    );


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    requireRole,

    requireAdmin,

    requireTechnician,

    requireStaff,

    requireSupport

};