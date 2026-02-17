from contextvars import ContextVar
from typing import Any, Optional

trace_id_var: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)
request_data_var: ContextVar[dict[str, Any]] = ContextVar(
    "request_data",
    default={
        "queries": [],
        "total_db_time": 0.0,
        "query_count": 0,
        "http_calls": [],
        "total_http_time": 0.0,
    },
)

from src.app.perf.logger import PerfLogger
from src.app.perf.middleware import PerfMiddleware
from src.app.perf.sql import setup_sql_listeners
from src.app.perf.httpx import instrumented_async_client

__all__ = [
    "trace_id_var",
    "request_data_var",
    "PerfLogger",
    "PerfMiddleware",
    "setup_sql_listeners",
    "instrumented_async_client",
]
