import uuid
from datetime import date, time, datetime
from pydantic import BaseModel


class AvailabilitySlotCreate(BaseModel):
    day_of_week: int | None = None
    start_time: time
    end_time: time
    is_recurring: bool = True
    specific_date: date | None = None


class AvailabilitySlotResponse(BaseModel):
    id: uuid.UUID
    pt_id: uuid.UUID
    day_of_week: int | None = None
    start_time: time
    end_time: time
    is_recurring: bool
    specific_date: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailableSlotResponse(BaseModel):
    date: date
    start_time: time
    end_time: time


class BookingCreate(BaseModel):
    client_id: uuid.UUID | None = None
    date: date
    start_time: time
    end_time: time
    type: str
    location: str | None = None
    notes: str | None = None


class BookingUpdate(BaseModel):
    date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: str | None = None
    notes: str | None = None


class BookingResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    pt_id: uuid.UUID
    date: date
    start_time: time
    end_time: time
    type: str
    location: str | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}