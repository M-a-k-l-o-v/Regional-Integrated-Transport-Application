-- CreateTable
CREATE TABLE "RouteStop" (
    "routeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("routeId","stationId")
);

-- CreateIndex
CREATE INDEX "RouteStop_stationId_idx" ON "RouteStop"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_stopOrder_key" ON "RouteStop"("routeId", "stopOrder");

-- RenameForeignKey
ALTER TABLE "BusRoute" RENAME CONSTRAINT "Route_operatorId_fkey" TO "BusRoute_operatorId_fkey";

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "BusRoute"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("stationId") ON DELETE CASCADE ON UPDATE CASCADE;
