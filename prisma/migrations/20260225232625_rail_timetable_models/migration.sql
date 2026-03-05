/*
  Warnings:

  - You are about to drop the `RailSchedule` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RailLocationType" AS ENUM ('LO', 'LI', 'LT');

-- DropForeignKey
ALTER TABLE "RailSchedule" DROP CONSTRAINT "RailSchedule_routeId_fkey";

-- DropForeignKey
ALTER TABLE "RailSchedule" DROP CONSTRAINT "RailSchedule_stationId_fkey";

-- DropTable
DROP TABLE "RailSchedule";

-- CreateTable
CREATE TABLE "RailTiploc" (
    "tiplocCode" TEXT NOT NULL,
    "nalco" TEXT,
    "stanox" TEXT,
    "crsCode" TEXT,
    "description" TEXT,
    "tpsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailTiploc_pkey" PRIMARY KEY ("tiplocCode")
);

-- CreateTable
CREATE TABLE "RailServiceSchedule" (
    "scheduleId" TEXT NOT NULL,
    "trainUid" TEXT NOT NULL,
    "stpIndicator" TEXT NOT NULL,
    "atocCode" TEXT,
    "signallingId" TEXT,
    "scheduleStartDate" TIMESTAMP(3) NOT NULL,
    "scheduleEndDate" TIMESTAMP(3) NOT NULL,
    "scheduleDaysRuns" TEXT NOT NULL,
    "trainStatus" TEXT,
    "trainCategory" TEXT,
    "headcode" TEXT,
    "serviceCode" TEXT,
    "businessSector" TEXT,
    "powerType" TEXT,
    "timingLoad" TEXT,
    "speed" TEXT,
    "operatingCharacteristics" TEXT,
    "trainClass" TEXT,
    "sleepers" TEXT,
    "reservations" TEXT,
    "connectionIndicator" TEXT,
    "cateringCode" TEXT,
    "serviceBranding" TEXT,
    "routeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailServiceSchedule_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "RailServiceStop" (
    "stopId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "stopSeq" INTEGER NOT NULL,
    "locationType" "RailLocationType" NOT NULL,
    "recordIdentity" TEXT,
    "tiplocCode" TEXT NOT NULL,
    "stationId" TEXT,
    "arrival" TEXT,
    "publicArrival" TEXT,
    "departure" TEXT,
    "publicDeparture" TEXT,
    "pass" TEXT,
    "platform" TEXT,
    "line" TEXT,
    "path" TEXT,
    "engineeringAllowance" TEXT,
    "pathingAllowance" TEXT,
    "performanceAllowance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RailServiceStop_pkey" PRIMARY KEY ("stopId")
);

-- CreateIndex
CREATE INDEX "RailTiploc_crsCode_idx" ON "RailTiploc"("crsCode");

-- CreateIndex
CREATE INDEX "RailTiploc_stanox_idx" ON "RailTiploc"("stanox");

-- CreateIndex
CREATE INDEX "RailTiploc_nalco_idx" ON "RailTiploc"("nalco");

-- CreateIndex
CREATE INDEX "RailServiceSchedule_trainUid_idx" ON "RailServiceSchedule"("trainUid");

-- CreateIndex
CREATE INDEX "RailServiceSchedule_atocCode_idx" ON "RailServiceSchedule"("atocCode");

-- CreateIndex
CREATE INDEX "RailServiceSchedule_signallingId_idx" ON "RailServiceSchedule"("signallingId");

-- CreateIndex
CREATE INDEX "RailServiceSchedule_scheduleStartDate_idx" ON "RailServiceSchedule"("scheduleStartDate");

-- CreateIndex
CREATE INDEX "RailServiceSchedule_scheduleEndDate_idx" ON "RailServiceSchedule"("scheduleEndDate");

-- CreateIndex
CREATE INDEX "RailServiceSchedule_routeId_idx" ON "RailServiceSchedule"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "RailServiceSchedule_trainUid_stpIndicator_scheduleStartDate_key" ON "RailServiceSchedule"("trainUid", "stpIndicator", "scheduleStartDate", "scheduleEndDate");

-- CreateIndex
CREATE INDEX "RailServiceStop_tiplocCode_idx" ON "RailServiceStop"("tiplocCode");

-- CreateIndex
CREATE INDEX "RailServiceStop_stationId_idx" ON "RailServiceStop"("stationId");

-- CreateIndex
CREATE INDEX "RailServiceStop_locationType_idx" ON "RailServiceStop"("locationType");

-- CreateIndex
CREATE UNIQUE INDEX "RailServiceStop_scheduleId_stopSeq_key" ON "RailServiceStop"("scheduleId", "stopSeq");

-- AddForeignKey
ALTER TABLE "RailServiceSchedule" ADD CONSTRAINT "RailServiceSchedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailServiceStop" ADD CONSTRAINT "RailServiceStop_tiplocCode_fkey" FOREIGN KEY ("tiplocCode") REFERENCES "RailTiploc"("tiplocCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailServiceStop" ADD CONSTRAINT "RailServiceStop_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailServiceStop" ADD CONSTRAINT "RailServiceStop_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RailServiceSchedule"("scheduleId") ON DELETE CASCADE ON UPDATE CASCADE;
