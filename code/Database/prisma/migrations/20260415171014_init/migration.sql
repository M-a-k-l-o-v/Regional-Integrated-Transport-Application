ALTER TABLE "BusStop" ADD COLUMN     "indicator" TEXT;

CREATE TABLE "RailMovementLog" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "stanox" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timetableVariationMinutes" INTEGER,
    "variationStatus" TEXT,
    "platform" TEXT,
    "actualTimestampMs" BIGINT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RailMovementLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RailMovementLog_stanox_idx" ON "RailMovementLog"("stanox");
CREATE INDEX "RailMovementLog_receivedAt_idx" ON "RailMovementLog"("receivedAt");
CREATE INDEX "RailMovementLog_trainId_idx" ON "RailMovementLog"("trainId");
ALTER TABLE "BusRoute" RENAME CONSTRAINT "Route_operatorId_fkey" TO "BusRoute_operatorId_fkey";
