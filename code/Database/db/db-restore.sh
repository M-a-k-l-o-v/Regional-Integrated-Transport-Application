#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# db-restore.sh — Restore the shared database snapshot on a teammate's machine
# ──────────────────────────────────────────────────────────────────────────────
#
# Usage:
#   ./db/db-restore.sh                         # uses DATABASE_URL from .env
#   ./db/db-restore.sh postgresql://user:pass@localhost:5432/transport
#
# Prerequisites:
#   - PostgreSQL 16+ running locally
#   - git lfs pull  (to download the .dump file)
#   - The target database must already exist (createdb transport)
#
# What this does:
#   1. Verifies the dump file exists and checksums match
#   2. Drops existing tables (clean slate)
#   3. Restores the snapshot with pg_restore
#   4. Runs prisma migrate to ensure schema is up to date
# ──────────────────────────────────────────────────────────────────────────────

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DUMP_FILE="$SCRIPT_DIR/snapshots/transport_latest.dump"
CHECKSUM_FILE="$SCRIPT_DIR/snapshots/transport_latest.dump.sha256"
DB_DIR="$(dirname "$SCRIPT_DIR")"

# ── Resolve DATABASE_URL ─────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  DATABASE_URL="$1"
elif [ -f "$DB_DIR/.env" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$DB_DIR/.env" | head -1 | cut -d'"' -f2)
  if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' "$DB_DIR/.env" | head -1 | cut -d'=' -f2-)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: No DATABASE_URL found. Pass it as an argument or set it in code/Database/.env"
  exit 1
fi

echo "Database: $DATABASE_URL"
echo ""

# ── Check dump file exists ───────────────────────────────────────────────────
if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: Dump file not found at $DUMP_FILE"
  echo ""
  echo "If you just cloned the repo, run:  git lfs pull"
  echo "This downloads the database snapshot (~182 MB)."
  exit 1
fi

# Check if it's an LFS pointer (not yet downloaded)
if head -1 "$DUMP_FILE" | grep -q "version https://git-lfs.github.com"; then
  echo "Error: Dump file is an LFS pointer, not the actual data."
  echo ""
  echo "Run:  git lfs pull"
  echo "Then retry this script."
  exit 1
fi

# ── Verify checksum ──────────────────────────────────────────────────────────
if [ -f "$CHECKSUM_FILE" ]; then
  echo "Verifying checksum..."
  if command -v shasum &>/dev/null; then
    shasum -a 256 -c "$CHECKSUM_FILE"
  elif command -v sha256sum &>/dev/null; then
    sha256sum -c "$CHECKSUM_FILE"
  else
    echo "Warning: No sha256 tool found, skipping checksum verification"
  fi
  echo ""
fi

# ── Confirm ──────────────────────────────────────────────────────────────────
echo "This will DROP all existing tables and restore from the snapshot."
read -rp "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# ── Restore ──────────────────────────────────────────────────────────────────
echo "Restoring database (this may take a few minutes)..."
pg_restore \
  -U=postgres \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE"

echo ""
echo "Restore complete."

# ── Run Prisma migrate ───────────────────────────────────────────────────────
echo ""
echo "Running prisma migrate to sync schema..."
cd "$DB_DIR" || exit 1
npx prisma migrate deploy

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! Your database is ready."
echo ""
echo "  Next steps:"
echo "    1. Copy .env.example to .env and fill in your credentials"
echo "    2. Set NETWORK_RAIL_STOMP_ENABLED=true for live rail data"
echo "    3. Run: npm run dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
