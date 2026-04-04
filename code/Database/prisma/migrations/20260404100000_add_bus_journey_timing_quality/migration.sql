CREATE TYPE "BusJourneyTimingSource" AS ENUM (
  'VEHICLE_JOURNEY_LINKS',
  'JOURNEY_PATTERN_LINKS',
  'DERIVED_FROM_PATTERN_PEER',
  'INTERPOLATED',
  'UNUSABLE'
);

CREATE TYPE "BusJourneyTimingQuality" AS ENUM (
  'EXACT',
  'REPAIRED',
  'ESTIMATED',
  'INVALID'
);

ALTER TABLE "BusJourney"
  ADD COLUMN "timingSource" "BusJourneyTimingSource" NOT NULL DEFAULT 'UNUSABLE',
  ADD COLUMN "timingQuality" "BusJourneyTimingQuality" NOT NULL DEFAULT 'INVALID',
  ADD COLUMN "totalEdgeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "positiveEdgeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nonPositiveEdgeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "timingRepairNote" TEXT;

CREATE INDEX "BusJourney_serviceDate_timingQuality_idx" ON "BusJourney"("serviceDate", "timingQuality");
