import time
from typing import Any, Optional

import httpx

from src.app.core.config import settings
from src.app.perf.logger import get_perf_logger
from src.app.perf import request_data_var, trace_id_var


class InstrumentedAsyncClient:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self.logger = get_perf_logger()
        self.enabled = settings.PERF_ENABLED

    async def request(
        self,
        method: str,
        url: str,
        **kwargs: Any,
    ) -> httpx.Response:
        if not self.enabled:
            return await self._client.request(method, url, **kwargs)

        trace_id = trace_id_var.get()
        if trace_id:
            headers = kwargs.get("headers", {})
            if headers is None:
                headers = {}
            elif not isinstance(headers, dict):
                headers = dict(headers)
            headers["x-trace-id"] = trace_id
            kwargs["headers"] = headers

        start_time = time.perf_counter()
        try:
            response = await self._client.request(method, url, **kwargs)
            duration = time.perf_counter() - start_time
            duration_ms = duration * 1000

            data = request_data_var.get()
            data["http_calls"].append(
                {
                    "method": method,
                    "url": url,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                }
            )
            data["total_http_time"] += duration

            if duration_ms >= settings.PERF_SLOW_THRESHOLD_MS:
                self.logger.warning(
                    f"HTTP {method} {url}",
                    status=response.status_code,
                    duration_ms=f"{duration_ms:.1f}",
                    trace_id=trace_id or "none",
                )

            return response
        except Exception as e:
            duration = time.perf_counter() - start_time
            self.logger.error(
                f"HTTP {method} {url} failed",
                error=str(e),
                duration_ms=f"{(duration * 1000):.1f}",
                trace_id=trace_id or "none",
            )
            raise

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("PUT", url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("PATCH", url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("DELETE", url, **kwargs)

    async def close(self) -> None:
        await self._client.close()

    async def __aenter__(self) -> "InstrumentedAsyncClient":
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self._client.__aexit__(*args)


def instrumented_async_client(**kwargs: Any) -> InstrumentedAsyncClient:
    base_client = httpx.AsyncClient(**kwargs)
    return InstrumentedAsyncClient(base_client)
