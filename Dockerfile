# Dockerfile pro Railway deployment z monorepo struktury
FROM python:3.12-slim

# Nastavit working directory
WORKDIR /app

# Kopírovat requirements a nainstalovat dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopírovat celý api projekt
COPY apps/api/ .

# Expose port (Railway používá $PORT env variable)
EXPOSE 8000

# Start command
CMD uvicorn src.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
