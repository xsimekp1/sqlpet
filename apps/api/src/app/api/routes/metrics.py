"""
API Performance Metrics Routes

Provides endpoints for viewing API performance metrics.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_user,
    require_permission,
    get_current_organization_id,
)
from src.app.api.dependencies.db import get_db
from src.app.models.api_metric import ApiMetric
from src.app.models.user import User

router = APIRouter(prefix="/metrics", tags=["metrics"])


class MetricResponse(BaseModel):
    method: str
    path: str
    status_code: int
    duration_ms: int
    query_count: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class MetricsSummaryResponse(BaseModel):
    total_requests: int
    avg_duration_ms: float
    avg_queries: float
    slowest_requests: list[MetricResponse]
    top_endpoints: list[dict]
    requests_by_hour: list[dict]


@router.get("", response_model=MetricsSummaryResponse)
async def get_metrics_summary(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("metrics.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get performance metrics summary for the organization."""

    # Time filter
    since = datetime.utcnow() - timedelta(hours=hours)

    # Get metrics for organization
    base_filter = [
        ApiMetric.organization_id == str(organization_id),
        ApiMetric.created_at >= since,
    ]

    # Total requests and averages
    stats_result = await db.execute(
        select(
            func.count(ApiMetric.id).label("total"),
            func.avg(ApiMetric.duration_ms).label("avg_duration"),
            func.avg(ApiMetric.query_count).label("avg_queries"),
        ).where(*base_filter)
    )
    stats = stats_result.one()

    # Slowest requests
    slow_result = await db.execute(
        select(ApiMetric)
        .where(*base_filter)
        .order_by(desc(ApiMetric.duration_ms))
        .limit(limit)
    )
    slowest = list(slow_result.scalars().all())

    # Top endpoints by average duration
    top_endpoints_result = await db.execute(
        select(
            ApiMetric.path,
            func.count(ApiMetric.id).label("count"),
            func.avg(ApiMetric.duration_ms).label("avg_duration"),
            func.avg(ApiMetric.query_count).label("avg_queries"),
        )
        .where(*base_filter)
        .group_by(ApiMetric.path)
        .order_by(desc("avg_duration"))
        .limit(10)
    )
    top_endpoints = [
        {
            "path": row.path,
            "count": row.count,
            "avg_duration_ms": round(row.avg_duration or 0),
            "avg_queries": round(row.avg_queries or 0),
        }
        for row in top_endpoints_result.fetchall()
    ]

    # Requests by hour
    hourly_result = await db.execute(
        select(
            func.date_trunc("hour", ApiMetric.created_at).label("hour"),
            func.count(ApiMetric.id).label("count"),
        )
        .where(*base_filter)
        .group_by("hour")
        .order_by("hour")
    )
    requests_by_hour = [
        {
            "hour": row.hour.isoformat()
            if hasattr(row.hour, "isoformat")
            else str(row.hour),
            "count": row.count,
        }
        for row in hourly_result.fetchall()
    ]

    return MetricsSummaryResponse(
        total_requests=stats.total or 0,
        avg_duration_ms=round(stats.avg_duration or 0),
        avg_queries=round(stats.avg_queries or 0),
        slowest_requests=slowest,
        top_endpoints=top_endpoints,
        requests_by_hour=requests_by_hour,
    )


@router.get("/recent")
async def get_recent_metrics(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_permission("metrics.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get recent API requests."""

    result = await db.execute(
        select(ApiMetric)
        .where(
            ApiMetric.organization_id == str(organization_id),
        )
        .order_by(desc(ApiMetric.created_at))
        .limit(limit)
    )

    return list(result.scalars().all())
