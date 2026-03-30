import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.goal import Goal
from app.middleware.auth import get_current_user
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse

router = APIRouter()


async def verify_client_access(client_id: uuid.UUID, user: User, db: AsyncSession):
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role == "pt" and client.pt_id != user.id:
        raise HTTPException(status_code=403, detail="Not your client")
    if user.role == "client" and client.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your data")
    return client


@router.get("/{client_id}/goals", response_model=list[GoalResponse])
async def list_goals(
    client_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)
    result = await db.execute(
        select(Goal).where(Goal.client_id == client_id).order_by(Goal.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/{client_id}/goals",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goal(
    client_id: uuid.UUID,
    body: GoalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)
    goal = Goal(
        client_id=client_id,
        type=body.type,
        description=body.description,
        target_value=body.target_value,
        target_unit=body.target_unit,
        target_date=body.target_date,
        current_value=body.current_value,
    )
    db.add(goal)
    await db.flush()
    return goal


@router.put("/{client_id}/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(
    client_id: uuid.UUID,
    goal_id: uuid.UUID,
    body: GoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.client_id == client_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(goal, key, value)
    await db.flush()
    return goal


@router.delete("/{client_id}/goals/{goal_id}")
async def delete_goal(
    client_id: uuid.UUID,
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.client_id == client_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.delete(goal)
    return {"message": "Goal deleted"}