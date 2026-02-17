# Performance Debugging

This document describes the Perf Kit observability layer for systematically identifying performance issues in the SQLPet monorepo.

## Overview

The Perf Kit provides:
- Colored request logging with per-request breakdown
- SQL query tracking and N+1 detection
- HTTP call instrumentation
- Trace correlation across requests
- Frontend fetch wrapper and TanStack Query monitoring

## Quick Start

### Backend

Set environment variables to enable:

```bash
PERF_ENABLED=true
PERF_SLOW_THRESHOLD_MS=200
PERF_VERY_SLOW_THRESHOLD_MS=800
PERF_LOG_SQL=true
PERF_LOG_TOP_N=5
PERF_COLORED_LOGS=true
```

### Frontend

The frontend perf monitoring is automatically enabled in development mode (`NODE_ENV === 'development'`). No configuration needed.

## Sample Log Lines

### Backend

```
[PERF] trace_id=a1b2c3d4 | GET /animals | 200 | total_ms=45.2 | sql_ms=32.1 | queries=3 | bytes=1520
```

```
[SLOW] trace_id=a1b2c3d4 | GET /animals | 200 | total_ms=850.3 | sql_ms=780.2 | queries=17 | bytes=5234 | slow_queries=SELECT * FROM animals WHERE... (545.1ms)
```

```
[WARN] trace_id=a1b2c3d4 | N+1 detected: 15x SELECT * FROM animals WHERE id = ? | Hint: use selectinload()
```

### Frontend

```
[PERF] GET /api/animals - status=200 - duration=45.2ms - bytes=1520 - trace_id=a1b2c3d4
```

```
[PERF] Duplicate/Rapid Query: queryKey - key: ["org","abc","animals",...] - diff: 150ms
```

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PERF_ENABLED` | `false` | Enable/disable performance monitoring |
| `PERF_SLOW_THRESHOLD_MS` | `200` | Threshold for slow request warning |
| `PERF_VERY_SLOW_THRESHOLD_MS` | `800` | Threshold for very slow request error |
| `PERF_LOG_SQL` | `false` | Log full SQL statements (sanitized) |
| `PERF_LOG_TOP_N` | `5` | Number of slow queries to log per request |
| `PERF_COLORED_LOGS` | `true` | Enable colored console output |

## Interpretation Guide

### SQL Performance

- **sql_ms > total_ms**: Queries are the bottleneck
- **sql_count > 20**: Possible N+1 query pattern
- **Repeated identical queries (>10x)**: Missing eager loading - use `selectinload()` or `joinedload()`

### Request Performance

- **total_ms < 200**: Good performance
- **total_ms 200-800**: Slow - investigate
- **total_ms > 800**: Very slow - urgent investigation needed

### HTTP Calls

- **http_ms**: Time spent on external HTTP calls
- **Repeated calls to same URL**: Consider caching

## Backend Usage

### Middleware

The `PerfMiddleware` is automatically added when `PERF_ENABLED=true`. It logs:
- `trace_id`: Unique request identifier
- `method`, `path`, `status`: Request details
- `total_ms`: Total request duration
- `sql_ms`: Time spent in SQL queries
- `sql_count`: Number of SQL queries executed
- `http_ms`: Time spent in external HTTP calls
- `response_bytes`: Response size in bytes
- `org_id`, `user_id`: Context (when available)

### SQL Instrumentation

SQL queries are tracked via SQLAlchemy event listeners:
- Query count and duration per request
- Slow query detection (above threshold)
- N+1 pattern detection (repeated identical queries)
- Normalized SQL for pattern matching

### HTTPX Wrapper

For outgoing HTTP calls, use the instrumented client:

```python
from src.app.perf.httpx import instrumented_async_client

async with instrumented_async_client() as client:
    response = await client.get("https://api.example.com/data")
```

## Frontend Usage

### Fetch Wrapper

```typescript
import { perfFetch, createApiClient } from '@/lib/perf';

const response = await perfFetch('/api/animals');
const traceId = response.headers.get('x-trace-id');
```

### TanStack Query

The enhanced query client is in `src/lib/perf/queryClient.ts`:

```typescript
import { perfQueryClient } from '@/lib/perf/queryClient';
```

It provides:
- Duplicate query key detection
- Rapid refetch warnings (<300ms)
- High frequency query alerts (>10/minute)

### Trace ID Propagation

Trace IDs are automatically:
- Generated per request
- Passed to backend via `x-trace-id` header
- Returned in response headers
- Logged in console for correlation

## Files

### Backend

- `apps/api/src/app/perf/__init__.py` - Exports
- `apps/api/src/app/perf/config.py` - Settings wrapper
- `apps/api/src/app/perf/logger.py` - Colored logging
- `apps/api/src/app/perf/middleware.py` - Request middleware
- `apps/api/src/app/perf/sql.py` - SQLAlchemy instrumentation
- `apps/api/src/app/perf/httpx.py` - HTTPX wrapper

### Frontend

- `apps/web/src/lib/perf/index.ts` - Fetch wrapper
- `apps/web/src/lib/perf/queryClient.ts` - TanStack Query enhancements
