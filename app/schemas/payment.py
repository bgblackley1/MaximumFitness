from __future__ import annotations

import uuid
import datetime as dt
from pydantic import BaseModel


class CreateCustomerRequest(BaseModel):
    client_id: uuid.UUID


class CreateSubscriptionRequest(BaseModel):
    client_id: uuid.UUID
    stripe_customer_id: str
    stripe_price_id: str
    plan_name: str
    amount_pence: int
    currency: str | None = "gbp"
    billing_cycle: str


class SubscriptionUpdate(BaseModel):
    action: str  # "cancel", "pause", "resume"


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    stripe_subscription_id: str | None = None
    stripe_customer_id: str
    plan_name: str
    amount_pence: int
    currency: str
    billing_cycle: str
    status: str
    current_period_end: dt.datetime | None = None
    payment_method_last4: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    subscription_id: uuid.UUID
    client_id: uuid.UUID
    stripe_invoice_id: str | None = None
    amount_pence: int
    status: str
    date: dt.datetime
    pdf_url: str | None = None
    created_at: dt.datetime

    model_config = {"from_attributes": True}