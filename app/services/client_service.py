import uuid
import secrets
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.user import User
from app.models.client import ClientProfile
from app.models.measurement import Measurement
from app.services.supabase_service import supabase_admin


class ClientService:

    @staticmethod
    async def get_clients(
        db: AsyncSession,
        pt_id: uuid.UUID,
        search: str | None = None,
        status: str | None = None,
        goal: str | None = None,
        injury: str | None = None,
    ) -> list[ClientProfile]:
        query = (
            select(ClientProfile)
            .join(User, ClientProfile.user_id == User.id)
            .where(ClientProfile.pt_id == pt_id)
        )
        if status:
            query = query.where(ClientProfile.status == status)
        if search:
            query = query.where(
                User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
            )
        if goal:
            query = query.where(ClientProfile.goals.contains([goal]))
        if injury:
            query = query.where(ClientProfile.injuries.contains([injury]))

        query = query.options(selectinload(ClientProfile.user))
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_client_by_id(
        db: AsyncSession, client_id: uuid.UUID, pt_id: uuid.UUID
    ) -> ClientProfile | None:
        result = await db.execute(
            select(ClientProfile)
            .where(ClientProfile.id == client_id, ClientProfile.pt_id == pt_id)
            .options(
                selectinload(ClientProfile.user),
                selectinload(ClientProfile.goals_list),
                selectinload(ClientProfile.workout_plans),
                selectinload(ClientProfile.bookings),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_client(
        db: AsyncSession,
        pt_id: uuid.UUID,
        name: str,
        email: str,
        phone: str | None = None,
        age: int | None = None,
        sex: str | None = None,
        height_cm: float | None = None,
        starting_weight_kg: float | None = None,
        goals: list | None = None,
        injuries: list | None = None,
        notes: str | None = None,
    ) -> tuple[ClientProfile, str]:
        # 0. Check email not already in our DB
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already registered")

        # 1. Generate a secure temporary password
        temp_password = secrets.token_urlsafe(12)

        # 2. Create Supabase Auth user
        try:
            supabase_user = await supabase_admin.create_user(
                email=email,
                password=temp_password,
                full_name=name,
            )
            supabase_auth_id = supabase_user["id"]
        except Exception as e:
            error_str = str(e)
            if "already been registered" in error_str or "already exists" in error_str:
                raise HTTPException(
                    status_code=409,
                    detail="Email already registered in auth system",
                )
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create auth user: {error_str}",
            )

        # 3. Create User record in FastAPI DB
        user = User(
            email=email,
            name=name,
            phone=phone,
            role="client",
            supabase_auth_id=supabase_auth_id,
        )
        db.add(user)
        await db.flush()

        # 4. Create ClientProfile
        client_profile = ClientProfile(
            user_id=user.id,
            pt_id=pt_id,
            age=age,
            sex=sex,
            height_cm=height_cm,
            starting_weight_kg=starting_weight_kg,
            goals=goals or [],
            injuries=injuries or [],
            notes=notes,
        )
        db.add(client_profile)
        await db.flush()

        return client_profile, temp_password

    @staticmethod
    async def update_client(
        db: AsyncSession,
        client_profile: ClientProfile,
        **kwargs,
    ) -> ClientProfile:
        for key, value in kwargs.items():
            if value is not None and hasattr(client_profile, key):
                setattr(client_profile, key, value)
        await db.flush()
        return client_profile

    @staticmethod
    async def archive_client(
        db: AsyncSession, client_profile: ClientProfile
    ) -> ClientProfile:
        client_profile.status = "archived"
        await db.flush()
        return client_profile

    @staticmethod
    async def get_last_check_in(db: AsyncSession, client_id: uuid.UUID):
        result = await db.execute(
            select(func.max(Measurement.date)).where(
                Measurement.client_id == client_id
            )
        )
        return result.scalar()


client_service = ClientService()