-- One-time reset: mediador forgot the login password. Also clears any
-- lockout from the failed attempts while trying to log back in.
UPDATE "User"
SET "passwordHash" = '$2b$10$E4a1CoOjJf7oAG07/rtKWOAKR7x6nBuwuGt5Cmg/EJcHFnVyI4.kK',
    "failedLoginAttempts" = 0,
    "lockedAt" = NULL
WHERE "email" = 'aline.marketing.maxled@gmail.com';
