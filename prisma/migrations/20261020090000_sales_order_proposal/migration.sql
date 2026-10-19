-- Proposta comercial com link de aprovação pelo cliente.
ALTER TABLE "SalesOrder" ADD COLUMN "proposalTokenHash" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN "proposalTokenEnc" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN "proposalSentAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "proposalViewedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "proposalAcceptedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "proposalAcceptedBy" TEXT;

CREATE UNIQUE INDEX "SalesOrder_proposalTokenHash_key" ON "SalesOrder"("proposalTokenHash");
