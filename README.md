# Lancashire Regional Integrated Transport Application

A real-time multimodal transport information system covering bus, rail, and road networks across Lancashire. Built as part of SCC200 at Lancaster University.

## Architecture

The project is split into two applications that run side by side:

```
code/
  Database/     Backend  — Express + Prisma REST API  (TypeScript)
  frontend/     Frontend — Next.js 16 web app         (React 19, Tailwind CSS)
design/         Design documents and diagrams
```

The **backend** is an Express.js REST API backed by PostgreSQL (via Prisma ORM) with optional Redis caching. It connects to the university transport proxy (`transport.scc.lancs.ac.uk`) for live rail departures, bus SIRI-VM vehicle feeds, and weather data. It can also ingest Network Rail STOMP live train movements in real time.

The **frontend** is a Next.js App Router application. Server components handle data fetching so pages load fast, while client components power interactive features like Leaflet maps, scroll pickers, and bottom sheets.

---

## Getting Started

Follow these steps in order to get a fully working version of the application on your machine.

### 1. Prerequisites

Make sure you have the following installed before continuing:

| Tool           | Version         | How to install (macOS)                                            |
| -------------- | --------------- | ----------------------------------------------------------------- |
| **Node.js**    | 20 or newer     | `brew install node`                                               |
| **PostgreSQL** | 16 or newer     | `brew install postgresql@16 && brew services start postgresql@16` |
| **Git LFS**    | any             | `brew install git-lfs && git lfs install`                         |
| **Redis**      | 7+ _(optional)_ | `brew install redis && brew services start redis`                 |

> Redis is optional. The backend works without it — caching will simply be skipped.

### 2. Clone the repository

```bash
git clone <repo-url>
cd Regional-Integrated-Transport-Application
git lfs pull        # Downloads the database snapshot (~182 MB)
```

Git LFS stores the database snapshot outside the normal repository. If you skip `git lfs pull`, the snapshot file will be a tiny placeholder instead of the actual data, and the restore step will fail.

### 3. Install dependencies

```bash
cd code/Database && npm install
cd ../frontend && npm install
```

### 4. Configure environment variables

**Backend** — create `code/Database/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transport"
REDIS_URL=redis://localhost:6379
NAPTAN_API_BASE_URL=https://naptan.api.dft.gov.uk
RAIL_TIMETABLE_PATH=./data/rail_timetable_index.ndjson
TRANSPORT_SERVER_BASE_URL=http://transport.scc.lancs.ac.uk

# Live rail feed (optional — set to true and add your credentials)
NETWORK_RAIL_STOMP_ENABLED=false
NETWORK_RAIL_STOMP_HOST=transport.scc.lancs.ac.uk
NETWORK_RAIL_STOMP_PORT=61618
NETWORK_RAIL_STOMP_USERNAME=
NETWORK_RAIL_STOMP_PASSWORD=
NETWORK_RAIL_STOMP_TOPICS=TRAIN_MVT_ALL_TOC

# Road signs (optional)
NATIONAL_HIGHWAYS_API_KEY=
```

**Frontend** — create `code/frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### 5. Restore the database

A compressed snapshot of the full database is included in the repository so you do not need to run the time-consuming data ingestion process. To restore it:

```bash
cd code/Database
createdb transport          # Create an empty database (skip if it already exists)
cd db/snapshots
psql -c "ALTER USER postgres WITH LOGIN SUPERUSER;" transport
../db-restore.sh          # Restores the snapshot and runs migrations
```

The script will:

- Verify the file integrity with a SHA-256 checksum
- Drop any existing tables (clean slate)
- Restore all bus, rail, and reference data from the snapshot
- Run `prisma migrate deploy` to ensure the schema is up to date

This takes roughly 2-5 minutes depending on your machine.

### 6. Start both servers

Open two terminal windows:

```bash
# Terminal 1 — Backend (port 3001)
cd code/Database
npx prisma generate
npm run dev

# Terminal 2 — Frontend (port 3000)
cd code/frontend
npm run dev
```

Then open [http://localhost:3001](http://localhost:3001) in your browser.

### 7. Enable live data (optional)

The application works fully with scheduled/static data out of the box. To overlay real-time information:

- **Live rail movements** — Set `NETWORK_RAIL_STOMP_ENABLED=true` in your `.env` and fill in the STOMP username and password provided by the SCC transport server team. The backend will connect on startup and begin receiving live train movements.

- **Live bus positions** — These are fetched automatically from the SIRI-VM feed via the transport proxy. No extra configuration needed.

- **Road VMS signs** — Add a `NATIONAL_HIGHWAYS_API_KEY` from [datahub.nationalhighways.co.uk](https://datahub.nationalhighways.co.uk) to get live sign data. Without it, the app falls back to representative static data for the M6 corridor.

---

## Container Deployment (Podman / Docker)

> [!WARNING]
> This section hasn't been tested recently. We recommend trying to build manually.

As an alternative to the manual setup above, you can run everything in containers:

```bash
# From the repository root
podman-compose up -d        # or: docker compose up -d
```

This starts PostgreSQL, Redis, the backend, and the frontend in one command. See `docker-compose.yml` for the full configuration.

---

## Load Testing

```bash
# Install k6 if you haven't already
brew install k6

