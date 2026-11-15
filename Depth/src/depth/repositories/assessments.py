from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from depth.models.assessment import Assessment


class AssessmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(
        self, assessment_id: UUID, user_id: UUID, input_data: dict[str, Any], result: dict[str, Any],
        model: str, generation_seconds: float | None,
    ) -> Assessment:
        row = Assessment(
            id=assessment_id, user_id=user_id, input=input_data, result=result, model=model,
            generation_seconds=None if generation_seconds is None else Decimal(str(generation_seconds)),
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_owned(self, assessment_id: UUID, user_id: UUID) -> Assessment | None:
        return self.db.scalar(select(Assessment).where(Assessment.id == assessment_id, Assessment.user_id == user_id))

    def list_for_user(self, user_id: UUID, limit: int = 50) -> list[Assessment]:
        return list(self.db.scalars(
            select(Assessment).where(Assessment.user_id == user_id).order_by(Assessment.created_at.desc()).limit(limit)
        ))
