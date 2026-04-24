#!/usr/bin/env bash
# Ingests the new bus schedule across the remaining 13 days of the demo window
# (2026-04-25 through 2026-05-07). Invoked after the 2026-04-24 probe has
# already succeeded.

set -u

cd "$(dirname "$0")/.."

DATES=(
  2026-04-25
  2026-04-26
  2026-04-27
  2026-04-28
  2026-04-29
  2026-04-30
  2026-05-01
  2026-05-02
  2026-05-03
  2026-05-04
  2026-05-05
  2026-05-06
  2026-05-07
)

DIRS=(
  "data/bus/new schedule/ARCT"
  "data/bus/new schedule/BLAC"
  "data/bus/new schedule/NUTT"
  "data/bus/new schedule/KLCO"
  "data/bus/new schedule/SCMY"
  "data/bus/new schedule/ SCCU "
)

mkdir -p logs

for d in "${DATES[@]}"; do
  log="logs/ingest_${d}.log"
  echo "=== $d start $(date +'%H:%M:%S') ===" | tee -a "$log"

  dir_args=()
  for dir in "${DIRS[@]}"; do
    dir_args+=(--dir="$dir")
  done

  npx ts-node Src/scripts/ingestBusTimetables.ts \
    "${dir_args[@]}" \
    --serviceDate="$d" \
    --scopeMode=all \
    --continueOnError=true \
    >> "$log" 2>&1

  rc=$?
  echo "=== $d end $(date +'%H:%M:%S') exit=$rc ===" | tee -a "$log"

  if [ $rc -ne 0 ]; then
    echo "[14day] non-zero exit on $d; stopping" >&2
    exit $rc
  fi
done

echo "[14day] all dates complete"
