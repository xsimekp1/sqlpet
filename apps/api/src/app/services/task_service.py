from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid

from src.app.models.task import Task


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tasks_for_organization(
        self, organization_id: uuid.UUID
    ) -> List[Task]:
        """Get all tasks for an organization."""
        stmt = (
            select(Task)
            .where(Task.organization_id == organization_id)
            .order_by(Task.created_at.desc())
        )

        result = await self.db.execute(stmt)
        return result.scalars().all()
