CREATE TABLE "RebuttalSnapshot" (
 "id" UUID NOT NULL, "rebuttalId" UUID NOT NULL, "revision" INTEGER NOT NULL,
 "generalResponse" TEXT NOT NULL, "responses" JSONB NOT NULL,
 "finalizedAt" TIMESTAMPTZ(3) NOT NULL, "authorId" UUID NOT NULL,
 CONSTRAINT "RebuttalSnapshot_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "RebuttalSnapshot_rebuttalId_fkey" FOREIGN KEY ("rebuttalId") REFERENCES "Rebuttal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "RebuttalSnapshot_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RebuttalSnapshot_rebuttalId_revision_key" ON "RebuttalSnapshot"("rebuttalId", "revision");
CREATE TRIGGER "RebuttalSnapshot_immutable" BEFORE UPDATE OR DELETE ON "RebuttalSnapshot" FOR EACH ROW EXECUTE FUNCTION proview_immutable_row();
