from __future__ import annotations

import uuid
import datetime as dt
from pydantic import BaseModel


class SessionPackCreate(BaseModel):
    client_id: uuid.UUID
    pack_name: str
    total_sessions: int
    price_paid_pence: int
    currency: str = "gbp"
    notes: str | None = None
    expires_at: dt.datetime | None = None


class SessionPackAdjust(BaseModel):
    """Manually add or remove sessions (positive = add, negative = deduct)."""
    adjustment: int
    reason: str | None = None


class SessionPackResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    pt_id: uuid.UUID
    pack_name: str
    total_sessions: int
    sessions_remaining: int
    price_paid_pence: int
    currency: str
    status: str
    notes: str | None = None
    expires_at: dt.datetime | None = None
    purchased_at: dt.datetime
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    client_id: uuid.UUID
    pack_id: uuid.UUID | None = None
    description: str
    amount_pence: int
    currency: str = "gbp"
    status: str = "paid"
    date: dt.datetime


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    pack_id: uuid.UUID | None = None
    description: str
    amount_pence: int
    currency: str
    status: str
    date: dt.datetime
    created_at: dt.datetime

    model_config = {"from_attributes": True}