import uuid
import pytest
from sqlalchemy import delete, select, text

from src.app.models.walk_log import WalkLog
from src.app.models.user import User
from src.app.models.organization import Organization

pytestmark = pytest.mark.anyio


async def test_walk_log_has_enrichment_fields(
    db_session, test_user, test_org_with_membership
):
    """Test that walk_log table has enrichment columns."""
    org, membership, role = test_org_with_membership

    # Check columns exist in database
    result = await db_session.execute(
        text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'walk_logs' 
            AND table_schema = 'public'
        """)
    )
    columns = {row[0] for row in result.fetchall()}

    assert "enrichment_types" in columns, "enrichment_types column missing"
    assert "intensity" in columns, "intensity column missing"
    assert "reaction" in columns, "reaction column missing"


async def test_create_walk_with_enrichment(
    db_session, test_user, test_org_with_membership
):
    """Test creating a walk with enrichment data."""
    org, membership, role = test_org_with_membership

    walk = WalkLog(
        id=uuid.uuid4(),
        organization_id=org.id,
        animal_ids=[uuid.uuid4()],
        walk_type="walk",
        started_at=pytest.importorskip("datetime").datetime.now(),
        started_by_id=test_user.id,
        status="completed",
        enrichment_types=["nosework", "kong"],
        intensity="medium",
        reaction="good",
    )
    db_session.add(walk)
    await db_session.commit()
    await db_session.refresh(walk)

    try:
        assert walk.enrichment_types == ["nosework", "kong"]
        assert walk.intensity == "medium"
        assert walk.reaction == "good"
    finally:
        await db_session.execute(delete(WalkLog).where(WalkLog.id == walk.id))
        await db_session.commit()


async def test_walk_log_model_has_enrichment_fields():
    """Test that WalkLog SQLAlchemy model has enrichment fields."""
    from src.app.models.walk_log import WalkLog

    # Check model has the fields
    assert hasattr(WalkLog, "enrichment_types"), (
        "WalkLog model missing enrichment_types"
    )
    assert hasattr(WalkLog, "intensity"), "WalkLog model missing intensity"
    assert hasattr(WalkLog, "reaction"), "WalkLog model missing reaction"
