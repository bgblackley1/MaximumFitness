import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.middleware.auth import get_current_user, get_current_pt
from app.services.supabase_service import supabase_admin
from app.schemas.user import UserResponse
from app.schemas.client import ClientCreateViaAuth

router = APIRouter()


@router.post("/register-client", status_code=status.HTTP_201_CREATED)
async def register_client(
    body: ClientCreateViaAuth,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    """PT-only: creates a Supabase Auth user + User + ClientProfile."""
    # Check email not already used
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create in Supabase Auth
    supabase_user = await supabase_admin.create_user(email=body.email)
    supabase_auth_id = supabase_user["id"]

    # Create local User
    user = User(
        email=body.email,
        name=body.name,
        role="client",
        supabase_auth_id=supabase_auth_id,
    )
    db.add(user)
    await db.flush()

    # Create ClientProfile
    client_profile = ClientProfile(
        user_id=user.id,
        pt_id=pt.id,
        age=body.age,
        sex=body.sex,
        height_cm=body.height_cm,
        starting_weight_kg=body.starting_weight_kg,
        goals=body.goals or [],
        injuries=body.injuries or [],
        notes=body.notes,
    )
    db.add(client_profile)
    await db.flush()

    # Send invite email
    await supabase_admin.invite_user_by_email(body.email)

    return {"message": "Client registered and invite sent", "client_id": str(client_profile.id)}


@router.post("/sync-user")
async def sync_user(
    user: User = Depends(get_current_user),
):
    """Called after Supabase login to confirm user exists in local DB."""
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Returns the current user's profile and role."""
    return user