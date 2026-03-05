# Regional Integrated Transport Database

TypeScript + Express + Prisma service for ingesting and modelling regional transport datasets in PostgreSQL.

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
- `BusRouteStop` maintains ordered stop chains per route
- `BusSchedule` stores generated timed stop events per service date
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

## Known Gaps / Next Priorities

- STOMP live rail stream worker
- Redis cache-first layer
- Weather/road aggregation endpoints
- Facilities endpoint
- Automated tests (unit + integration)

## Project Structure

```text
src/
  infrastructure/
  ingestion/
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
npx ts-node src/scripts/seedDataSource.ts
```

Rail timetable:

```bash
npx ts-node src/scripts/ingestRailTimetable.ts
```

Bus timetables (recursive by folder):

```bash
npx ts-node src/scripts/ingestBusTimetables.ts --dir="data/bus"
```

Bus timetables with explicit scope controls:

```bash
# strict
npx ts-node src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=strict --edgeStops=2

# corridor
npx ts-node src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=corridor --corridorAnchor=lancaster --edgeStops=5

# strict + corridor
npx ts-node src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=strict+corridor --corridorAnchor=lancaster --edgeStops=5

# all
npx ts-node src/scripts/ingestBusTimetables.ts --dir="data/bus" --scopeMode=all
```

Re-ingest bus stops for ATCO prefixes currently present in `BusSchedule`:

```bash
npx ts-node src/scripts/reingestBusStopsFromBusScheduleCoverage.ts
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
Timetable ingestion is heavy. Instead of asking every collaborator to re-ingest all sources, share a periodic PostgreSQL snapshot.

### Create snapshot (owner machine)

Run from `code/Database`:

```bash
cd "/Users/yin/Documents/UNI/Year 2 /SCC200/Regional-Integrated-Transport-Application/code/Database"
source .env
PSQL_URL="${DATABASE_URL%%\?*}"
TS=$(date +%Y%m%d_%H%M)
mkdir -p db/snapshots
pg_dump "$PSQL_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="db/snapshots/transport_${TS}.dump"
```

### Restore snapshot (collaborator machine)

```bash
dropdb --if-exists transport
createdb transport
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname=transport \
  db/snapshots/transport_YYYYMMDD_HHMM.dump
```

### Verify sync after restore

```sql
SELECT COUNT(*) FROM "BusSchedule";
SELECT COUNT(*) FROM "BusServiceCalendar";
SELECT COUNT(*) FROM "BusServiceException";
```

If these counts match the owner environment, collaborators are in sync.

## Snapshot Storage Policy

- Do not commit `*.dump` files to normal git history.
- Preferred sharing method: upload snapshot artifacts to GitHub Releases.
- Alternative (if needed): Git LFS for dumps.
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
