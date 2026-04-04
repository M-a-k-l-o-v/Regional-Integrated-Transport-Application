# Regional Integrated Transport Database

TypeScript + Express + Prisma service for ingesting and modelling regional transport datasets in PostgreSQL.

Product scope authority:
- `design/Design Report - TransitPredict.pdf`
- `design/Transport Application Overview.pdf`

This README is an implementation-status document, not the product contract.

## Current Scope

Lancashire-focused integrated transport data layer with:
- Bus timetable ingestion as primary delivery focus
- Rail timetable ingestion in parallel
- Query APIs for stop/station search and departures

In scope datasets:
- NaPTAN access nodes (`BusStop`)
- NPTG localities (`Locality`)
- BODS/TransXChange bus timetable XML
- Network Rail timetable NDJSON

## Current Build Status (Catch-Up)

Implemented and working:
1. Runtime and infra
- Express app boot + health checks
- Prisma ORM client integration
- Ingestion cron wiring

2. Ingestion pipelines
- `LocalitiesIngestionService`
- `AccessNodesIngestionService`
- `RailIngestionService` (streaming NDJSON)
- `BusTimetableIngestionService` (streaming TXC XML)

3. Bus route and timetable handling
- `BusSchedule` stores flattened timed stop events per service date for departures-style queries
- `BusJourney` stores one row per raw TXC `VehicleJourney`
- `BusJourneyStop` stores the ordered stop list for each `BusJourney`
- `BusSchedule` now has a natural unique key on `routeId + stopId + arrivalTime + departureTime`
- Scope filtering supported in ingest:
  - `strict`
  - `corridor`
  - `strict+corridor` / `strict_corridor`
  - `all`

4. Date-aware bus service logic
- `BusServiceCalendar` stores:
  - validity window (`validFrom`, `validTo`)
  - weekday flags (`runsMon..runsSun`)
- `BusServiceException` stores date-range include/exclude overrides
- Current bus-model rule is:
  - `BusJourney` / `BusJourneyStop` are the authoritative raw-fidelity layer
  - `BusSchedule` is the flattened compatibility layer used by existing departure APIs
- Query rule for bus services is:
  - accept `date=YYYY-MM-DD`
  - derive weekday
  - apply validity + weekday + exception overrides

5. APIs currently available
- `GET /`
- `GET /health`
- `GET /search?q=`
- `GET /rail/departures/:crs`
- `GET /bus/departures/:stopId`
  - supports `limit`, `windowMinutes`, `from`, `date`
- `GET /bus/routes/:routeId/calendar`
  - inspect route calendar + exceptions for a date

6. Recovery slice now applied
- backend runtime path uses `Src/` consistently for the dev entrypoint
- dead legacy rail parser files have been removed from the active codebase
- scheduled-only endpoints now return a `dataState` object so clients can label data honestly until live feeds exist
- a broken historical migration was neutralised so fresh migration bootstrap can proceed

## Known Gaps / Next Priorities

- Apply the new bus-journey migration to the live DB
- Rebuild bus-derived tables from source XML so `BusJourney` / `BusJourneyStop` are fully populated
- Remove `BusRouteStop` from the active schema and use `BusJourneyStop` as the only authoritative stop-sequence layer
- STOMP live rail stream worker
- Redis cache-first layer
- Weather/road aggregation endpoints
- Facilities endpoint
- Automated tests (unit + integration)

Current delivery boundary:
- bus and rail departure APIs are still **scheduled-data APIs**
- live rail, live bus, freshness from upstream feeds, weather, road, and facilities are still deferred
- schema tables without matching services should be treated as parked, not delivered

## Table Inventory

This section explains what each table does, how it fits into the project, why it exists, and whether it should stay.

### Core transport domain

`Operator`
- Job: stores transport operators such as Stagecoach or Kirkby Lonsdale Coach Hire.
- Project fit: links routes and strikes back to the organisation running the service.
- Why needed: avoids repeating operator metadata on every route or timetable row.
- Status: keep.

