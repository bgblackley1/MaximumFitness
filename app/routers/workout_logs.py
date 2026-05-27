# app/routers/workout_logs.py
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.workout_log import WorkoutLog, WorkoutLogSet
from app.middleware.auth import get_current_user
from app.schemas.workout_log import (
    WorkoutLogCreate,
    WorkoutLogSetCreate,
    WorkoutLogResponse,
)

router = APIRouter()


async def _get_client_profile(user: User, db: AsyncSession) -> ClientProfile:
    if user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status_code=404, detail="Client profile not found")
        return cp
    raise HTTPException(status_code=403, detail="Clients only")


# ── Start a workout session ────────────────────────────────────────────────────

@router.post(
    "/workout-logs",
    response_model=WorkoutLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_workout(
    body: WorkoutLogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cp = await _get_client_profile(user, db)
    log = WorkoutLog(
        client_id=cp.id,
        plan_day_id=body.plan_day_id,
        date=body.date,
        started_at=datetime.utcnow(),
    )
    db.add(log)
    await db.flush()
    return log


# ── Log a set ─────────────────────────────────────────────────────────────────

@router.post(
    "/workout-logs/{log_id}/sets",
    response_model=WorkoutLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_set(
    log_id: uuid.UUID,
    body: WorkoutLogSetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cp = await _get_client_profile(user, db)

    result = await db.execute(
        select(WorkoutLog).where(
            WorkoutLog.id == log_id,
            WorkoutLog.client_id == cp.id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Workout log not found")

    wls = WorkoutLogSet(
        log_id=log.id,
        plan_exercise_id=body.plan_exercise_id,
        exercise_id=body.exercise_id,
        set_number=body.set_number,
        reps_completed=body.reps_completed,
        weight_kg=body.weight_kg,
        rpe=body.rpe,
        notes=body.notes,
    )
    db.add(wls)
    await db.flush()

    # Reload with sets for response
    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.id == log_id)
        .options(selectinload(WorkoutLog.sets))
    )
    return result.scalar_one()


# ── Complete a workout ────────────────────────────────────────────────────────

@router.put("/workout-logs/{log_id}/complete", response_model=WorkoutLogResponse)
async def complete_workout(
    log_id: uuid.UUID,
    notes: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cp = await _get_client_profile(user, db)

    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.id == log_id, WorkoutLog.client_id == cp.id)
        .options(selectinload(WorkoutLog.sets))
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Workout log not found")

    log.completed_at = datetime.utcnow()
    if notes:
        log.notes = notes
    await db.flush()
    return log


# ── Get workout history for a client ─────────────────────────────────────────

@router.get("/clients/{client_id}/workout-logs", response_model=list[WorkoutLogResponse])
async def get_workout_logs(
    client_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify access
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == client_id)
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role == "pt" and cp.pt_id != user.id:
        raise HTTPException(status_code=403, detail="Not your client")
    if user.role == "client" and cp.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your data")

    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.client_id == client_id)
        .options(selectinload(WorkoutLog.sets))
        .order_by(WorkoutLog.date.desc())
    )
    return list(result.scalars().all())


# ── Get a single log ──────────────────────────────────────────────────────────

@router.get("/workout-logs/{log_id}", response_model=WorkoutLogResponse)
async def get_workout_log(
    log_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.id == log_id)
        .options(selectinload(WorkoutLog.sets))
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    # Access check
    if user.role == "client":
        cp_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = cp_result.scalar_one_or_none()
        if not cp or cp.id != log.client_id:
            raise HTTPException(status_code=403, detail="Not your log")
    return log