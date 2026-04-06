# Backend — Lancashire Transport API

Express.js REST API serving bus, rail, road, and weather data for the Lancashire transport network. Connects to PostgreSQL for stored timetable data and to external feeds for live information.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ with TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL 16 via Prisma ORM |
| Caching | Redis 7 (optional — the server works without it) |
| Validation | Zod |
| XML Parsing | fast-xml-parser (SOAP rail boards, SIRI-VM bus feeds) |
| Live Streaming | STOMP (Network Rail train movements) |
| Scheduling | node-cron |

---

## Getting Started

> If you are setting up the whole project for the first time, follow the root [README](../../README.md) instead — it walks through everything end-to-end.

### Quick setup (with database snapshot)

The fastest way to get a working backend is to restore the shared database snapshot. This gives you the full dataset without running the lengthy ingestion scripts.

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
# Open .env and set DATABASE_URL to your local PostgreSQL connection string, e.g.:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transport"

# 3. Make sure Git LFS has pulled the snapshot
cd ../..          # go to repo root
git lfs pull
cd code/Database

# 4. Create the database and restore
createdb transport
./db/db-restore.sh

# 5. Start the server
npm run dev       # Runs on http://localhost:3000
```

### Manual setup (without snapshot)

If you prefer to start with an empty database and ingest data yourself:

```bash
npm install
cp .env.example .env          # Fill in DATABASE_URL, etc.
npx prisma migrate dev         # Create tables
npx prisma generate            # Generate the Prisma client
npm run dev                    # Start the server on :3000
```

You will then need to trigger the ingestion scripts to populate bus and rail data. Refer to the seed and ingestion services in `Src/` for details.

---

## About the Database Snapshot

A compressed PostgreSQL dump is stored at `db/snapshots/transport_latest.dump` (~182 MB compressed, ~2.7 GB when restored). It contains all ingested bus timetables, rail schedules, station data, and reference tables.

The file is tracked with **Git LFS** so it does not bloat the repository. When you clone the repo, Git downloads a small pointer file. Running `git lfs pull` replaces it with the actual data.

The restore script (`db/db-restore.sh`) handles everything:
1. Verifies the file checksum
2. Drops existing tables for a clean slate
3. Runs `pg_restore` to load the data
4. Runs `prisma migrate deploy` to ensure the schema is current

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server with ts-node-dev (hot-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled production build |
| `npm test` | Run the Vitest test suite |
| `npm run test:coverage` | Run tests with a coverage report |
| `npm run prisma:studio` | Open Prisma Studio (visual database browser) |
| `npm run prisma:migrate` | Create and apply a new Prisma migration |

---

## API Endpoints

### Core

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/search?q=<query>` | Search stations and bus stops by name |

### Rail

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rail/departures/:crs` | Scheduled departures for a station |
| GET | `/rail/live/departures/:crs` | Live departure board via SOAP proxy |
| GET | `/rail/delay-stats/:stanox` | Delay statistics for a location |
| GET | `/rail/delay-log` | Recent movement log entries |
| GET | `/rail/stations/:crs/facilities` | Station accessibility, parking, toilets, amenities |

### Bus

| Method | Path | Description |
|--------|------|-------------|
| GET | `/bus/departures/:stopId` | Scheduled bus departures |
| GET | `/bus/groups/:groupId/departures` | Departures for a grouped bus station |
| GET | `/bus/routes/:routeId/calendar` | Route operating calendar and exceptions |
| GET | `/bus/live/:operatorRef` | Live SIRI-VM vehicle positions |

### Journey Planning

| Method | Path | Description |
|--------|------|-------------|
| POST | `/journeys/plan` | Multimodal journey planner |
| GET | `/journeys/legs/detail` | Detailed leg path, disruptions, and weather |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/weather/current?lat=&lon=` | Current weather for a set of coordinates |
| GET | `/road/vms?road=M6` | Variable Message Sign data for a road |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NAPTAN_API_BASE_URL` | Yes | NaPTAN API base (`https://naptan.api.dft.gov.uk`) |
| `RAIL_TIMETABLE_PATH` | Yes | Path to the NDJSON timetable index file |
| `REDIS_URL` | No | Redis connection string (enables caching) |
| `TRANSPORT_SERVER_BASE_URL` | No | University transport proxy URL |
| `NETWORK_RAIL_STOMP_ENABLED` | No | `true` to connect to the live rail STOMP feed |
| `NETWORK_RAIL_STOMP_HOST` | No | STOMP broker hostname |
| `NETWORK_RAIL_STOMP_PORT` | No | STOMP broker port |
| `NETWORK_RAIL_STOMP_USERNAME` | No | STOMP credentials |
| `NETWORK_RAIL_STOMP_PASSWORD` | No | STOMP credentials |
| `NATIONAL_HIGHWAYS_API_KEY` | No | National Highways API key for live VMS data |

---

## Caching Strategy

All cache TTLs are set to respect the university proxy's rate limits:

| Data | TTL | Why |
|------|-----|-----|
| Weather | 5 min | OpenWeatherMap rate limit via proxy |
| Rail live board | 30 sec | Near-real-time requirement |
| Search results | 5 min | Reference data changes infrequently |
| VMS signs | 5 min | National Highways update cadence |
| Station facilities | 1 hour | Static curated data |

---

## Project Layout

```
Src/
  app.ts                          Express app — route handlers defined here
  server.ts                       Server startup, STOMP connection, cron jobs
  config/env.ts                   Environment variable loading + validation
  infrastructure/
    apiClients/                   TransportServerClient, NationalHighwaysClient
    cache/RedisCache.ts           Redis get/set/del wrapper
    liveData/                     In-memory stores (LiveMovementStore, BusLiveDelayStore)
    orm/prisma/                   Prisma client singleton
  services/
    journeys/                     Journey planning, leg detail, operational status
    stations/                     Station facilities, coordinate backfill
    liveRail/                     STOMP stream processing
  __tests__/                      Unit and load tests
prisma/
  schema.prisma                   Database schema (20+ models)
db/
  snapshots/                      Database dump + checksum
  db-restore.sh                   Restore script for teammates
```
