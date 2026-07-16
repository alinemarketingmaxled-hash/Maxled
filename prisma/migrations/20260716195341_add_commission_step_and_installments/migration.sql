-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionStepValue" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "DealInstallment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealInstallment_dealId_idx" ON "DealInstallment"("dealId");

-- AddForeignKey
ALTER TABLE "DealInstallment" ADD CONSTRAINT "DealInstallment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
