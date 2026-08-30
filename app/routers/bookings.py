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
from app.models.payment import SessionPack           # ← NEW IMPORT
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


# ── Session pack helpers ──────────────────────────────────────────────────────

async def _deduct_session(db: AsyncSession, client_id: uuid.UUID) -> SessionPack | None:
    """
    Find the client's active session pack and deduct 1 session.
    Returns the updated pack, or None if no pack exists.
    Marks pack as 'exhausted' when sessions_remaining reaches 0.
    """
    result = await db.execute(
        select(SessionPack)
        .where(
            SessionPack.client_id == client_id,
            SessionPack.status == "active",
            SessionPack.sessions_remaining > 0,
        )
        .order_by(SessionPack.created_at.desc())
    )
    pack = result.scalar_one_or_none()

    if pack:
        pack.sessions_remaining -= 1
        if pack.sessions_remaining <= 0:
            pack.status = "exhausted"
        await db.flush()

    return pack


async def _restore_session(db: AsyncSession, client_id: uuid.UUID) -> SessionPack | None:
    """
    When a booking is cancelled, restore 1 session to the client's most
    recent non-cancelled pack.  If the pack was exhausted it becomes active
    again.  If no pack exists we do nothing (non-fatal).
    """
    result = await db.execute(
        select(SessionPack)
        .where(
            SessionPack.client_id == client_id,
            SessionPack.status.in_(["active", "exhausted"]),
        )
        .order_by(SessionPack.created_at.desc())
    )
    pack = result.scalar_one_or_none()

    if pack:
        pack.sessions_remaining += 1
        # Cap at the original total (prevents over-restore if someone
        # cancels a booking that was made before the pack system existed)
        if pack.sessions_remaining > pack.total_sessions:
            pack.sessions_remaining = pack.total_sessions
        # Re-activate if it was exhausted
        if pack.status == "exhausted":
            pack.status = "active"
        await db.flush()

    return pack


# ── Availability ──────────────────────────────────────────────────────────────

@router.get("/availability", response_model=list[AvailabilitySlotResponse])
async def list_availability(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
        select(AvailabilitySlot)
        .where(AvailabilitySlot.pt_id == pt_id)
        .order_by(
            AvailabilitySlot.is_recurring.desc(),
            AvailabilitySlot.day_of_week.asc().nullslast(),
            AvailabilitySlot.specific_date.asc().nullslast(),
            AvailabilitySlot.start_time.asc(),
        )
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
        is_blocked=body.is_blocked,
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

    slot.day_of_week   = body.day_of_week
    slot.start_time    = body.start_time
    slot.end_time      = body.end_time
    slot.is_recurring  = body.is_recurring
    slot.is_blocked    = body.is_blocked
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


# ── Available slots query ─────────────────────────────────────────────────────

@router.get("/bookings/available-slots", response_model=list[AvailableSlotResponse])
async def get_available_slots(
    target_date: date = Query(..., alias="date"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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

    day_of_week = target_date.weekday()

    result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.pt_id == pt_id,
            AvailabilitySlot.is_blocked == False,
            (
                (AvailabilitySlot.is_recurring == True)
                & (AvailabilitySlot.day_of_week == day_of_week)
            )
            | (
                (AvailabilitySlot.is_recurring == False)
                & (AvailabilitySlot.specific_date == target_date)
            ),
        ).order_by(AvailabilitySlot.start_time)
    )
    available_slots = list(result.scalars().all())

    result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.pt_id == pt_id,
            AvailabilitySlot.is_blocked == True,
            AvailabilitySlot.specific_date == target_date,
        )
    )
    blocked_overrides = list(result.scalars().all())

    result = await db.execute(
        select(Booking).where(
            Booking.pt_id == pt_id,
            Booking.date == target_date,
            Booking.status.in_(["booked", "tentative"]),
        )
    )
    existing_bookings = list(result.scalars().all())

    available: list[AvailableSlotResponse] = []
    seen_start_times: set[time] = set()

    for slot in available_slots:
        current = slot.start_time

        while current < slot.end_time:
            next_h = current.hour + 1
            if next_h > 23:
                break
            next_hour = time(next_h, current.minute)
            if next_hour > slot.end_time:
                break

            if current in seen_start_times:
                current = next_hour
                continue

            is_blocked_by_override = any(
                b.start_time <= current < b.end_time
                for b in blocked_overrides
            )
            is_already_booked = any(
                b.start_time <= current < b.end_time
                for b in existing_bookings
            )

            if not is_blocked_by_override and not is_already_booked:
                available.append(
                    AvailableSlotResponse(
                        date=target_date,
                        start_time=current,
                        end_time=next_hour,
                    )
                )
                seen_start_times.add(current)

            current = next_hour

    available.sort(key=lambda s: s.start_time)
    return available


# ── Bookings CRUD ─────────────────────────────────────────────────────────────

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
    # ── Resolve client and PT ─────────────────────────────────────────────────
    if user.role == "client":
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        client_id = client.id
        pt_id     = client.pt_id
    else:
        client_id = body.client_id
        pt_id     = user.id

    # ── Check for slot conflict ───────────────────────────────────────────────
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

    # ── Check session pack (clients only) ─────────────────────────────────────
    # PTs booking on behalf of a client still deduct from the pack.
    if client_id:
        pack_check = await db.execute(
            select(SessionPack)
            .where(
                SessionPack.client_id == client_id,
                SessionPack.status == "active",
                SessionPack.sessions_remaining > 0,
            )
            .order_by(SessionPack.created_at.desc())
        )
        active_pack = pack_check.scalar_one_or_none()

        # ── Block the booking if client has no sessions remaining ─────────────
        # Only enforce this for client-initiated bookings.
        # PTs can still book even if the pack is exhausted (they may be adding
        # a complimentary session or the pack hasn't been set up yet).
        if user.role == "client" and active_pack is None:
            # Check if there is ANY pack at all (even exhausted) to give a
            # better error message
            any_pack = (await db.execute(
                select(SessionPack)
                .where(SessionPack.client_id == client_id)
                .order_by(SessionPack.created_at.desc())
            )).scalar_one_or_none()

            if any_pack is not None:
                raise HTTPException(
                    status_code=402,
                    detail="No sessions remaining in your current plan. Please contact your trainer to purchase more.",
                )
            # If no pack exists at all, allow booking (trainer hasn't set one up yet)

    # ── Create the booking ────────────────────────────────────────────────────
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

    # ── ✅ Deduct 1 session from the active pack ───────────────────────────────
    # We do this AFTER creating the booking so that if the deduction fails
    # the booking itself is still rolled back by the DB transaction.
    if client_id:
        await _deduct_session(db, client_id)

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


@router.delete("/bookings/{booking_id}", status_code=status.HTTP_200_OK)
async def cancel_booking(
    booking_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # ── Verify ownership ──────────────────────────────────────────────────────
    if user.role == "pt" and booking.pt_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if user.role == "client":
        cp_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = cp_result.scalar_one_or_none()
        if not cp or booking.client_id != cp.id:
            raise HTTPException(status_code=403, detail="Not your booking")

    # ── Only restore the session if the booking was active (not already cancelled) ──
    was_active = booking.status in ("booked", "confirmed", "tentative")

    booking.status = "cancelled"
    await db.flush()

    # ── ✅ Restore 1 session to the pack when a booking is cancelled ───────────
    if was_active and booking.client_id:
        await _restore_session(db, booking.client_id)

    return {"message": "Booking cancelled"}