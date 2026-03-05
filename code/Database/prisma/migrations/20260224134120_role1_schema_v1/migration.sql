/*
  Warnings:

  - Added the required column `updatedAt` to the `Station` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('RAIL', 'BUS', 'TRAM', 'METRO', 'FERRY', 'OTHER');

-- CreateEnum
CREATE TYPE "ApiHealthStatus" AS ENUM ('OK', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Operator" (
    "operatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("operatorId")
);

-- CreateTable
CREATE TABLE "Route" (
    "routeId" TEXT NOT NULL,
    "mode" "TransportMode" NOT NULL DEFAULT 'OTHER',
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("routeId")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "routeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("routeId","stationId")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "scheduleId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "ServiceStatus" (
    "statusId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stationId" TEXT,
    "delayMinutes" INTEGER NOT NULL,
    "cancellationFlag" BOOLEAN NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceStatus_pkey" PRIMARY KEY ("statusId")
);

-- CreateTable
CREATE TABLE "Disruption" (
    "disruptionId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disruption_pkey" PRIMARY KEY ("disruptionId")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "rateLimitPolicy" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE "APIHealth" (
    "apiHealthId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ApiHealthStatus" NOT NULL DEFAULT 'OK',
    "responseTimeMs" INTEGER NOT NULL,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIHealth_pkey" PRIMARY KEY ("apiHealthId")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "jobRunId" TEXT NOT NULL,
    "sourceId" TEXT,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'SUCCESS',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("jobRunId")
);

-- CreateTable
CREATE TABLE "ExternalRouteSnapshot" (
    "snapshotId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalRouteKey" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "normalisedJson" JSONB NOT NULL,

    CONSTRAINT "ExternalRouteSnapshot_pkey" PRIMARY KEY ("snapshotId")
);

-- CreateTable
CREATE TABLE "RouteVerification" (
    "verificationId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "primarySourceId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "lastVerified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "RouteVerification_pkey" PRIMARY KEY ("verificationId")
);

-- CreateTable
CREATE TABLE "ReliabilityScore" (
    "scoreId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReliabilityScore_pkey" PRIMARY KEY ("scoreId")
);

-- CreateTable
CREATE TABLE "HistoricalPerformance" (
    "perfId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stationId" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "cancelled" BOOLEAN NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "HistoricalPerformance_pkey" PRIMARY KEY ("perfId")
);

-- CreateTable
CREATE TABLE "Strike" (
    "strikeId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Strike_pkey" PRIMARY KEY ("strikeId")
);

-- CreateIndex
CREATE INDEX "Route_operatorId_idx" ON "Route"("operatorId");

-- CreateIndex
CREATE INDEX "Route_mode_idx" ON "Route"("mode");

-- CreateIndex
CREATE INDEX "RouteStop_stationId_idx" ON "RouteStop"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_stopOrder_key" ON "RouteStop"("routeId", "stopOrder");

-- CreateIndex
CREATE INDEX "Schedule_routeId_idx" ON "Schedule"("routeId");

-- CreateIndex
CREATE INDEX "Schedule_stationId_idx" ON "Schedule"("stationId");

-- CreateIndex
CREATE INDEX "Schedule_arrivalTime_idx" ON "Schedule"("arrivalTime");

-- CreateIndex
CREATE INDEX "ServiceStatus_routeId_idx" ON "ServiceStatus"("routeId");

-- CreateIndex
CREATE INDEX "ServiceStatus_stationId_idx" ON "ServiceStatus"("stationId");

-- CreateIndex
CREATE INDEX "ServiceStatus_lastUpdated_idx" ON "ServiceStatus"("lastUpdated");

-- CreateIndex
CREATE INDEX "Disruption_routeId_idx" ON "Disruption"("routeId");

-- CreateIndex
CREATE INDEX "Disruption_startTime_idx" ON "Disruption"("startTime");

-- CreateIndex
CREATE INDEX "DataSource_enabled_idx" ON "DataSource"("enabled");

-- CreateIndex
CREATE INDEX "APIHealth_sourceId_idx" ON "APIHealth"("sourceId");

-- CreateIndex
CREATE INDEX "APIHealth_lastChecked_idx" ON "APIHealth"("lastChecked");

-- CreateIndex
CREATE UNIQUE INDEX "APIHealth_sourceId_lastChecked_key" ON "APIHealth"("sourceId", "lastChecked");

-- CreateIndex
CREATE INDEX "JobRun_jobName_idx" ON "JobRun"("jobName");

-- CreateIndex
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");

-- CreateIndex
CREATE INDEX "JobRun_sourceId_idx" ON "JobRun"("sourceId");

-- CreateIndex
CREATE INDEX "ExternalRouteSnapshot_routeId_idx" ON "ExternalRouteSnapshot"("routeId");

-- CreateIndex
CREATE INDEX "ExternalRouteSnapshot_sourceId_idx" ON "ExternalRouteSnapshot"("sourceId");

-- CreateIndex
CREATE INDEX "ExternalRouteSnapshot_retrievedAt_idx" ON "ExternalRouteSnapshot"("retrievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRouteSnapshot_routeId_sourceId_payloadHash_key" ON "ExternalRouteSnapshot"("routeId", "sourceId", "payloadHash");

-- CreateIndex
CREATE INDEX "RouteVerification_routeId_idx" ON "RouteVerification"("routeId");

-- CreateIndex
CREATE INDEX "RouteVerification_primarySourceId_idx" ON "RouteVerification"("primarySourceId");

-- CreateIndex
CREATE INDEX "RouteVerification_lastVerified_idx" ON "RouteVerification"("lastVerified");

-- CreateIndex
CREATE INDEX "ReliabilityScore_routeId_idx" ON "ReliabilityScore"("routeId");

-- CreateIndex
CREATE INDEX "ReliabilityScore_calculatedAt_idx" ON "ReliabilityScore"("calculatedAt");

-- CreateIndex
CREATE INDEX "HistoricalPerformance_routeId_idx" ON "HistoricalPerformance"("routeId");

-- CreateIndex
CREATE INDEX "HistoricalPerformance_stationId_idx" ON "HistoricalPerformance"("stationId");

-- CreateIndex
CREATE INDEX "HistoricalPerformance_serviceDate_idx" ON "HistoricalPerformance"("serviceDate");

-- CreateIndex
CREATE INDEX "HistoricalPerformance_sourceId_idx" ON "HistoricalPerformance"("sourceId");

-- CreateIndex
CREATE INDEX "Strike_operatorId_idx" ON "Strike"("operatorId");

-- CreateIndex
CREATE INDEX "Strike_startDate_idx" ON "Strike"("startDate");

-- CreateIndex
CREATE INDEX "Station_name_idx" ON "Station"("name");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("operatorId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStatus" ADD CONSTRAINT "ServiceStatus_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStatus" ADD CONSTRAINT "ServiceStatus_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disruption" ADD CONSTRAINT "Disruption_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIHealth" ADD CONSTRAINT "APIHealth_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("sourceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRouteSnapshot" ADD CONSTRAINT "ExternalRouteSnapshot_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRouteSnapshot" ADD CONSTRAINT "ExternalRouteSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteVerification" ADD CONSTRAINT "RouteVerification_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteVerification" ADD CONSTRAINT "RouteVerification_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "DataSource"("sourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityScore" ADD CONSTRAINT "ReliabilityScore_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalPerformance" ADD CONSTRAINT "HistoricalPerformance_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalPerformance" ADD CONSTRAINT "HistoricalPerformance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalPerformance" ADD CONSTRAINT "HistoricalPerformance_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("operatorId") ON DELETE CASCADE ON UPDATE CASCADE;
