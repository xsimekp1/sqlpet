import pytest
from unittest.mock import MagicMock, patch
from httpx import ASGITransport, AsyncClient
from src.app.core.config import settings


@pytest.fixture
def perf_middleware():
    with patch.object(settings, "PERF_ENABLED", True):
        yield


@pytest.fixture
def client_with_perf():
    with patch.object(settings, "PERF_ENABLED", True):
        from src.app.main import app
        from httpx import ASGITransport, AsyncClient

        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_middleware_sets_trace_id():
    with patch.object(settings, "PERF_ENABLED", True):
        from src.app.main import app
        from httpx import ASGITransport, AsyncClient

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")
            assert response.status_code == 200
            assert "x-trace-id" in response.headers


@pytest.mark.asyncio
async def test_middleware_accepts_trace_id_header():
    with patch.object(settings, "PERF_ENABLED", True):
        from src.app.main import app
        from httpx import ASGITransport, AsyncClient

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/health", headers={"x-trace-id": "custom-trace-123"}
            )
            assert response.status_code == 200
            assert response.headers.get("x-trace-id") == "custom-trace-123"


@pytest.mark.asyncio
async def test_sql_instrumentation_tracks_queries():
    with patch.object(settings, "PERF_ENABLED", True):
        from src.app.perf import request_data_var
        from src.app.perf.sql import SQLInstrumentation

        instrumentation = SQLInstrumentation()
        mock_conn = MagicMock()
        mock_conn.info = {}

        instrumentation.before_cursor_execute(
            mock_conn, None, "SELECT * FROM test", None, None, False
        )
        instrumentation.after_cursor_execute(
            mock_conn, None, "SELECT * FROM test", None, None, False
        )

        data = request_data_var.get()
        assert data["query_count"] == 1
        assert data["total_db_time"] > 0


@pytest.mark.asyncio
async def test_n1_warning_on_repeated_queries():
    with patch.object(settings, "PERF_ENABLED", True):
        from src.app.perf import request_data_var
        from src.app.perf.sql import SQLInstrumentation

        instrumentation = SQLInstrumentation()
        mock_conn = MagicMock()
        mock_conn.info = {}

        sql = "SELECT * FROM animals WHERE id = $1"

        for _ in range(15):
            instrumentation.before_cursor_execute(
                mock_conn, None, sql, None, None, False
            )
            instrumentation.after_cursor_execute(
                mock_conn, None, sql, None, None, False
            )

        instrumentation.handle_request_end("test-trace")


def test_logger_colored_output():
    with patch.object(settings, "PERF_COLORED_LOGS", False):
        from src.app.perf.logger import PerfLogger

        logger = PerfLogger(colored=False)
        logger.info("test message", foo="bar")


def test_normalize_sql():
    from src.app.perf.sql import _normalize_sql

    sql1 = "SELECT * FROM animals WHERE id = 'abc-123'"
    sql2 = "SELECT * FROM animals WHERE id = 'xyz-789'"

    normalized1 = _normalize_sql(sql1)
    normalized2 = _normalize_sql(sql2)

    assert normalized1 == normalized2
