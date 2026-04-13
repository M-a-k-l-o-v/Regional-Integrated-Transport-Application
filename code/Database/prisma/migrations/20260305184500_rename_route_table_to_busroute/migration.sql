-- Rename physical table so Prisma Studio shows BusRoute under Tables.
ALTER TABLE IF EXISTS "Route" RENAME TO "BusRoute";

-- Keep index names tidy (safe no-op if already renamed/missing).
ALTER INDEX IF EXISTS "Route_pkey" RENAME TO "BusRoute_pkey";
ALTER INDEX IF EXISTS "Route_operatorId_idx" RENAME TO "BusRoute_operatorId_idx";
ALTER INDEX IF EXISTS "Route_mode_idx" RENAME TO "BusRoute_mode_idx";
