import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: str | None = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}