-- Contact: sintegra-style fields, filled when a Prospect is approved as an active client
ALTER TABLE "Contact" ADD COLUMN "inscricaoEstadual" TEXT;
ALTER TABLE "Contact" ADD COLUMN "emailFinanceiro" TEXT;
ALTER TABLE "Contact" ADD COLUMN "emailNfe" TEXT;
ALTER TABLE "Contact" ADD COLUMN "enderecoEntrega" TEXT;

-- CreateEnum
CREATE TYPE "ProspectTemperature" AS ENUM ('QUENTE', 'MORNO', 'FRIO');
CREATE TYPE "ActivationStatus" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "ProspectStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isClientStage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectStage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProspectStage_order_idx" ON "ProspectStage"("order");

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "temperature" "ProspectTemperature" NOT NULL DEFAULT 'MORNO',
    "profile" TEXT NOT NULL,
    "notes" TEXT,
    "contactDate" TIMESTAMP(3) NOT NULL,
    "currentStageId" TEXT NOT NULL,
    "convertedContactId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "lastTouchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Prospect_ownerId_idx" ON "Prospect"("ownerId");
CREATE INDEX "Prospect_currentStageId_idx" ON "Prospect"("currentStageId");
CREATE INDEX "Prospect_deletedAt_idx" ON "Prospect"("deletedAt");

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "ProspectStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ProspectStageValue" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectStageValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProspectStageValue_prospectId_stageId_key" ON "ProspectStageValue"("prospectId", "stageId");
CREATE INDEX "ProspectStageValue_prospectId_idx" ON "ProspectStageValue"("prospectId");

ALTER TABLE "ProspectStageValue" ADD CONSTRAINT "ProspectStageValue_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProspectStageValue" ADD CONSTRAINT "ProspectStageValue_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProspectStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ClientActivationRequest" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "emailFinanceiro" TEXT NOT NULL,
    "emailNfe" TEXT NOT NULL,
    "inscricaoEstadual" TEXT NOT NULL,
    "enderecoFaturamento" TEXT NOT NULL,
    "enderecoEntrega" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "condicaoPagamento" TEXT NOT NULL,
    "status" "ActivationStatus" NOT NULL DEFAULT 'PENDENTE',
    "reviewerId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ClientActivationRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientActivationRequest_prospectId_key" ON "ClientActivationRequest"("prospectId");
CREATE INDEX "ClientActivationRequest_status_idx" ON "ClientActivationRequest"("status");

ALTER TABLE "ClientActivationRequest" ADD CONSTRAINT "ClientActivationRequest_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientActivationRequest" ADD CONSTRAINT "ClientActivationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
