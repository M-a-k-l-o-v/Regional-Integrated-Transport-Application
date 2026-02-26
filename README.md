# Regional Integrated Transport Backend

TypeScript + Express + Prisma backend for ingesting and modelling regional transport datasets into PostgreSQL.

---

# Project Overview

This backend ingests:

- NPTG Localities (CSV)
- NaPTAN Access Nodes (Bus Stops)
- Network Rail Timetable (NDJSON ~3GB unzipped)

It stores them in a normalized relational schema designed for:

- Route modelling
- Timetable querying
- Reliability analysis
- Data lineage tracking

---

# What Is Currently Implemented

### Express API
- `GET /` – basic status
- `GET /health` – `{ ok: true }`

### Ingestion Pipelines
- `LocalitiesIngestionService` – NPTG CSV
- `AccessNodesIngestionService` – NaPTAN access nodes (stored as `BusStop`)
- `RailIngestionService` – streams large NDJSON timetable file
  - Coverage filtering (Lancashire + Manchester + Liverpool corridors)
  - Context stop retention (±2 stops around in-coverage stations)
  - TIPLOC → CRS caching

### Change Detection
- `DataSource.lastPayloadHash` prevents unnecessary re‑ingestion for CSV feeds.

### Cron
Defined in `src/cronJobs/index.ts`:
- Every minute: localities ingestion, need to change to something else, or maybe remove from cron as this is just locations that do not change
- Every minute: access nodes ingestion, need to change to something else, or maybe remove from cron as this is just locations that do not change
- Hourly: rail timetable ingestion, need to change to daily

---

# Architecture

```
src/
  infrastructure/
    apiClients/
    repositories/
    orm/prisma/
  ingestion/
    normalisers/
  services/
  cronJobs/
```

### Layers

- **apiClients** – external data fetch
- **normalisers** – raw → domain transformation
- **services** – ingestion orchestration
- **repositories** – persistence
- **cronJobs** – scheduling
- **prisma/schema.prisma** – database schema

---

# Data Model Summary

## Core Domain

- `Operator` → transport company
- `Route` → logical line/service
- `Station` → rail station (CRS = primary key)
- `BusStop` → bus stop (NaPTAN)
- `Locality` → NPTG locality grouping

## Rail Timetable

- `RailTiploc` → location dictionary (TIPLOC ↔ CRS/STANOX)
- `RailServiceSchedule` → one planned train service
- `RailServiceStop` → ordered stops for a schedule

## Bus Domain

- `BusRouteStop`
- `BusSchedule`

## Observability / Ingestion

- `DataSource`
- `JobRun`
- `APIHealth`
- `ExternalRouteSnapshot`

---

# Database Setup (Local Development)

## Option A – Docker (Recommended)

Start PostgreSQL:

```bash
docker run --name transport-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=transport \
  -p 5432:5432 \
  -d postgres:16
```

Stop:
```bash
docker stop transport-postgres
```

---

# Environment Variables

Create `.env` in project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transport?schema=public"
PORT=3000
NODE_ENV=development

# Rail timetable file (absolute path required)
RAIL_TIMETABLE_PATH="/absolute/path/to/rail_timetable_index.ndjson"

NAPTAN_API_BASE_URL="https://naptan.api.dft.gov.uk"
```

Notes:
- `DATABASE_URL` is mandatory.
- `RAIL_TIMETABLE_PATH` must be an absolute path.
- No longer uses `TRANSPORT_API_BASE`.

---

# Running the Project

## Install

```bash
npm install
```

## Run Migrations

```bash
npx prisma migrate dev
```

## Seed DataSources

```bash
npx ts-node src/scripts/seedDataSource.ts
```

## Ingest Rail Timetable

Full ingest:

```bash
npx ts-node src/scripts/ingestRailTimetable.ts
```

Partial ingest:

```bash
npx ts-node src/scripts/ingestRailTimetable.ts --maxLines=50000
```

Resume ingest:

```bash
npx ts-node src/scripts/ingestRailTimetable.ts --startLine=200000 --maxLines=600000
```

---

# Reset Database

⚠️ Deletes all data:

```bash
npx prisma migrate reset
```

---

# Coverage Filtering

Rail ingestion is restricted to:

- Lancashire stations
- Manchester corridor
- Liverpool corridor

Schedules are only stored if they touch an in‑coverage CRS.
Only ±2 stops around the coverage boundary are retained.

---

# Current State

- Rail timetable ingestion working (streaming large NDJSON)
- Station table built from CRS codes
- Rail stops mapped to stations
- Coverage filtering implemented

---

# In‑Progress

- Departure board endpoint
- Live feed integration (TRUST / TD)
- Reliability metrics pipeline
- Test coverage

---

# High-Level Flow

```
Operator → Route → Schedule → Stops
Stops reference Station (rail) or BusStop (bus)
All ingestion runs logged in JobRun
All data traceable to DataSource
```

---

End of README.
