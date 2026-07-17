-- AlterTable
ALTER TABLE "Post" ADD COLUMN "important" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Post_important_idx" ON "Post"("important");
