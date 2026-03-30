from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.booking import Booking
from app.models.measurement import Measurement
from app.models.payment import Subscription
from app.middleware.auth import get_current_pt

router = APIRouter()


@router.get("")
async def get_dashboard(
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()

    # Today's bookings
    result = await db.execute(
        select(Booking)
        .where(Booking.pt_id == pt.id, Booking.date == today)
        .options(selectinload(Booking.client).selectinload(ClientProfile.user))
        .order_by(Booking.start_time)
    )
    todays_bookings = result.scalars().all()

    # Active client count
    result = await db.execute(
        select(func.count(ClientProfile.id)).where(
            ClientProfile.pt_id == pt.id, ClientProfile.status == "active"
        )
    )
    active_client_count = result.scalar() or 0

    # Sessions this week
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    result = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.pt_id == pt.id,
            Booking.date >= week_start,
            Booking.date <= week_end,
            Booking.status.in_(["booked", "completed"]),
        )
    )
    sessions_this_week = result.scalar() or 0

    # At risk clients (no measurement in 14+ days)
    cutoff = today - timedelta(days=14)
    result = await db.execute(
        select(ClientProfile)
        .where(ClientProfile.pt_id == pt.id, ClientProfile.status == "active")
        .options(selectinload(ClientProfile.user))
    )
    all_clients = result.scalars().all()

    at_risk = []
    for client in all_clients:
        result = await db.execute(
            select(func.max(Measurement.date)).where(
                Measurement.client_id == client.id
            )
        )
        last_measurement = result.scalar()
        if last_measurement is None or last_measurement < cutoff:
            at_risk.append({
                "client_id": str(client.id),
                "client_name": client.user.name,
                "reason": "No measurements in 14+ days",
                "last_measurement": str(last_measurement) if last_measurement else None,
            })

    # Failed payments
    result = await db.execute(
        select(Subscription)
        .join(ClientProfile)
        .where(
            ClientProfile.pt_id == pt.id,
            Subscription.status == "past_due",
        )
        .options(selectinload(Subscription.client).selectinload(ClientProfile.user))
    )
    failed_subs = result.scalars().all()
    for sub in failed_subs:
        at_risk.append({
            "client_id": str(sub.client_id),
            "client_name": sub.client.user.name,
            "reason": "Payment past due",
        })

    return {
        "today": str(today),
        "todays_bookings": [
            {
                "id": str(b.id),
                "start_time": str(b.start_time),
                "end_time": str(b.end_time),
                "client_name": b.client.user.name if b.client else "Unknown",
                "type": b.type,
                "status": b.status,
            }
            for b in todays_bookings
        ],
        "stats": {
            "active_clients": active_client_count,
            "sessions_this_week": sessions_this_week,
        },
        "at_risk": at_risk,
    }