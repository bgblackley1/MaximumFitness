import uuid
from datetime import date, time, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.booking import AvailabilitySlot, Booking
from app.middleware.auth import get_current_user, get_current_pt
from app.schemas.booking import (
    AvailabilitySlotCreate,
    AvailabilitySlotResponse,
    BookingCreate,
    BookingUpdate,
    BookingResponse,
    AvailableSlotResponse,
)

router = APIRouter()


# ── Availability ──

@router.get("/availability", response_model=list[AvailabilitySlotResponse])
async def list_availability(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Any authenticated user can see PT availability
    # For now get the PT's availability. If user is client, find their PT.
    if user.role == "pt":
        pt_id = user.id
    else:
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        pt_id = client.pt_id

    result = await db.execute(
        select(AvailabilitySlot).where(AvailabilitySlot.pt_id == pt_id)
    )
    return list(result.scalars().all())


@router.post(
    "/availability",
    response_model=AvailabilitySlotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_availability(
    body: AvailabilitySlotCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    slot = AvailabilitySlot(
        pt_id=pt.id,
        day_of_week=body.day_of_week,
        start_time=body.start_time,
        end_time=body.end_time,
        is_recurring=body.is_recurring,
        specific_date=body.specific_date,
    )
    db.add(slot)
    await db.flush()
    return slot


@router.put("/availability/{slot_id}", response_model=AvailabilitySlotResponse)
async def update_availability(
    slot_id: uuid.UUID,
    body: AvailabilitySlotCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.id == slot_id, AvailabilitySlot.pt_id == pt.id
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    slot.day_of_week = body.day_of_week
    slot.start_time = body.start_time
    slot.end_time = body.end_time
    slot.is_recurring = body.is_recurring
    slot.specific_date = body.specific_date
    await db.flush()
    return slot


@router.delete("/availability/{slot_id}")
async def delete_availability(
    slot_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.id == slot_id, AvailabilitySlot.pt_id == pt.id
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    await db.delete(slot)
    return {"message": "Slot deleted"}


# ── Available slots query ──

@router.get("/bookings/available-slots", response_model=list[AvailableSlotResponse])
async def get_available_slots(
    target_date: date = Query(..., alias="date"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find the PT
    if user.role == "pt":
        pt_id = user.id
    else:
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        pt_id = client.pt_id

    day_of_week = target_date.weekday()  # 0=Monday

    # Get availability for this day
    result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.pt_id == pt_id,
            (
                (AvailabilitySlot.is_recurring == True)
                & (AvailabilitySlot.day_of_week == day_of_week)
            )
            | (
                (AvailabilitySlot.is_recurring == False)
                & (AvailabilitySlot.specific_date == target_date)
            ),
        )
    )
    slots = list(result.scalars().all())

    # Get existing bookings for this date
    result = await db.execute(
        select(Booking).where(
            Booking.pt_id == pt_id,
            Booking.date == target_date,
            Booking.status.in_(["booked", "tentative"]),
        )
    )
    existing_bookings = list(result.scalars().all())

    # Build available 1-hour slots
    available = []
    for slot in slots:
        current = slot.start_time
        while current < slot.end_time:
            next_hour = time(current.hour + 1, current.minute)
            if next_hour > slot.end_time:
                break

            # Check if this slot is already booked
            is_booked = any(
                b.start_time <= current and b.end_time > current
                for b in existing_bookings
            )
            if not is_booked:
                available.append(
                    AvailableSlotResponse(
                        date=target_date,
                        start_time=current,
                        end_time=next_hour,
                    )
                )
            current = next_hour

    return available


# ── Bookings CRUD ──

@router.get("/bookings", response_model=list[BookingResponse])
async def list_bookings(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    booking_status: str | None = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        query = select(Booking).where(Booking.pt_id == user.id)
    else:
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        query = select(Booking).where(Booking.client_id == client.id)

    if from_date:
        query = query.where(Booking.date >= from_date)
    if to_date:
        query = query.where(Booking.date <= to_date)
    if booking_status:
        query = query.where(Booking.status == booking_status)

    query = query.options(
        selectinload(Booking.client).selectinload(ClientProfile.user)
    ).order_by(Booking.date, Booking.start_time)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    body: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get client profile
    if user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        client_id = client.id
        pt_id = client.pt_id
    else:
        client_id = body.client_id
        pt_id = user.id

    # Check for conflicts
    result = await db.execute(
        select(Booking).where(
            Booking.pt_id == pt_id,
            Booking.date == body.date,
            Booking.start_time == body.start_time,
            Booking.status.in_(["booked", "tentative"]),
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slot already booked")

    booking = Booking(
        client_id=client_id,
        pt_id=pt_id,
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        type=body.type,
        location=body.location,
        notes=body.notes,
    )
    db.add(booking)
    await db.flush()
    return booking


@router.put("/bookings/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: uuid.UUID,
    body: BookingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(booking, key, value)
    await db.flush()
    return booking


@router.get("/bookings/today", response_model=list[BookingResponse])
async def today_bookings(
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    result = await db.execute(
        select(Booking)
        .where(Booking.pt_id == pt.id, Booking.date == today)
        .options(selectinload(Booking.client).selectinload(ClientProfile.user))
        .order_by(Booking.start_time)
    )
    return list(result.scalars().all())