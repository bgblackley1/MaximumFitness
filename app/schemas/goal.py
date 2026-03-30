import uuid
from datetime import date, datetime
from pydantic import BaseModel


class GoalCreate(BaseModel):
    type: str
    description: str
    target_value: float
    target_unit: str
    target_date: date | None = None
    current_value: float | None = None


class GoalUpdate(BaseModel):
    type: str | None = None
    description: str | None = None
    target_value: float | None = None
    target_unit: str | None = None
    target_date: date | None = None
    current_value: float | None = None
    status: str | None = None


class GoalResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    type: str
    description: str
    target_value: float
    target_unit: str
    target_date: date | None = None
    current_value: float | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}