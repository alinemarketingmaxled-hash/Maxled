-- AlterTable
ALTER TABLE "ProspectStage" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Outros';

-- AlterTable
ALTER TABLE "ClientActivationRequest" ADD COLUMN "sellerSeenAt" TIMESTAMP(3);
