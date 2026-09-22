const crypto = require("crypto");

const {
    promisify
} = require("util");


const scryptAsync =
    promisify(
        crypto.scrypt
    );


/* =========================================================
   HASH PASSWORD
========================================================= */

async function hashPassword(
    password
) {

    if (
        typeof password !== "string" ||
        password.length < 8
    ) {

        throw new Error(
            "Password must contain at least 8 characters."
        );
    }


    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");


    const derivedKey =
        await scryptAsync(
            password,
            salt,
            64
        );


    return [
        "scrypt",
        salt,
        Buffer
            .from(derivedKey)
            .toString("hex")
    ].join(":");
}


/* =========================================================
   VERIFY PASSWORD
========================================================= */

async function verifyPassword(
    password,
    storedHash
) {

    try {

        if (
            typeof password !== "string" ||
            typeof storedHash !== "string"
        ) {

            return false;
        }


        const parts =
            storedHash.split(":");


        if (
            parts.length !== 3 ||
            parts[0] !== "scrypt"
        ) {

            return false;
        }


        const salt =
            parts[1];


        const storedKey =
            Buffer.from(
                parts[2],
                "hex"
            );


        const derivedKey =
            Buffer.from(
                await scryptAsync(
                    password,
                    salt,
                    storedKey.length
                )
            );


        if (
            storedKey.length !==
            derivedKey.length
        ) {

            return false;
        }


        return crypto.timingSafeEqual(
            storedKey,
            derivedKey
        );

    } catch (
        error
    ) {

        return false;
    }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    hashPassword,

    verifyPassword

};