-- CreateTable
CREATE TABLE "Station" (
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("stationId")
);
