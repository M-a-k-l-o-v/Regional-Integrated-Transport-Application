# Regional Integrated Transport Backend

TypeScript + Express + Prisma backend for ingesting transport datasets into PostgreSQL.

## What is implemented

- Express server with health endpoints:
  - `GET /` returns a basic status message
  - `GET /health` returns `{ ok: true }`
- Prisma schema for a normalized transport domain (routes, stations, schedules, disruptions, reliability, ingestion tracking).
- Ingestion pipelines:
  - `LocalitiesIngestionService` for NPTG localities CSV.
  - `AccessNodesIngestionService` for NaPTAN access nodes CSV (stored as `BusStop`).
  - `RailIngestionService` scaffold for rail timetable ingestion.
- Cron orchestration in `src/cronJobs/index.ts`.
- Change detection using payload hashing (`DataSource.lastPayloadHash`) to skip unchanged datasets.

## Current architecture

- `src/infrastructure/apiClients/*`: external API adapters (`axios`).
- `src/ingestion/normalisers/*`: CSV-to-domain normalization logic.
- `src/services/*`: ingestion workflows (fetch, hash-check, normalize, persist, job-run logging).
- `src/infrastructure/repositories/*`: persistence/upsert layer.
- `src/cronJobs/*`: scheduled job wiring.
- `prisma/schema.prisma`: domain + ingestion metadata schema.

## Data model highlights

- Rail and bus domains are separated:
  - Rail: `Station`, `RouteStop`, `RailServiceSchedule`, `RailServiceStop`
  - Bus: `BusStop`, `BusRouteStop`, `BusSchedule`
- Ingestion observability:
  - `DataSource` tracks source metadata + `lastPayloadHash`
  - `JobRun` tracks each ingestion run status and processed counts

### DB understanding

Core domain:
- `Operator`: A transport company (rail or bus). Routes belong to operators, and strikes are linked to operators.
- `Route`: A logical service line (rail or bus). This is the backbone entity that schedules, stops, disruptions, and reliability attach to.
- `Locality`: A geographic area (NPTG locality), mainly used to group bus stops.
- `Station`: A rail station (rail domain). Used by rail route structure, rail timetable stops, live status, and historical performance.
- `BusStop`: A bus stop (NaPTAN access node), acting as the bus-domain equivalent of a rail station.

Route structure:
- `RouteStop`: Ordered mapping of rail route to station. Defines static rail route structure.
- `BusRouteStop`: Ordered mapping of bus route to bus stop. Defines static bus route structure.

Rail timetable domain:
- `RailTiploc`: Rail location dictionary entry. Maps TIPLOC-based timetable locations to identifiers like CRS/STANOX/NALCO.
- `RailServiceSchedule`: One planned train service across a validity date range, with operating metadata.
- `RailServiceStop`: One ordered stop/pass point within a rail service schedule, including timing/location detail.

Bus schedule domain:
- `BusSchedule`: A bus stop timing record on a bus route (`route -> stop -> arrival/departure`).

Live and operational state:
- `ServiceStatus`: Current live state for route performance (delays/cancellations).
- `Disruption`: A known disruption affecting a route over a time period.

Ingestion and source control:
- `DataSource`: External system being ingested from; tracks source metadata and payload hash.
- `APIHealth`: Health snapshots for each data source (status and response time).
- `JobRun`: A single ingestion execution with status, timing, and record counts.
- `ExternalRouteSnapshot`: Versioned external payload per route/source for deduplication and change tracking.

Verification and reliability:
- `RouteVerification`: Confidence rating for a route and which source is treated as primary.
- `ReliabilityScore`: Aggregated reliability metric for a route.
- `HistoricalPerformance`: Past service performance records used for reliability analysis.

Industrial action:
- `Strike`: Industrial action tied to an operator and date range.

Big picture summary:
- `Operator -> Route -> Schedule -> Stops`
- Stops reference `Station` (rail) or `BusStop` (bus)
- Live feeds update `ServiceStatus`
- Historical feeds populate `HistoricalPerformance`
- Reliability workflows write `ReliabilityScore`
- All data lineage is traceable to `DataSource`
- Ingestion runs are logged in `JobRun`

## Cron jobs

From `src/cronJobs/index.ts`:

- Every minute: localities ingestion
- Every minute: access nodes ingestion (currently ATCO area `250`)
- Hourly (`0 * * * *`): rail timetable ingestion

## Environment variables

Create a `.env` file with at least:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PORT=3000
NAPTAN_API_BASE_URL=https://your-naptan-source
TRANSPORT_API_BASE=https://your-rail-source
TRANSPORT_SERVER_BASE_URL=https://your-transport-server
```

Notes:
- `DATABASE_URL` is required at startup.
- `NAPTAN_API_BASE_URL` is required by cron bootstrap.
- `TRANSPORT_SERVER_BASE_URL` is referenced by some datasource seed/metadata paths.

## Run locally

1. Install dependencies:
```bash
npm install
```

2. Generate Prisma client:
```bash
npm run prisma:generate
```

3. Run migrations:
```bash
npm run prisma:migrate
```

4. Start in development mode:
```bash
npm run dev
```

5. Build and run production build:
```bash
npm run build
npm start
```

## Useful files

- `src/server.ts`: app startup + DB connect + cron bootstrap
- `src/cronJobs/index.ts`: schedule definitions
- `src/services/LocalitiesIngestionService.ts`
- `src/services/AccessNodesIngestionService.ts`
- `src/services/RailIngestionService.ts`
- `prisma/schema.prisma`

## Known in-progress areas

- `RailIngestionService.parseTimetable()` is currently a placeholder parser.
- No automated tests are present yet.
- Some environment variable naming is mixed between `NAPTAN_API_BASE_URL` and `TRANSPORT_SERVER_BASE_URL`.
