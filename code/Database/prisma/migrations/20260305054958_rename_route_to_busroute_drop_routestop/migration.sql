/*
  Warnings:

  - You are about to drop the `RouteStop` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RouteStop" DROP CONSTRAINT "RouteStop_routeId_fkey";

-- DropForeignKey
ALTER TABLE "RouteStop" DROP CONSTRAINT "RouteStop_stationId_fkey";

-- DropTable
DROP TABLE "RouteStop";
