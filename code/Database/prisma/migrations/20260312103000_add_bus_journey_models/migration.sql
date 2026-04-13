-- CreateTable
CREATE TABLE "BusJourney" (
    "journeyId" TEXT NOT NULL,
    "journeyKey" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleJourneyCode" TEXT NOT NULL,
    "journeyPatternRef" TEXT NOT NULL,
    "lineRef" TEXT,
    "direction" TEXT,
    "destinationDisplay" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusJourney_pkey" PRIMARY KEY ("journeyId")
);

-- CreateTable
CREATE TABLE "BusJourneyStop" (
    "journeyStopId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "stopSeq" INTEGER NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "offsetSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusJourneyStop_pkey" PRIMARY KEY ("journeyStopId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusJourney_journeyKey_key" ON "BusJourney"("journeyKey");

-- CreateIndex
CREATE INDEX "BusJourney_routeId_idx" ON "BusJourney"("routeId");

-- CreateIndex
CREATE INDEX "BusJourney_serviceDate_idx" ON "BusJourney"("serviceDate");

-- CreateIndex
CREATE INDEX "BusJourney_departureTime_idx" ON "BusJourney"("departureTime");

-- CreateIndex
CREATE INDEX "BusJourney_sourceFile_idx" ON "BusJourney"("sourceFile");

-- CreateIndex
CREATE INDEX "BusJourney_vehicleJourneyCode_idx" ON "BusJourney"("vehicleJourneyCode");

-- CreateIndex
CREATE UNIQUE INDEX "BusJourneyStop_journeyId_stopSeq_key" ON "BusJourneyStop"("journeyId", "stopSeq");

-- CreateIndex
CREATE INDEX "BusJourneyStop_stopId_idx" ON "BusJourneyStop"("stopId");

-- CreateIndex
CREATE INDEX "BusJourneyStop_departureTime_idx" ON "BusJourneyStop"("departureTime");

-- AddForeignKey
ALTER TABLE "BusJourney" ADD CONSTRAINT "BusJourney_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "BusRoute"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusJourneyStop" ADD CONSTRAINT "BusJourneyStop_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "BusJourney"("journeyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusJourneyStop" ADD CONSTRAINT "BusJourneyStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "BusStop"("stopId") ON DELETE CASCADE ON UPDATE CASCADE;
