import uuid
import datetime as dt
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
    client_id: uuid.UUID | None = None   # legacy; ignored for assignment
    goal_focus: str | None = None
    start_date: dt.date | None = None
    visibility: str | None = "draft"
    weeks: list[PlanWeekCreate] = []


class AssignPlanRequest(BaseModel):
    client_ids: list[uuid.UUID]


# ── Response schemas ────────────────────────────────────────────────────────

class ExerciseBasic(BaseModel):
    id: uuid.UUID
    name: str
    muscle_group: str | None = None
    image_url: str | None = None
    cues: str | None = None
    model_config = {"from_attributes": True}


class PlanExerciseResponse(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    order: int
    sets: int
    reps: str
    rest_seconds: int
    notes: str | None = None
    progression_rule: dict | None = None
    exercise: "ExerciseBasic | None" = None
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


class AssignedClientBasic(BaseModel):
    id: uuid.UUID
    name: str


class WorkoutPlanSummary(BaseModel):
    id: uuid.UUID
    title: str
    goal_focus: str | None = None
    start_date: dt.date | None = None
    status: str
    visibility: str
    created_at: dt.datetime
    assigned_clients: list[AssignedClientBasic] = []
    model_config = {"from_attributes": True}


class WorkoutPlanResponse(BaseModel):
    id: uuid.UUID
    pt_id: uuid.UUID
    client_id: uuid.UUID | None = None
    title: str
    goal_focus: str | None = None
    start_date: dt.date | None = None
    visibility: str
    status: str
    created_at: dt.datetime
    updated_at: dt.datetime
    weeks: list[PlanWeekResponse] = []
    assigned_clients: list[AssignedClientBasic] = []
    model_config = {"from_attributes": True}


PlanExerciseResponse.model_rebuild()