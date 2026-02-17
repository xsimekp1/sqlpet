import os
import sys
from typing import Any, Optional

try:
    from colorama import Fore, Style, init

    init(autoreset=True)
    COLORAMA_AVAILABLE = True
except ImportError:
    COLORAMA_AVAILABLE = False


class PerfLogger:
    def __init__(self, colored: bool = True):
        self.colored = colored and COLORAMA_AVAILABLE

    def _colorize(self, text: str, color: str) -> str:
        if not self.colored:
            return text
        return f"{color}{text}{Style.RESET_ALL}"

    def info(self, message: str, **kwargs: Any) -> None:
        parts = [f"[PERF] {message}"]
        for k, v in kwargs.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts))

    def success(self, message: str, **kwargs: Any) -> None:
        parts = [self._colorize("[PERF]", Fore.GREEN)]
        parts.append(message)
        for k, v in kwargs.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts))

    def warning(self, message: str, **kwargs: Any) -> None:
        parts = [self._colorize("[WARN]", Fore.YELLOW)]
        parts.append(message)
        for k, v in kwargs.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts), file=sys.stderr)

    def error(self, message: str, **kwargs: Any) -> None:
        parts = [self._colorize("[ERROR]", Fore.RED)]
        parts.append(message)
        for k, v in kwargs.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts), file=sys.stderr)

    def n1_warning(
        self, normalized_sql: str, count: int, hint: str, **kwargs: Any
    ) -> None:
        parts = [
            self._colorize("[WARN]", Fore.YELLOW),
            f"N+1 detected: {count}x {normalized_sql[:80]}",
            f"Hint: {hint}",
        ]
        for k, v in kwargs.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts), file=sys.stderr)

    def slow_query(self, sql: str, duration_ms: float, **kwargs: Any) -> None:
        sql_truncated = sql.replace("\n", " ").strip()[:120]
        parts = [
            self._colorize("[SLOW SQL]", Fore.YELLOW),
            f"{sql_truncated} ({duration_ms:.1f}ms)",
        ]
        for k, v in kwargs.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts), file=sys.stderr)

    def request_summary(
        self,
        trace_id: str,
        method: str,
        path: str,
        status: int,
        total_ms: float,
        sql_ms: float,
        sql_count: int,
        http_ms: float = 0,
        response_bytes: int = 0,
        org_id: Optional[str] = None,
        user_id: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        slow_threshold = 200
        very_slow_threshold = 800

        if total_ms >= very_slow_threshold:
            prefix = self._colorize("[VERY SLOW]", Fore.RED)
        elif total_ms >= slow_threshold:
            prefix = self._colorize("[SLOW]", Fore.YELLOW)
        else:
            prefix = self._colorize("[PERF]", Fore.GREEN)

        parts = [
            prefix,
            f"trace_id={trace_id}",
            f"method={method}",
            f"path={path}",
            f"status={status}",
            f"total_ms={total_ms:.1f}",
            f"sql_ms={sql_ms:.1f}",
            f"queries={sql_count}",
        ]

        if http_ms > 0:
            parts.append(f"http_ms={http_ms:.1f}")
        if response_bytes > 0:
            parts.append(f"bytes={response_bytes}")
        if org_id:
            parts.append(f"org_id={org_id[:8]}...")
        if user_id:
            parts.append(f"user_id={user_id[:8]}...")

        for k, v in kwargs.items():
            if v:
                parts.append(f"{k}={v}")

        output = " | ".join(parts)
        if total_ms >= slow_threshold:
            print(output, file=sys.stderr)
        else:
            print(output)


_perf_logger: Optional[PerfLogger] = None


def get_perf_logger() -> PerfLogger:
    global _perf_logger
    if _perf_logger is None:
        from src.app.core.config import settings

        _perf_logger = PerfLogger(colored=settings.PERF_COLORED_LOGS)
    return _perf_logger
