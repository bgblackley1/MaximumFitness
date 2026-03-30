import uuid
from datetime import date, datetime
from pydantic import BaseModel


class WorkoutLogCreate(BaseModel):
    plan_day_id: uuid.UUID | None = None
    date: date


class WorkoutLogSetCreate(BaseModel):
    plan_exercise_id: uuid.UUID | None = None
    exercise_id: uuid.UUID
    set_number: int
    reps_completed: int
    weight_kg: float | None = None
    rpe: float | None = None
    notes: str | None = None


class WorkoutLogSetResponse(BaseModel):
    id: uuid.UUID
    set_number: int
    exercise_id: uuid.UUID
    reps_completed: int
    weight_kg: float | None = None
    rpe: float | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class WorkoutLogResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    plan_day_id: uuid.UUID | None = None
    date: date
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    sets: list[WorkoutLogSetResponse] = []

    model_config = {"from_attributes": True}