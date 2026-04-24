-- Post-ingestion verification. Run after the 14-day window completes.
-- Intended to be piped through psql against the transport DB.

\echo '--- Overall counts ---'
SELECT
  (SELECT COUNT(*) FROM "BusRoute")              AS routes,
  (SELECT COUNT(*) FROM "BusSchedule")           AS schedules,
  (SELECT COUNT(*) FROM "BusJourney")            AS journeys,
  (SELECT COUNT(*) FROM "BusJourneyStop")        AS journey_stops,
  (SELECT COUNT(*) FROM "BusServiceCalendar")    AS calendars,
  (SELECT COUNT(*) FROM "BusServiceException")   AS exceptions,
  (SELECT COUNT(*) FROM "BusStop")               AS stops;

\echo '--- Calendar validFrom / validTo distribution ---'
SELECT
  COUNT(*)                                                           AS total,
  COUNT(*) FILTER (WHERE "validFrom" IS NULL)                        AS valid_from_null,
  COUNT(*) FILTER (WHERE "validTo"   IS NULL)                        AS valid_to_null,
  MIN("validFrom")                                                   AS earliest_from,
  MAX("validTo")                                                     AS latest_to
FROM "BusServiceCalendar";

\echo '--- BusSchedule coverage per service day ---'
SELECT
  DATE("departureTime" AT TIME ZONE 'UTC') AS service_day,
  COUNT(*)                                 AS schedule_rows,
  COUNT(DISTINCT "routeId")                AS distinct_routes,
  COUNT(DISTINCT "stopId")                 AS distinct_stops
FROM "BusSchedule"
WHERE "departureTime" >= '2026-04-24'
  AND "departureTime" <  '2026-05-08'
GROUP BY 1
ORDER BY 1;

\echo '--- Routes per operator ---'
SELECT
  COALESCE("operatorId", '(null)') AS operator,
  COUNT(*)                          AS routes
FROM "BusRoute"
GROUP BY 1
ORDER BY routes DESC;

\echo '--- Sample: first 10 departures from any Lancaster-named stop on 2026-04-24 ---'
SELECT
  bs."routeId",
  st.name                                        AS stop_name,
  bs."departureTime" AT TIME ZONE 'Europe/London' AS departure_local
FROM "BusSchedule" bs
JOIN "BusStop" st ON st."stopId" = bs."stopId"
WHERE bs."departureTime" >= '2026-04-24'
  AND bs."departureTime" <  '2026-04-25'
  AND LOWER(st.name) LIKE '%lancaster%'
ORDER BY bs."departureTime"
LIMIT 10;
