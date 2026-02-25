"""Tests for Purchase Order API endpoints."""

import uuid
import pytest
from decimal import Decimal
from datetime import date

from sqlalchemy import delete, select

from src.app.core.security import create_access_token
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.user import User
from src.app.models.inventory_item import InventoryItem, InventoryCategory
from src.app.models.purchase_order import PurchaseOrder, PurchaseOrderItem


@pytest.fixture()
async def po_env(db_session, test_user):
    """Creates org + role + membership + inventory item for PO tests."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()
    item_id = uuid.uuid4()

    org = Organization(id=org_id, name="PO Test Org", slug=f"po-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    role = Role(
        id=role_id, organization_id=org_id, name="po_test_role", is_template=False
    )
    db_session.add(role)
    await db_session.flush()

    item = InventoryItem(
        id=item_id,
        organization_id=org_id,
        name="Test Krmivo",
        category=InventoryCategory.FOOD,
        unit="kg",
        reorder_threshold=Decimal("10.00"),
        quantity_current=Decimal("0.00"),
    )
    db_session.add(item)
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

    yield {"org": org, "item": item, "headers": headers}

    await db_session.execute(
        delete(PurchaseOrderItem).where(PurchaseOrderItem.inventory_item_id == item_id)
    )
    await db_session.execute(
        delete(PurchaseOrder).where(PurchaseOrder.organization_id == org_id)
    )
    await db_session.execute(delete(InventoryItem).where(InventoryItem.id == item_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


@pytest.mark.anyio
async def test_create_purchase_order(client, po_env):
    """POST /purchase-orders should create a new purchase order."""
    env = po_env
    payload = {
        "supplier": "Test Supplier",
        "expected_delivery_date": str(date.today()),
        "notes": "Test PO",
        "items": [
            {
                "inventory_item_id": str(env["item"].id),
                "quantity_ordered": 50,
                "unit_price": Decimal("25.50"),
            }
        ],
    }
    resp = await client.post("/purchase-orders", json=payload, headers=env["headers"])
    assert resp.status_code == 201, f"Response: {resp.text}"
    data = resp.json()
    assert "id" in data
    assert data["supplier"] == "Test Supplier"
    assert data["status"] == "ordered"
    assert len(data["items"]) == 1


@pytest.mark.anyio
async def test_list_purchase_orders(client, po_env):
    """GET /purchase-orders should return list of POs."""
    env = po_env
    resp = await client.get("/purchase-orders", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.anyio
async def test_get_purchase_order_by_id(client, po_env):
    """GET /purchase-orders/{id} should return PO detail."""
    env = po_env

    create_payload = {
        "supplier": "Detail Supplier",
        "expected_delivery_date": str(date.today()),
        "items": [
            {
                "inventory_item_id": str(env["item"].id),
                "quantity_ordered": 100,
                "unit_price": Decimal("10.00"),
            }
        ],
    }
    create_resp = await client.post(
        "/purchase-orders", json=create_payload, headers=env["headers"]
    )
    assert create_resp.status_code == 201
    po_id = create_resp.json()["id"]

    resp = await client.get(f"/purchase-orders/{po_id}", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == po_id
    assert data["supplier"] == "Detail Supplier"


@pytest.mark.anyio
async def test_receive_purchase_order(client, po_env):
    """POST /purchase-orders/{id}/receive should receive goods."""
    env = po_env

    create_payload = {
        "supplier": "Receive Supplier",
        "expected_delivery_date": str(date.today()),
        "items": [
            {
                "inventory_item_id": str(env["item"].id),
                "quantity_ordered": 50,
                "unit_price": Decimal("20.00"),
            }
        ],
    }
    create_resp = await client.post(
        "/purchase-orders", json=create_payload, headers=env["headers"]
    )
    assert create_resp.status_code == 201
    po_id = create_resp.json()["id"]
    item_id = create_resp.json()["items"][0]["id"]

    receive_payload = {
        "items": [
            {
                "purchase_order_item_id": item_id,
                "quantity_received": 50,
            }
        ]
    }
    resp = await client.post(
        f"/purchase-orders/{po_id}/receive",
        json=receive_payload,
        headers=env["headers"],
    )
    assert resp.status_code == 200, f"Response: {resp.text}"
    data = resp.json()
    assert data["status"] == "received"


@pytest.mark.anyio
async def test_cancel_purchase_order(client, po_env):
    """POST /purchase-orders/{id}/cancel should cancel PO."""
    env = po_env

    create_payload = {
        "supplier": "Cancel Supplier",
        "expected_delivery_date": str(date.today()),
        "items": [
            {
                "inventory_item_id": str(env["item"].id),
                "quantity_ordered": 25,
                "unit_price": Decimal("15.00"),
            }
        ],
    }
    create_resp = await client.post(
        "/purchase-orders", json=create_payload, headers=env["headers"]
    )
    assert create_resp.status_code == 201
    po_id = create_resp.json()["id"]

    resp = await client.post(f"/purchase-orders/{po_id}/cancel", headers=env["headers"])
    assert resp.status_code == 200, f"Response: {resp.text}"
    data = resp.json()
    assert data["status"] == "cancelled"


@pytest.mark.anyio
async def test_create_po_requires_auth(client, po_env):
    """POST /purchase-orders without auth should fail."""
    env = po_env
    payload = {
        "supplier": "Test",
        "expected_delivery_date": str(date.today()),
        "items": [
            {
                "inventory_item_id": str(env["item"].id),
                "quantity_ordered": 10,
                "unit_price": Decimal("10.00"),
            }
        ],
    }
    resp = await client.post(
        "/purchase-orders",
        json=payload,
        headers={"x-organization-id": str(env["org"].id)},
    )
    assert resp.status_code in (401, 403, 422)


@pytest.mark.anyio
async def test_cannot_cancel_received_po(client, po_env):
    """Cannot cancel a PO that has been received."""
    env = po_env

    create_payload = {
        "supplier": "Received PO",
        "expected_delivery_date": str(date.today()),
        "items": [
            {
                "inventory_item_id": str(env["item"].id),
                "quantity_ordered": 30,
                "unit_price": Decimal("12.00"),
            }
        ],
    }
    create_resp = await client.post(
        "/purchase-orders", json=create_payload, headers=env["headers"]
    )
    assert create_resp.status_code == 201
    po_id = create_resp.json()["id"]
    item_id = create_resp.json()["items"][0]["id"]

    receive_payload = {
        "items": [
            {
                "purchase_order_item_id": item_id,
                "quantity_received": 30,
            }
        ]
    }
    await client.post(
        f"/purchase-orders/{po_id}/receive",
        json=receive_payload,
        headers=env["headers"],
    )

    cancel_resp = await client.post(
        f"/purchase-orders/{po_id}/cancel", headers=env["headers"]
    )
    assert cancel_resp.status_code == 400
