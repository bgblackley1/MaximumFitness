from __future__ import annotations

import uuid
import datetime as dt
from pydantic import BaseModel


class AvailabilitySlotCreate(BaseModel):
    day_of_week: int | None = None
    start_time: dt.time
    end_time: dt.time
    is_recurring: bool = True
    specific_date: dt.date | None = None


class AvailabilitySlotResponse(BaseModel):
    id: uuid.UUID
    pt_id: uuid.UUID
    day_of_week: int | None = None
    start_time: dt.time
    end_time: dt.time
    is_recurring: bool
    specific_date: dt.date | None = None
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class AvailableSlotResponse(BaseModel):
    date: dt.date
    start_time: dt.time
    end_time: dt.time


class BookingCreate(BaseModel):
    client_id: uuid.UUID | None = None
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    type: str
    location: str | None = None
    notes: str | None = None


class BookingUpdate(BaseModel):
    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    status: str | None = None
    notes: str | None = None


class BookingResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    pt_id: uuid.UUID
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    type: str
    location: str | None = None
    status: str
    notes: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}