import uuid
from datetime import datetime
from pydantic import BaseModel


class ExerciseCreate(BaseModel):
    name: str
    category: str | None = None
    muscle_group: str | None = None
    equipment: str | None = None
    cues: str | None = None
    image_url: str | None = None
    video_url: str | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    muscle_group: str | None = None
    equipment: str | None = None
    cues: str | None = None
    image_url: str | None = None
    video_url: str | None = None


class ExerciseResponse(BaseModel):
    id: uuid.UUID
    pt_id: uuid.UUID
    name: str
    category: str | None = None
    muscle_group: str | None = None
    equipment: str | None = None
    cues: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}