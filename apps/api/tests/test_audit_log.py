import uuid

import pytest
from sqlalchemy import delete, select

from src.app.models.audit_log import AuditLog
from src.app.services.audit_service import AuditService

pytestmark = pytest.mark.anyio


async def test_create_audit_log(db_session, test_user, test_org_with_membership):
    org, membership, role = test_org_with_membership
    entity_id = uuid.uuid4()

    svc = AuditService(db_session)
    log = await svc.log_action(
        organization_id=org.id,
        actor_user_id=test_user.id,
        action="create",
        entity_type="animal",
        entity_id=entity_id,
        after={"name": "Rex", "species": "dog"},
        ip="127.0.0.1",
    )
    await db_session.commit()

    try:
        result = await db_session.execute(
            select(AuditLog).where(AuditLog.id == log.id)
        )
        fetched = result.scalar_one()
        assert fetched.action == "create"
        assert fetched.entity_type == "animal"
        assert fetched.entity_id == entity_id
        assert fetched.after == {"name": "Rex", "species": "dog"}
        assert fetched.before is None
        assert fetched.ip == "127.0.0.1"
        assert fetched.created_at is not None
    finally:
        await db_session.execute(delete(AuditLog).where(AuditLog.id == log.id))
        await db_session.commit()


async def test_audit_log_with_before_after(db_session, test_user, test_org_with_membership):
    org, membership, role = test_org_with_membership
    entity_id = uuid.uuid4()

    svc = AuditService(db_session)
    log = await svc.log_action(
        organization_id=org.id,
        actor_user_id=test_user.id,
        action="update",
        entity_type="animal",
        entity_id=entity_id,
        before={"name": "Rex"},
        after={"name": "Rex II"},
    )
    await db_session.commit()

    try:
        result = await db_session.execute(
            select(AuditLog).where(AuditLog.id == log.id)
        )
        fetched = result.scalar_one()
        assert fetched.before == {"name": "Rex"}
        assert fetched.after == {"name": "Rex II"}
    finally:
        await db_session.execute(delete(AuditLog).where(AuditLog.id == log.id))
        await db_session.commit()
