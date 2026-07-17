-- AlterTable
ALTER TABLE "Task" ADD COLUMN "prospectId" TEXT;
CREATE INDEX "Task_prospectId_idx" ON "Task"("prospectId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
