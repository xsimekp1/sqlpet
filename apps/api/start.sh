#!/bin/bash
set -e
echo "Running migrations..."
alembic upgrade head || echo "Migration failed, continuing anyway..."
echo "Starting application..."
exec uvicorn src.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
