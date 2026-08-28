-- One-time reset: mediador forgot the login password again. Also clears any
-- lockout from failed attempts while trying to log back in.
UPDATE "User"
SET "passwordHash" = '$2b$10$8R4Gd/Vxp2JU1Rtexi1qfu93GsuMTIz5aQQ8ArkdTPeQjVj3fIGZ2',
    "failedLoginAttempts" = 0,
    "lockedAt" = NULL
WHERE "email" = 'aline.marketing.maxled@gmail.com';