`BusRoute`
- Job: stores the route-level identity used by the app.
- Project fit: central join point for bus timetables, calendars, disruptions, verification, and scoring.
- Why needed: the project needs a stable route identifier for APIs and joins.
- Status: keep.
- Important note: current `routeId` is still service-code based, so it is intentionally coarse rather than full-fidelity.

`Locality`
- Job: stores NPTG locality records.
- Project fit: gives bus stops a place hierarchy for search and filtering.
- Why needed: stop search and regional grouping are weaker without locality metadata.
- Status: keep.

`Station`
- Job: stores rail stations keyed by CRS.
- Project fit: used by rail departures, station search, and rail historical/status joins.
- Why needed: rail data should not be mixed into `BusStop`.
- Status: keep.

`BusStop`
- Job: stores NaPTAN bus stops keyed by ATCO code.
- Project fit: anchor table for bus departures, route-stop mapping, and journey-stop mapping.
- Why needed: every bus timetable row needs a stop FK.
- Status: keep.

### Bus timetable domain

`BusJourney`
- Job: stores one row per raw TXC `VehicleJourney`.
- Project fit: this is now the authoritative bus timetable layer when journey identity matters.
- Why needed: different vehicle journeys under the same service code can share times and early stops but diverge later.
- Status: keep.
- Replacement note: this table replaces `BusSchedule` as the source-of-truth layer for full timetable fidelity.

`BusJourneyStop`
- Job: stores the ordered stop chain for a `BusJourney`.
- Project fit: preserves the actual shape and timing sequence of each raw journey.
- Why needed: you cannot reconstruct exact journey variants from flattened stop-time rows alone.
- Status: keep.
- Replacement note: this table replaces `BusRouteStop` and `BusSchedule` as the authoritative stop sequence source when exact journey structure is required.

`BusSchedule`
- Job: stores flattened timed stop events per route and service date.
- Project fit: powers the existing stop departures API efficiently.
- Why needed: the frontend/backend currently need a simple departures-style table.
- Status: keep for now.
- Replacement note: this is no longer the authoritative raw timetable store; it is the compatibility projection derived from journey-level ingest.
- Limitation: by design it collapses journey identity, so it should not be used for full-fidelity timetable analysis.

`BusServiceCalendar`
- Job: stores route-level weekday flags and validity windows.
- Project fit: allows `date`-based filtering of bus departures.
- Why needed: the app must know whether a service is active on a requested day.
- Status: keep.
- Limitation: it is route-level, not journey-level, so it is a pragmatic summary rather than a perfect representation of all TXC operating-profile variants.

`BusServiceException`
- Job: stores route-level include/exclude date overrides extracted from TXC special-day sections.
- Project fit: works with `BusServiceCalendar` for holiday/exception filtering.
- Why needed: weekday flags alone are not enough for real timetable validity.
- Status: keep.
- Limitation: still a route-level summary.

### Rail timetable domain

`RailTiploc`
- Job: stores TIPLOC reference data.
- Project fit: lookup layer for rail timetable stop records.
- Why needed: NTROD timetable data is built around TIPLOCs.
- Status: keep.

`RailServiceSchedule`
- Job: stores one rail schedule keyed by train UID, STP indicator, and validity window.
- Project fit: main rail timetable entity.
- Why needed: enables stable upsert and schedule-level querying.
- Status: keep.

`RailServiceStop`
- Job: stores ordered stop records for a rail schedule.
- Project fit: authoritative rail stop/timing sequence.
- Why needed: equivalent to the bus journey-stop concept for rail.
- Status: keep.

Removed from active schema:
- `RouteStop`
- Reason: `RailServiceStop` already holds the real rail stop sequence with higher fidelity, so `RouteStop` was redundant clutter.
- `BusRouteStop`
- Reason: it was unused by the runtime and only stored the first valid journey pattern seen for a route, which made it misleading as a canonical stop chain.

### Live status / disruption / monitoring

