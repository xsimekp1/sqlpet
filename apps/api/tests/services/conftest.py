"""Conftest for service unit tests - isolated from database fixtures"""
import pytest

# Override parent autouse fixtures to prevent database setup for unit tests
@pytest.fixture(scope="session", autouse=True)
def dispose_engine():
    """Override parent fixture - no database cleanup needed for mocked tests"""
    yield
