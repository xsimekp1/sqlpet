"""API routes for user keyboard shortcuts."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.user_shortcut import UserKeyboardShortcut

router = APIRouter(prefix="/me/shortcuts", tags=["shortcuts"])

# System defaults
DEFAULT_SHORTCUTS: dict[str, str] = {
    "open_search": "ctrl+k",
    "open_animals": "ctrl+shift+a",
    "open_kennels": "ctrl+shift+k",
    "open_tasks": "ctrl+shift+t",
    "open_inventory": "ctrl+shift+i",
    "open_feeding": "ctrl+shift+f",
}


class ShortcutResponse(BaseModel):
    action: str
    key_combo: str
    is_custom: bool = False


class ShortcutUpsert(BaseModel):
    key_combo: str


@router.get("", response_model=List[ShortcutResponse])
async def list_shortcuts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all shortcuts for the current user, merging with system defaults."""
    result = await db.execute(
        select(UserKeyboardShortcut).where(UserKeyboardShortcut.user_id == current_user.id)
    )
    custom = {row.action: row.key_combo for row in result.scalars().all()}

    shortcuts = []
    for action, default_combo in DEFAULT_SHORTCUTS.items():
        if action in custom:
            shortcuts.append(ShortcutResponse(action=action, key_combo=custom[action], is_custom=True))
        else:
            shortcuts.append(ShortcutResponse(action=action, key_combo=default_combo, is_custom=False))

    return shortcuts


@router.put("/{action}", response_model=ShortcutResponse)
async def upsert_shortcut(
    action: str,
    data: ShortcutUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a keyboard shortcut for an action."""
    if action not in DEFAULT_SHORTCUTS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    # Upsert using PostgreSQL ON CONFLICT
    stmt = pg_insert(UserKeyboardShortcut).values(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action=action,
        key_combo=data.key_combo,
    ).on_conflict_do_update(
        constraint="uq_user_shortcut_action",
        set_={"key_combo": data.key_combo},
    )
    await db.execute(stmt)
    await db.commit()

    return ShortcutResponse(action=action, key_combo=data.key_combo, is_custom=True)


@router.delete("/{action}", status_code=204)
async def reset_shortcut(
    action: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset a shortcut to system default by deleting the custom row."""
    await db.execute(
        delete(UserKeyboardShortcut).where(
            UserKeyboardShortcut.user_id == current_user.id,
            UserKeyboardShortcut.action == action,
        )
    )
    await db.commit()
