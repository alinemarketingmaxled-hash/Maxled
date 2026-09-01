-- Adds 4 optional fields to the "Cliente completo" activation flow and the
-- Contact record it creates: regime tributário, porte da empresa, site, and
-- referências comerciais. All nullable, no backfill needed.

ALTER TABLE "Contact" ADD COLUMN "taxRegime" TEXT;
ALTER TABLE "Contact" ADD COLUMN "companySize" TEXT;
ALTER TABLE "Contact" ADD COLUMN "website" TEXT;
ALTER TABLE "Contact" ADD COLUMN "businessReferences" TEXT;

ALTER TABLE "ClientActivationRequest" ADD COLUMN "taxRegime" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "companySize" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "website" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "businessReferences" TEXT;
