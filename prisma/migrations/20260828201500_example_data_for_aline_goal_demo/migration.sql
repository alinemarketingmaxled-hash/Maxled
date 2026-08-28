-- Sets a Meta 1/Meta 2 + commission rate on the Mediador's own account, and
-- adds one clearly-labeled example contact + closed deal owned by her, so
-- the "Meta do mês"/"Comissão" widgets and "Negociações"/funil cards show
-- something instead of being empty on a brand-new account. Safe to delete
-- ("Cliente de Exemplo (pode apagar)") once real data exists.

UPDATE "User"
SET "goal1" = 50000,
    "goal2" = 80000,
    "commissionPct1" = 2.40,
    "commissionPct2" = 3.60,
    "commissionStepValue" = 5000
WHERE "email" = 'aline.marketing.maxled@gmail.com';

INSERT INTO "Contact" (
  "id", "ownerId", "firstName", "lastName", "accountName",
  "profile", "crmStatus", "createdAt", "updatedAt"
)
SELECT
  'example-aline-contact-1',
  "id",
  'Cliente',
  'de Exemplo (pode apagar)',
  'Empresa Exemplo Ltda',
  'Comércio',
  'ATIVO',
  now(),
  now()
FROM "User"
WHERE "email" = 'aline.marketing.maxled@gmail.com'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Deal" (
  "id", "ownerId", "contactId", "stageId", "name", "value",
  "paymentStatus", "createdAt", "updatedAt"
)
SELECT
  'example-aline-deal-1',
  u."id",
  'example-aline-contact-1',
  s."id",
  'Empresa Exemplo Ltda — negócio de exemplo',
  34000.00,
  'PAGO',
  now(),
  now()
FROM "User" u
CROSS JOIN LATERAL (
  SELECT ps."id"
  FROM "PipelineStage" ps
  JOIN "Pipeline" p ON p."id" = ps."pipelineId"
  WHERE p."isDefault" = true AND ps."isWon" = true
  ORDER BY ps."order" ASC
  LIMIT 1
) s
WHERE u."email" = 'aline.marketing.maxled@gmail.com'
ON CONFLICT ("id") DO NOTHING;
