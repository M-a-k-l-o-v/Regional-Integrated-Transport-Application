CREATE UNIQUE INDEX "BusSchedule_routeId_stopId_arrivalTime_departureTime_key"
ON "BusSchedule"("routeId", "stopId", "arrivalTime", "departureTime");
