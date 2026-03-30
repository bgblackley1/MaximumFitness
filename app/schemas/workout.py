import uuid
from datetime import date, datetime
from pydantic import BaseModel


class PlanExerciseCreate(BaseModel):
    exercise_id: uuid.UUID
    order: int
    sets: int
    reps: str
    rest_seconds: int = 60
    notes: str | None = None
    progression_rule: dict | None = None


class PlanDayCreate(BaseModel):
    day_label: str
    day_order: int
    exercises: list[PlanExerciseCreate] = []


class PlanWeekCreate(BaseModel):
    week_number: int
    days: list[PlanDayCreate] = []


class WorkoutPlanCreate(BaseModel):
    title: str
    client_id: uuid.UUID | None = None
    goal_focus: str | None = None
    start_date: date | None = None
    visibility: str | None = "draft"
    weeks: list[PlanWeekCreate] = []


# ── Response schemas ──

class PlanExerciseResponse(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    order: int
    sets: int
    reps: str
    rest_seconds: int
    notes: str | None = None
    progression_rule: dict | None = None

    # Nested exercise info
    exercise: "ExerciseBasic | None" = None

    model_config = {"from_attributes": True}


class ExerciseBasic(BaseModel):
    id: uuid.UUID
    name: str
    muscle_group: str | None = None
    image_url: str | None = None
    cues: str | None = None

    model_config = {"from_attributes": True}


class PlanDayResponse(BaseModel):
    id: uuid.UUID
    day_label: str
    day_order: int
    exercises: list[PlanExerciseResponse] = []

    model_config = {"from_attributes": True}


class PlanWeekResponse(BaseModel):
    id: uuid.UUID
    week_number: int
    days: list[PlanDayResponse] = []

    model_config = {"from_attributes": True}


class WorkoutPlanResponse(BaseModel):
    id: uuid.UUID
    pt_id: uuid.UUID
    client_id: uuid.UUID | None = None
    title: str
    goal_focus: str | None = None
    start_date: date | None = None
    visibility: str
    status: str
    created_at: datetime
    updated_at: datetime
    weeks: list[PlanWeekResponse] = []

    model_config = {"from_attributes": True}


class WorkoutPlanSummary(BaseModel):
    id: uuid.UUID
    title: str
    client_id: uuid.UUID | None = None
    goal_focus: str | None = None
    start_date: date | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Fix forward reference
PlanExerciseResponse.model_rebuild()