`ServiceStatus`
- Job: stores route/station-level live service status such as delay/cancellation.
- Project fit: intended for later live API integration.
- Why needed: only if live status is part of the delivered product.
- Status: keep if live integration is still planned, otherwise review.

`Disruption`
- Job: stores route-level disruption records.
- Project fit: intended for incident/disruption APIs.
- Why needed: useful for explaining why services are affected.
- Status: keep if disruption integration is still planned, otherwise review.

`DataSource`
- Job: stores external source metadata.
- Project fit: ties ingestion jobs, health checks, verification, and snapshots back to a source system.
- Why needed: keeps ingestion/audit logic normalised.
- Status: keep.

`APIHealth`
- Job: stores source health-check results.
- Project fit: operational monitoring table.
- Why needed: useful for ingestion observability and source reliability.
- Status: keep, but optional if the team decides to reduce ops features.

`JobRun`
- Job: stores ingestion and processing run history.
- Project fit: core operational audit trail.
- Why needed: lets you see what was ingested, what failed, and how many rows were processed.
- Status: keep.

`ExternalRouteSnapshot`
- Job: stores normalised payload snapshots from external sources.
- Project fit: supports route verification and provenance tracking.
- Why needed: useful if multiple sources are being compared or audited.
- Status: keep if verification remains in scope, otherwise review.

### Verification / scoring / future intelligence

`RouteVerification`
- Job: stores verification confidence for route data against a primary source.
- Project fit: supports your wider integrated-transport verification story.
- Why needed: only if route verification is actually delivered.
- Status: review.

`ReliabilityScore`
- Job: stores per-route reliability scores.
- Project fit: part of the advanced scoring / ML side of the project.
- Why needed: only if reliability scoring is delivered beyond schema level.
- Status: review.
- Scope note: this is not core to your current Role 1 database delivery.

`HistoricalPerformance`
- Job: stores dated performance outcomes such as delays and cancellations.
- Project fit: intended input for analytics, reliability, and historical reporting.
- Why needed: only once live/historical performance feeds exist.
- Status: review.

`Strike`
- Job: stores operator strike periods.
- Project fit: optional disruption/planning layer.
- Why needed: only if operator-level industrial action is part of user-facing behaviour.
- Status: review.

## Current Table Decisions

Keep as core:
- `Operator`
- `BusRoute`
- `Locality`
- `Station`
- `BusStop`
- `BusJourney`
- `BusJourneyStop`
- `BusSchedule`
- `BusServiceCalendar`
- `BusServiceException`
- `RailTiploc`
- `RailServiceSchedule`
- `RailServiceStop`
- `DataSource`
- `JobRun`

Review / likely remove or replace:
- none currently; `RouteStop` and `BusRouteStop` have already been dropped from the active schema

Review depending on final feature scope:
- `ServiceStatus`
- `Disruption`
- `APIHealth`
- `ExternalRouteSnapshot`
- `RouteVerification`
- `ReliabilityScore`
- `HistoricalPerformance`
- `Strike`

## Bus Duplication / Rebuild Decision

Because the old bus ingest wrote flattened `BusSchedule` rows without a natural unique key, duplicate rows were able to accumulate historically.

Current position:
- `BusSchedule` now has a natural unique constraint.
- `BusJourney` and `BusJourneyStop` are now the correct full-fidelity bus tables.
- A bus-only clean rebuild is recommended so these new tables are populated from raw XML and the flattened compatibility layer is regenerated cleanly.

Rebuild recommended:
- `BusJourneyStop`
- `BusJourney`
- `BusSchedule`
- `BusServiceException`
- `BusServiceCalendar`

Rebuild not required for this specific issue:
- `BusRoute`
- `Operator`
- `BusStop`
- `Locality`
- all rail tables
- `JobRun`

## Project Structure

```text
Src/
  infrastructure/
  services/
  cronJobs/
  scripts/
prisma/
data/
```

## Local Setup

From `code/Database`:

```bash
npm install
npm run prisma:generate
npx prisma migrate dev
npm run dev
```

Open Prisma Studio:

```bash
npx prisma studio
```

## Environment

