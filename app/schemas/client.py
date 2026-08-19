import uuid
import datetime as dt
from pydantic import BaseModel


class ClientCreate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    starting_weight_kg: float | None = None
    goals: list[str] | None = None
    injuries: list[str] | None = None
    notes: str | None = None


class ClientCreateViaAuth(ClientCreate):
    """Used by the /auth/register-client endpoint."""
    pass


class ClientUpdate(BaseModel):
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    starting_weight_kg: float | None = None
    goals: list[str] | None = None
    injuries: list[str] | None = None
    notes: str | None = None
    status: str | None = None
    plan_type: str | None = None


class ClientResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    pt_id: uuid.UUID
    name: str
    email: str
    phone: str | None = None
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    starting_weight_kg: float | None = None
    goals: list = []
    injuries: list = []
    notes: str | None = None
    status: str
    plan_type: str | None = None
    created_at: dt.datetime
    last_check_in: dt.date | None = None

    model_config = {"from_attributes": True}