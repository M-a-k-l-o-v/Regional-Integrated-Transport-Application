-- CreateTable
CREATE TABLE "Locality" (
    "localityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locality_pkey" PRIMARY KEY ("localityId")
);

-- CreateIndex
CREATE INDEX "Locality_name_idx" ON "Locality"("name");

-- CreateIndex
CREATE INDEX "Locality_parentId_idx" ON "Locality"("parentId");
