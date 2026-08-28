-- Reverts the example goal/contact/deal added for the Mediador's account
-- (20260828201500_example_data_for_aline_goal_demo): she asked for the real
-- layout/design to always show on its own, not for fabricated numbers.
DELETE FROM "Deal" WHERE "id" = 'example-aline-deal-1';
DELETE FROM "Contact" WHERE "id" = 'example-aline-contact-1';

UPDATE "User"
SET "goal1" = NULL,
    "goal2" = NULL,
    "commissionPct1" = NULL,
    "commissionPct2" = NULL,
    "commissionStepValue" = NULL
WHERE "email" = 'aline.marketing.maxled@gmail.com';
