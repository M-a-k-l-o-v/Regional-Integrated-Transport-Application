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
  - Rail: `Station`, `RouteStop`, `RailSchedule`
  - Bus: `BusStop`, `BusRouteStop`, `BusSchedule`
- Ingestion observability:
  - `DataSource` tracks source metadata + `lastPayloadHash`
  - `JobRun` tracks each ingestion run status and processed counts

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


- STILL WORKING ON THIS HEAVILY BUT HOPEFULLY I SHOULD BE DONE TMRW. 🤞GN
