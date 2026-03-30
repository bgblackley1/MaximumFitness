from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.middleware.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()


class RegisterTokenRequest(BaseModel):
    token: str


@router.post("/register-token")
async def register_push_token(
    body: RegisterTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.push_token = body.token
    await db.flush()
    return {"message": "Token registered"}