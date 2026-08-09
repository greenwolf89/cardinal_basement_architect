#!/bin/sh
set -e

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/basement.db" ]; then
  echo "No existing database found at $DATA_DIR — seeding initial data..."
  python -m app.seed
  python -m app.seed_current
  python -m app.seed_redesign
  python -m app.seed_prices
else
  echo "Existing database found at $DATA_DIR — skipping seed, preserving all edits."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
