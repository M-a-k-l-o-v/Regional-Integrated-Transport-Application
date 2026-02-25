-- CreateTable
CREATE TABLE "BusStop" (
    "stopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "localityId" TEXT,
    "stopType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusStop_pkey" PRIMARY KEY ("stopId")
);

-- CreateTable
CREATE TABLE "BusRouteStop" (
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,

    CONSTRAINT "BusRouteStop_pkey" PRIMARY KEY ("routeId","stopId")
);

-- CreateIndex
CREATE INDEX "BusStop_name_idx" ON "BusStop"("name");

-- CreateIndex
CREATE INDEX "BusStop_localityId_idx" ON "BusStop"("localityId");

-- CreateIndex
CREATE INDEX "BusRouteStop_stopId_idx" ON "BusRouteStop"("stopId");

-- CreateIndex
CREATE UNIQUE INDEX "BusRouteStop_routeId_stopOrder_key" ON "BusRouteStop"("routeId", "stopOrder");

-- AddForeignKey
ALTER TABLE "BusStop" ADD CONSTRAINT "BusStop_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("localityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusRouteStop" ADD CONSTRAINT "BusRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusRouteStop" ADD CONSTRAINT "BusRouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "BusStop"("stopId") ON DELETE CASCADE ON UPDATE CASCADE;