Create `.env` in `code/Database`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transport?schema=public"
PORT=3000
NODE_ENV=development
NAPTAN_API_BASE_URL="https://naptan.api.dft.gov.uk"
TRANSPORT_SERVER_BASE_URL="http://transport.scc.lancs.ac.uk"
RAIL_TIMETABLE_PATH="/absolute/path/to/rail_timetable_index.ndjson"
```

## Ingestion Commands

Seed data source rows:

```bash
npx ts-node Src/scripts/seedDataSource.ts
```

Rail timetable:

```bash
npx ts-node Src/scripts/ingestRailTimetable.ts
```

Bus timetables (recursive by folder):

```bash
npx ts-node Src/scripts/ingestBusTimetables.ts --dir="data/bus"
```

Bus timetables with explicit scope controls:

```bash
# strict
npx ts-node Src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=strict --edgeStops=2

# corridor
npx ts-node Src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=corridor --corridorAnchor=lancaster --edgeStops=5

# strict + corridor
npx ts-node Src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=strict+corridor --corridorAnchor=lancaster --edgeStops=5

# all
npx ts-node Src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=all
```

Re-ingest bus stops for ATCO prefixes currently present in `BusSchedule`:

```bash
npx ts-node Src/scripts/reingestBusStopsFromBusScheduleCoverage.ts
```

## API Quick Checks

```bash
curl "http://localhost:3000/search?q=preston&limit=20"
curl "http://localhost:3000/rail/departures/PRE"
curl "http://localhost:3000/bus/departures/<STOP_ID>?date=2026-03-05&windowMinutes=180&limit=10"
curl "http://localhost:3000/bus/routes/<ROUTE_ID>/calendar?date=2026-03-05"
```

## No-Server Collaboration Workflow (Snapshot Dumps)

### Why
Timetable ingestion is heavy. Instead of asking every collaborator to re-ingest all sources, use the baseline snapshot committed in this repo.

### Baseline snapshot tracked in repo

Tracked files:
- `db/snapshots/transport_latest.dump`
- `db/snapshots/transport_latest.dump.sha256`

### Restore the committed baseline (collaborator machine)

```bash
cd "Regional-Integrated-Transport-Application/code/Database"
shasum -a 256 -c db/snapshots/transport_latest.dump.sha256

dropdb --if-exists transport
createdb transport
/opt/homebrew/opt/libpq/bin/pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname=transport \
  db/snapshots/transport_latest.dump
```

### Verify sync after restore

Run in psql:

```sql
SELECT COUNT(*) FROM "BusSchedule";
SELECT COUNT(*) FROM "BusServiceCalendar";
SELECT COUNT(*) FROM "BusServiceException";
```

If these counts match the owner environment, collaborators are in sync.

### Refresh baseline snapshot (owner machine)

```bash
cd "Regional-Integrated-Transport-Application/code/Database"
source .env
PSQL_URL="${DATABASE_URL%%\?*}"
/opt/homebrew/opt/libpq/bin/pg_dump "$PSQL_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="db/snapshots/transport_latest.dump"
shasum -a 256 db/snapshots/transport_latest.dump > db/snapshots/transport_latest.dump.sha256
```

## Snapshot Storage Policy

- Keep exactly one tracked baseline dump in git: `transport_latest.dump`.
- For larger historical snapshots, prefer GitHub Releases artifacts.
- Do not commit multiple versioned dump files to normal git history.
- Keep `.env` and secrets out of version control.

## Troubleshooting

`psql: invalid URI query parameter: "schema"`
- Use `PSQL_URL="${DATABASE_URL%%\?*}"` before calling `psql`.

`psql` connection errors on `/tmp/.s.PGSQL.5432`
- Usually means `PSQL_URL` is empty or PostgreSQL is not running.
- Re-source `.env` from `code/Database` and ensure your DB container is up.

Prisma migrate `Schema engine error`
- Re-run from `code/Database`.
- Verify `DATABASE_URL` and local DB availability.
- Run `npx prisma validate` first.
