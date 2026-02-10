import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.audit_log import AuditLog


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        organization_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID,
        before: dict | None = None,
        after: dict | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        log = AuditLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
            ip=ip,
            user_agent=user_agent,
        )
        self.db.add(log)
        await self.db.flush()
        return log
