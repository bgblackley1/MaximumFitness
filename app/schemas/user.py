import uuid
import datetime as dt
from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: str | None = None
    role: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}