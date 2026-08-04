-- AlterTable
ALTER TABLE "ClientActivationRequest" ADD COLUMN "personType" "PersonType";
ALTER TABLE "ClientActivationRequest" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "department" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "mobile" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "residentialPhone" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "assistantPhone" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "birthday" TIMESTAMP(3);
ALTER TABLE "ClientActivationRequest" ADD COLUMN "leadSource" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "supplierName" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "commercialPotential" "CommercialPotential";
ALTER TABLE "ClientActivationRequest" ADD COLUMN "nextContactAt" TIMESTAMP(3);
ALTER TABLE "ClientActivationRequest" ADD COLUMN "street" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "number" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "city" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "state" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "ClientActivationRequest" ADD COLUMN "notes" TEXT;
