import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.exercise import Exercise
from app.middleware.auth import get_current_pt
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, ExerciseResponse

router = APIRouter()


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    search: str | None = Query(None),
    muscle_group: str | None = Query(None),
    equipment: str | None = Query(None),
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    query = select(Exercise).where(
        Exercise.pt_id == pt.id, Exercise.is_deleted == False
    )
    if search:
        query = query.where(Exercise.name.ilike(f"%{search}%"))
    if muscle_group:
        query = query.where(Exercise.muscle_group == muscle_group)
    if equipment:
        query = query.where(Exercise.equipment == equipment)

    query = query.order_by(Exercise.name)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    body: ExerciseCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    exercise = Exercise(
        pt_id=pt.id,
        name=body.name,
        category=body.category,
        muscle_group=body.muscle_group,
        equipment=body.equipment,
        cues=body.cues,
        image_url=body.image_url,
        video_url=body.video_url,
    )
    db.add(exercise)
    await db.flush()
    return exercise


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id, Exercise.pt_id == pt.id
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: uuid.UUID,
    body: ExerciseUpdate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id, Exercise.pt_id == pt.id
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(exercise, key, value)
    await db.flush()
    return exercise


@router.delete("/{exercise_id}")
async def delete_exercise(
    exercise_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id, Exercise.pt_id == pt.id
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    # Soft delete to preserve references in existing plans
    exercise.is_deleted = True
    await db.flush()
    return {"message": "Exercise deleted"}