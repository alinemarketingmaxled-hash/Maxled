-- DropForeignKey
ALTER TABLE "PostLike" DROP CONSTRAINT "PostLike_postId_fkey";
ALTER TABLE "PostComment" DROP CONSTRAINT "PostComment_postId_fkey";

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
