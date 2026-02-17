import time
import uuid
from typing import Any, Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.app.core.config import settings
from src.app.perf.logger import get_perf_logger
from src.app.perf import request_data_var, trace_id_var
from src.app.perf.sql import get_sql_instrumentation


class PerfMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: Any):
        super().__init__(app)
        self.logger = get_perf_logger()
        self.enabled = settings.PERF_ENABLED
        self._request_count = 0
        self._last_log_reset = time.time()
        self._logs_this_second = 0

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Response]
    ) -> Response:
        if not self.enabled:
            return await call_next(request)

        trace_id = request.headers.get("x-trace-id")
        if not trace_id:
            trace_id = str(uuid.uuid4())[:8]

        trace_id_var.set(trace_id)

        data = {
            "queries": [],
            "total_db_time": 0.0,
            "query_count": 0,
            "http_calls": [],
            "total_http_time": 0.0,
        }
        token = request_data_var.set(data)

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
        finally:
            request_data_var.reset(token)

        total_time = time.perf_counter() - start_time
        total_ms = total_time * 1000

        db_time = data["total_db_time"]
        db_ms = db_time * 1000
        query_count = data["query_count"]

        http_time = data.get("total_http_time", 0.0)
        http_ms = http_time * 1000

        response_body = b""
        if hasattr(response, "body"):
            response_body = response.body
        response_bytes = len(response_body)

        org_id = self._extract_org_id(request)
        user_id = self._extract_user_id(request)

        sorted_queries = sorted(
            data["queries"], key=lambda x: x.get("duration_ms", 0), reverse=True
        )
        slow_queries = []
        for q in sorted_queries[:3]:
            if q.get("duration_ms", 0) >= settings.PERF_SLOW_THRESHOLD_MS:
                sql = q.get("statement", "").replace("\n", " ").strip()[:80]
                slow_queries.append(f"{sql} ({q['duration_ms']:.1f}ms)")

        extra_data: dict = {}
        if slow_queries:
            extra_data["slow_queries"] = " | ".join(slow_queries)
        if query_count > 20:
            extra_data["n1_warning"] = "possible N+1"

        # Rate limiting: only log slow requests or sample 1% of requests
        # This prevents flooding Railway logs
        should_log = False
        current_time = time.time()

        # Reset counter every second
        if current_time - self._last_log_reset >= 1.0:
            self._logs_this_second = 0
            self._last_log_reset = current_time

        # Only log if:
        # 1. Very slow request (>800ms) - always log
        # 2. Slow request (>200ms) - log if under rate limit
        # 3. Sample 1% of other requests for baseline
        is_very_slow = total_ms >= settings.PERF_VERY_SLOW_THRESHOLD_MS
        is_slow = total_ms >= settings.PERF_SLOW_THRESHOLD_MS

        if is_very_slow:
            should_log = True
        elif is_slow and self._logs_this_second < 50:
            should_log = True
            self._logs_this_second += 1
        elif self._request_count % 100 == 0 and self._logs_this_second < 50:
            # Sample 1% of requests
            should_log = True
            self._logs_this_second += 1

        self._request_count += 1

        # Save ALL metrics to database (not just sampled)
        try:
            import asyncio
            from src.app.models.api_metric import ApiMetric
            from src.app.db.session import AsyncSessionLocal
            import uuid

            async def save_metric():
                try:
                    async with AsyncSessionLocal() as db:
                        metric = ApiMetric(
                            id=uuid.uuid4(),
                            organization_id=org_id,
                            user_id=user_id,
                            method=request.method,
                            path=request.url.path[:500],
                            status_code=response.status_code,
                            duration_ms=int(total_ms),
                            db_ms=int(db_ms),
                            query_count=query_count,
                            ip_address=request.client.host if request.client else None,
                            user_agent=request.headers.get("user-agent", "")[:500]
                            if request.headers.get("user-agent")
                            else None,
                        )
                        db.add(metric)
                        await db.commit()
                except Exception:
                    pass  # Never crash request due to metrics

            asyncio.create_task(save_metric())
        except Exception:
            pass  # Never crash request due to metrics

        # Log to console (only sampled requests to avoid flooding)
        if should_log:
            self.logger.request_summary(
                trace_id=trace_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                total_ms=total_ms,
                sql_ms=db_ms,
                sql_count=query_count,
                http_ms=http_ms,
                response_bytes=response_bytes,
                org_id=org_id,
                user_id=user_id,
                **extra_data,
            )

        sql_instrumentation = get_sql_instrumentation()
        sql_instrumentation.handle_request_end(trace_id)

        response.headers["X-Trace-ID"] = trace_id
        return response

    def _extract_org_id(self, request: Request) -> Optional[str]:
        org_header = request.headers.get("x-organization-id")
        if org_header:
            return org_header
        return None

    def _extract_user_id(self, request: Request) -> Optional[str]:
        auth_header = request.headers.get("authorization", "")
        return None
