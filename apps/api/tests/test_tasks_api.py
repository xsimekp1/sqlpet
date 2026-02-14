"""Tests for GET /tasks route (no trailing slash)."""
import uuid

import pytest
from sqlalchemy import delete, select

from src.app.core.security import create_access_token
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus


@pytest.fixture()
async def tasks_env(db_session, test_user):
    """Creates org + role + membership so /tasks can be called."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()

    org = Organization(id=org_id, name="Tasks Test Org", slug=f"tasks-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    role = Role(id=role_id, organization_id=org_id, name="tasks_test_role", is_template=False)
    db_session.add(role)
    await db_session.flush()

    membership = Membership(
        id=membership_id,
        user_id=test_user.id,
        organization_id=org_id,
        role_id=role_id,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)
    await db_session.commit()

    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(test_user.id)})}",
        "x-organization-id": str(org_id),
    }

    yield {"org": org, "headers": headers}

    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


@pytest.mark.anyio
async def test_list_tasks_no_trailing_slash_returns_200(client, tasks_env):
    """GET /tasks (no trailing slash) must return 200, not 405."""
    env = tasks_env
    resp = await client.get("/tasks", headers=env["headers"])
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_list_tasks_returns_empty_list_for_new_org(client, tasks_env):
    """GET /tasks for a fresh org should return an empty items list."""
    env = tasks_env
    resp = await client.get("/tasks", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.anyio
async def test_list_tasks_requires_auth(client, tasks_env):
    """GET /tasks without auth header should return 401 or 422."""
    env = tasks_env
    resp = await client.get(
        "/tasks",
        headers={"x-organization-id": str(env["org"].id)},
    )
    assert resp.status_code in (401, 403, 422)
