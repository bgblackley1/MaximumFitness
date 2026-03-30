import uuid
from datetime import date, datetime
from pydantic import BaseModel


class MeasurementCreate(BaseModel):
    date: date
    weight_kg: float | None = None
    chest_cm: float | None = None
    waist_cm: float | None = None
    left_arm_cm: float | None = None
    right_arm_cm: float | None = None
    thigh_cm: float | None = None
    hips_cm: float | None = None
    notes: str | None = None


class MeasurementUpdate(BaseModel):
    date: date | None = None
    weight_kg: float | None = None
    chest_cm: float | None = None
    waist_cm: float | None = None
    left_arm_cm: float | None = None
    right_arm_cm: float | None = None
    thigh_cm: float | None = None
    hips_cm: float | None = None
    notes: str | None = None


class MeasurementResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    date: date
    weight_kg: float | None = None
    chest_cm: float | None = None
    waist_cm: float | None = None
    left_arm_cm: float | None = None
    right_arm_cm: float | None = None
    thigh_cm: float | None = None
    hips_cm: float | None = None
    notes: str | None = None
    recorded_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}