import uuid

import pytest
from sqlalchemy import delete, select

from src.app.models.user import User
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.core.security import hash_password
from src.app.services.permission_service import PermissionService

pytestmark = pytest.mark.anyio


async def test_user_with_permission(db_session, test_user, test_org_with_membership):
    org, membership, role = test_org_with_membership
    svc = PermissionService(db_session)
    has = await svc.user_has_permission(test_user.id, org.id, "animals.read")
    assert has is True


async def test_user_without_permission(db_session, test_user, test_org_with_membership):
    org, membership, role = test_org_with_membership
    svc = PermissionService(db_session)
    has = await svc.user_has_permission(test_user.id, org.id, "animals.write")
    assert has is False


async def test_superadmin_bypass(db_session):
    uid = uuid.uuid4()
    org_id = uuid.uuid4()
    user = User(
        id=uid,
        email=f"admin-{uid.hex[:8]}@example.com",
        password_hash=hash_password("Admin123"),
        name="Super Admin",
        is_superadmin=True,
    )
    db_session.add(user)
    org = Organization(id=org_id, name="Admin Org", slug=f"admin-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.commit()

    try:
        svc = PermissionService(db_session)
        has = await svc.user_has_permission(uid, org_id, "anything.at.all")
        assert has is True
    finally:
        await db_session.execute(delete(Organization).where(Organization.id == org_id))
        await db_session.execute(delete(User).where(User.id == uid))
        await db_session.commit()


async def test_multi_tenant_isolation(db_session, test_user, test_org_with_membership):
    org1, membership, role = test_org_with_membership

    # Create a second org where user has no membership
    org2_id = uuid.uuid4()
    org2 = Organization(id=org2_id, name="Other Org", slug=f"other-org-{org2_id.hex[:8]}")
    db_session.add(org2)
    await db_session.commit()

    try:
        svc = PermissionService(db_session)
        # User has permission in org1
        assert await svc.user_has_permission(test_user.id, org1.id, "animals.read") is True
        # User has NO permission in org2
        assert await svc.user_has_permission(test_user.id, org2_id, "animals.read") is False
    finally:
        await db_session.execute(delete(Organization).where(Organization.id == org2_id))
        await db_session.commit()
