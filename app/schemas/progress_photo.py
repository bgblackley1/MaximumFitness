import uuid
from datetime import date, datetime
from pydantic import BaseModel


class ProgressPhotoResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    date: date
    file_url: str
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}