-- CreateTable
CREATE TABLE "BusServiceCalendar" (
    "calendarId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "runsMon" BOOLEAN NOT NULL DEFAULT true,
    "runsTue" BOOLEAN NOT NULL DEFAULT true,
    "runsWed" BOOLEAN NOT NULL DEFAULT true,
    "runsThu" BOOLEAN NOT NULL DEFAULT true,
    "runsFri" BOOLEAN NOT NULL DEFAULT true,
    "runsSat" BOOLEAN NOT NULL DEFAULT true,
    "runsSun" BOOLEAN NOT NULL DEFAULT true,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusServiceCalendar_pkey" PRIMARY KEY ("calendarId")
);

-- CreateTable
CREATE TABLE "BusServiceException" (
    "exceptionId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isRunning" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusServiceException_pkey" PRIMARY KEY ("exceptionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusServiceCalendar_routeId_key" ON "BusServiceCalendar"("routeId");

-- CreateIndex
CREATE INDEX "BusServiceCalendar_serviceCode_idx" ON "BusServiceCalendar"("serviceCode");

-- CreateIndex
CREATE INDEX "BusServiceCalendar_validFrom_idx" ON "BusServiceCalendar"("validFrom");

-- CreateIndex
CREATE INDEX "BusServiceCalendar_validTo_idx" ON "BusServiceCalendar"("validTo");

-- CreateIndex
CREATE INDEX "BusServiceException_routeId_idx" ON "BusServiceException"("routeId");

-- CreateIndex
CREATE INDEX "BusServiceException_startDate_idx" ON "BusServiceException"("startDate");

-- CreateIndex
CREATE INDEX "BusServiceException_endDate_idx" ON "BusServiceException"("endDate");

-- CreateIndex
CREATE INDEX "BusServiceException_isRunning_idx" ON "BusServiceException"("isRunning");

-- AddForeignKey
ALTER TABLE "BusServiceCalendar" ADD CONSTRAINT "BusServiceCalendar_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusServiceException" ADD CONSTRAINT "BusServiceException_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;
