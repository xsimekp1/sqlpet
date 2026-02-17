import re
import time
from collections import defaultdict
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy import event

from src.app.core.config import settings
from src.app.perf.logger import get_perf_logger
from src.app.perf import request_data_var


def _normalize_sql(statement: str) -> str:
    s = re.sub(r"\s+", " ", statement)
    s = re.sub(r"'[^']*'", "?", s)
    s = re.sub(r"\d+", "?", s)
    s = s.strip()[:100]
    return s


class SQLInstrumentation:
    def __init__(self):
        self.logger = get_perf_logger()
        self.slow_threshold_ms = settings.PERF_SLOW_THRESHOLD_MS
        self.log_sql = settings.PERF_LOG_SQL
        self.top_n = settings.PERF_LOG_TOP_N
        self._query_counts: Dict[str, int] = defaultdict(int)
        self._slow_queries: List[Dict[str, Any]] = []
        self._enabled = settings.PERF_ENABLED

    def _sanitize_sql(self, statement: str) -> str:
        if not self.log_sql:
            return "[SQL logging disabled]"
        s = re.sub(r"'[^']*'", "<val>", statement)
        s = s.replace("\n", " ")
        return s[:200]

    def before_cursor_execute(
        self,
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())
        conn.info.setdefault("query_statement", []).append(statement)

    def after_cursor_execute(
        self,
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        duration = time.perf_counter() - conn.info["query_start_time"].pop()
        duration_ms = duration * 1000

        normalized = _normalize_sql(statement)
        self._query_counts[normalized] += 1

        data = request_data_var.get()
        data["queries"].append(
            {
                "statement": statement[:200],
                "normalized": normalized,
                "duration": duration,
                "duration_ms": duration_ms,
            }
        )
        data["total_db_time"] += duration
        data["query_count"] += 1

        if duration_ms >= self.slow_threshold_ms:
            self._slow_queries.append(
                {"statement": statement, "duration_ms": duration_ms}
            )

    def handle_request_end(self, trace_id: str) -> None:
        if not self._enabled:
            return

        repeated_queries = {
            sql: count for sql, count in self._query_counts.items() if count > 10
        }

        if repeated_queries:
            for sql, count in repeated_queries.items():
                self.logger.n1_warning(
                    sql,
                    count,
                    "use selectinload() or joinedload() for relationships",
                    trace_id=trace_id,
                )

        if self._slow_queries:
            top_slow = sorted(
                self._slow_queries, key=lambda x: x["duration_ms"], reverse=True
            )[: self.top_n]
            for sq in top_slow:
                self.logger.slow_query(
                    self._sanitize_sql(sq["statement"]),
                    sq["duration_ms"],
                    trace_id=trace_id,
                )

        self._query_counts.clear()
        self._slow_queries.clear()


_sql_instrumentation: Optional[SQLInstrumentation] = None


def get_sql_instrumentation() -> SQLInstrumentation:
    global _sql_instrumentation
    if _sql_instrumentation is None:
        _sql_instrumentation = SQLInstrumentation()
    return _sql_instrumentation


def setup_sql_listeners(engine: Any) -> None:
    if not settings.PERF_ENABLED:
        return

    instrumentation = get_sql_instrumentation()

    event.listen(
        engine,
        "before_cursor_execute",
        instrumentation.before_cursor_execute,
    )
    event.listen(
        engine,
        "after_cursor_execute",
        instrumentation.after_cursor_execute,
    )
