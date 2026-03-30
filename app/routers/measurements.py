import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.measurement import Measurement
from app.models.client import ClientProfile
from app.middleware.auth import get_current_user
from app.schemas.measurement import MeasurementCreate, MeasurementUpdate, MeasurementResponse

router = APIRouter()


async def verify_client_access(
    client_id: uuid.UUID, user: User, db: AsyncSession
) -> ClientProfile:
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


@router.get("/{client_id}/measurements", response_model=list[MeasurementResponse])
async def list_measurements(
    client_id: uuid.UUID,
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)

    query = (
        select(Measurement)
        .where(Measurement.client_id == client_id)
        .order_by(Measurement.date.desc())
    )
    if from_date:
        query = query.where(Measurement.date >= from_date)
    if to_date:
        query = query.where(Measurement.date <= to_date)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/{client_id}/measurements",
    response_model=MeasurementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_measurement(
    client_id: uuid.UUID,
    body: MeasurementCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)

    measurement = Measurement(
        client_id=client_id,
        date=body.date,
        weight_kg=body.weight_kg,
        chest_cm=body.chest_cm,
        waist_cm=body.waist_cm,
        left_arm_cm=body.left_arm_cm,
        right_arm_cm=body.right_arm_cm,
        thigh_cm=body.thigh_cm,
        hips_cm=body.hips_cm,
        notes=body.notes,
        recorded_by=user.id,
    )
    db.add(measurement)
    await db.flush()
    return measurement


@router.put(
    "/{client_id}/measurements/{measurement_id}",
    response_model=MeasurementResponse,
)
async def update_measurement(
    client_id: uuid.UUID,
    measurement_id: uuid.UUID,
    body: MeasurementUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)

    result = await db.execute(
        select(Measurement).where(
            Measurement.id == measurement_id, Measurement.client_id == client_id
        )
    )
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(measurement, key, value)
    await db.flush()
    return measurement


@router.delete("/{client_id}/measurements/{measurement_id}")
async def delete_measurement(
    client_id: uuid.UUID,
    measurement_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)
    if user.role != "pt":
        raise HTTPException(status_code=403, detail="PT only")

    result = await db.execute(
        select(Measurement).where(
            Measurement.id == measurement_id, Measurement.client_id == client_id
        )
    )
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")

    await db.delete(measurement)
    return {"message": "Measurement deleted"}