cd code/Database
k6 run Src/__tests__/load/k6-load-test.js
```

This simulates 50 concurrent users hitting the API and checks that p95 response times stay under 4 seconds.

---

## Automated Tests

Both sub-projects use Vitest. From each folder:

```bash
npm test               # Single run
npm run test:watch     # Watch mode
npm run test:coverage  # With v8 coverage report
```

- **Backend** (`code/Database`) — 106 tests across 11 files: pure helpers, and service-layer logic (journey mapping, reliability, route verification, facilities, API health).
- **Frontend** (`code/frontend`) — 55 tests across 4 files: pure API-client helpers, recent-boards persistence, React component rendering, and an axe-core accessibility audit over composed page sections.

---

## Project Structure

| Directory                                        | What it contains                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `code/Database/Src/app.ts`                       | Express app — all route handlers defined here                                    |
| `code/Database/Src/server.ts`                    | Server startup, STOMP connection, cron jobs                                      |
| `code/Database/Src/infrastructure/apiClients/`   | Clients for the transport proxy and National Highways                            |
| `code/Database/Src/infrastructure/cache/`        | Redis caching layer                                                              |
| `code/Database/Src/infrastructure/liveData/`     | In-memory stores for STOMP movements and bus delays                              |
| `code/Database/Src/infrastructure/repositories/` | Prisma-backed data access (reliability, verification)                            |
| `code/Database/Src/services/journeys/`           | Journey planning algorithm, leg detail, operational status                       |
| `code/Database/Src/services/stations/`           | Station facilities and coordinate data                                           |
| `code/Database/Src/services/liveRail/`           | Network Rail live stream processing                                              |
| `code/Database/Src/services/`                    | Domain services run by cron (ingestion, health, reliability, route verification) |
| `code/Database/Src/__tests__/`                   | Vitest unit and service-level tests                                              |
| `code/Database/prisma/schema.prisma`             | Database schema                                                                  |
| `code/frontend/app/`                             | Next.js pages and route handlers                                                 |
| `code/frontend/app/components/`                  | Shared UI components (AppShell, PanelCard, etc.)                                 |
| `code/frontend/app/lib/transportApi.ts`          | API client, TypeScript types, and formatting helpers                             |
| `code/frontend/app/__tests__/`                   | Vitest + React Testing Library tests (incl. axe-core a11y audit)                 |

---

## Requirements Coverage

### Functional Requirements

| Req   | Description                               | Status |
| ----- | ----------------------------------------- | ------ |
| FR-01 | Regional coverage (Lancashire bus + rail) | Met    |
| FR-02 | Live rail departures                      | Met    |
| FR-03 | Data freshness indicators                 | Met    |
| FR-04 | Station and stop search                   | Met    |
| FR-05 | Interactive network map                   | Met    |
| FR-06 | Delay data collection                     | Met    |
| FR-07 | Regional weather integration              | Met    |
| FR-08 | Offline fallback (scheduled data)         | Met    |
| FR-09 | Road information / VMS                    | Met    |
| FR-10 | Rail station facilities                   | Met    |

### Non-Functional Requirements

| Req    | Description                     | How it is met                                                                                                                 |
| ------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Page load under 4 seconds       | Server-side rendering, dynamic Leaflet imports, Redis caching                                                                 |
| NFR-02 | Mobile-first (360 px+)          | Responsive Tailwind breakpoints, mobile bottom nav, touch targets                                                             |
| NFR-03 | Polling within rate limits      | Bus 15 s/operator, rail 30 s cache, weather 5 min cache                                                                       |
| NFR-04 | WCAG 2.2 AA accessibility       | Skip-nav, ARIA landmarks, focus-visible outlines, prefers-reduced-motion, automated axe-core audit in the frontend test suite |
| NFR-05 | Support 50 concurrent users     | k6 load test, stateless API, connection pooling                                                                               |
| NFR-06 | Containerised deployment        | Dockerfiles + docker-compose.yml                                                                                              |
| NFR-07 | Documentation and AI disclosure | This README, sub-project READMEs, inline comments                                                                             |

---

## AI Tooling Disclosure

Portions of this codebase were developed with the assistance of AI coding tools, in line with the module's policy on acceptable use of generative AI. Specifically:

- **Claude Code** (Anthropic) was used as a pair-programming assistant for iterative UI development, API integration scaffolding, and code review. The development process involved the team describing requirements and design intent, with the AI tool generating candidate implementations that were then reviewed, tested, and adapted.

- **Areas where AI tooling contributed**: frontend component scaffolding, Leaflet map integration patterns, CSS styling iterations, API client boilerplate, static facility/VMS data curation, accessibility improvements, and Dockerfile templates.

- **Areas developed without AI assistance**: database schema design, journey planning algorithm logic, STOMP live data integration, project architecture decisions, and requirements analysis.

All AI-generated code was reviewed and validated by the development team before integration. The team maintains full understanding of and responsibility for all code in the repository.

---

## Licence

University coursework — not for redistribution.
