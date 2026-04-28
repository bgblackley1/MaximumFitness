from __future__ import annotations

import uuid
import datetime as dt
from pydantic import BaseModel


class ProgressPhotoResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    date: dt.date
    file_url: str
    notes: str | None = None
    created_at: dt.datetime

    model_config = {"from_attributes": True}