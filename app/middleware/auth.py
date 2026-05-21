# app/middleware/auth.py
import uuid
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from jose.backends import ECKey
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer()

_jwks_cache: dict | None = None

async def get_supabase_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        )
        r.raise_for_status()
        _jwks_cache = r.json()
        return _jwks_cache

async def decode_supabase_token(token: str) -> dict:
    """Try ES256 via JWKS first, fall back to HS256 JWT_SECRET."""
    # Try ES256 with JWKS
    try:
        jwks = await get_supabase_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        pass

    # Fallback: HS256 with JWT_SECRET (older Supabase projects)
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = await decode_supabase_token(token)

    supabase_user_id = payload.get("sub")
    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    result = await db.execute(
        select(User).where(User.supabase_auth_id == uuid.UUID(supabase_user_id))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Call /auth/sync-user first.",
        )
    return user


async def get_current_pt(user: User = Depends(get_current_user)) -> User:
    if user.role != "pt":
        raise HTTPException(status_code=403, detail="PT access required")
    return user


async def get_current_client(user: User = Depends(get_current_user)) -> User:
    if user.role != "client":
        raise HTTPException(status_code=403, detail="Client access required")
    return user