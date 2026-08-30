import uuid
import datetime as dt
from pydantic import BaseModel


# ── Exercise in a workout ─────────────────────────────────────────────────────

class WorkoutExerciseCreate(BaseModel):
    exercise_id: uuid.UUID
    order:        int
    sets:         int
    reps:         str
    rest_seconds: int = 60
    notes:        str | None = None


# ── Create / Update a workout (flat — no weeks/days) ─────────────────────────

class WorkoutCreate(BaseModel):
    title:       str
    focus:       str | None = None   # arms|legs|push|pull|back|chest|core|full_body|cardio
    description: str | None = None
    visibility:  str = "draft"
    exercises:   list[WorkoutExerciseCreate] = []


# ── Assignment ────────────────────────────────────────────────────────────────

class AssignPlanRequest(BaseModel):
    client_ids: list[uuid.UUID]


class SetClientWorkoutsRequest(BaseModel):
    workout_ids: list[uuid.UUID]


# ── Response schemas ──────────────────────────────────────────────────────────

class AssignedClientBasic(BaseModel):
    id:   uuid.UUID
    name: str


class WorkoutExerciseResponse(BaseModel):
    id:           uuid.UUID
    exercise_id:  uuid.UUID
    name:         str
    muscle_group: str | None = None
    image_url:    str | None = None
    order:        int
    sets:         int
    reps:         str
    rest_seconds: int
    notes:        str | None = None
    model_config = {"from_attributes": True}


class WorkoutResponse(BaseModel):
    id:               uuid.UUID
    title:            str
    focus:            str | None = None
    description:      str | None = None
    visibility:       str
    status:           str
    created_at:       dt.datetime
    exercise_count:   int = 0
    exercises:        list[WorkoutExerciseResponse] = []
    assigned_clients: list[AssignedClientBasic] = []
    model_config = {"from_attributes": True}


# ── Legacy schemas kept for internal use ─────────────────────────────────────

class PlanExerciseCreate(BaseModel):
    exercise_id:       uuid.UUID
    order:             int
    sets:              int
    reps:              str
    rest_seconds:      int = 60
    notes:             str | None = None
    progression_rule:  dict | None = None


class PlanDayCreate(BaseModel):
    day_label: str
    day_order: int
    exercises: list[PlanExerciseCreate] = []


class PlanWeekCreate(BaseModel):
    week_number: int
    days:        list[PlanDayCreate] = []


class WorkoutPlanCreate(BaseModel):
    title:      str
    client_id:  uuid.UUID | None = None
    goal_focus: str | None = None
    start_date: dt.date | None = None
    visibility: str | None = "draft"
    weeks:      list[PlanWeekCreate] = []
    exercises:  list[PlanExerciseCreate] | None = None