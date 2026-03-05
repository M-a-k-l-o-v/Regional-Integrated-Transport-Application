/*
  Warnings:

  - You are about to drop the `Schedule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_routeId_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_stationId_fkey";

-- DropTable
DROP TABLE "Schedule";

-- CreateTable
CREATE TABLE "RailSchedule" (
    "scheduleId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailSchedule_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "BusSchedule" (
    "scheduleId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusSchedule_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateIndex
CREATE INDEX "RailSchedule_routeId_idx" ON "RailSchedule"("routeId");

-- CreateIndex
CREATE INDEX "RailSchedule_stationId_idx" ON "RailSchedule"("stationId");

-- CreateIndex
CREATE INDEX "RailSchedule_arrivalTime_idx" ON "RailSchedule"("arrivalTime");

-- CreateIndex
CREATE INDEX "BusSchedule_routeId_idx" ON "BusSchedule"("routeId");

-- CreateIndex
CREATE INDEX "BusSchedule_stopId_idx" ON "BusSchedule"("stopId");

-- CreateIndex
CREATE INDEX "BusSchedule_arrivalTime_idx" ON "BusSchedule"("arrivalTime");

-- AddForeignKey
ALTER TABLE "RailSchedule" ADD CONSTRAINT "RailSchedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailSchedule" ADD CONSTRAINT "RailSchedule_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusSchedule" ADD CONSTRAINT "BusSchedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusSchedule" ADD CONSTRAINT "BusSchedule_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "BusStop"("stopId") ON DELETE CASCADE ON UPDATE CASCADE;
