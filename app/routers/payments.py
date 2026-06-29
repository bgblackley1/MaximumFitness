import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.payment import SessionPack, Invoice
from app.middleware.auth import get_current_user, get_current_pt
from app.schemas.payment import (
    SessionPackCreate,
    SessionPackAdjust,
    SessionPackResponse,
    InvoiceCreate,
    InvoiceResponse,
)

router = APIRouter()


# ── Session Packs ────────────────────────────────────────────────────────────

@router.get("/session-packs", response_model=list[SessionPackResponse])
async def list_session_packs(
    client_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        query = select(SessionPack).where(SessionPack.pt_id == user.id)
        if client_id:
            query = query.where(SessionPack.client_id == client_id)
    else:
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status_code=404, detail="Client profile not found")
        query = select(SessionPack).where(SessionPack.client_id == cp.id)

    query = query.order_by(SessionPack.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/session-packs",
    response_model=SessionPackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session_pack(
    body: SessionPackCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    # Verify client belongs to this PT
    result = await db.execute(
        select(ClientProfile).where(
            ClientProfile.id == body.client_id,
            ClientProfile.pt_id == pt.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    pack = SessionPack(
        client_id=body.client_id,
        pt_id=pt.id,
        pack_name=body.pack_name,
        total_sessions=body.total_sessions,
        sessions_remaining=body.total_sessions,
        price_paid_pence=body.price_paid_pence,
        currency=body.currency,
        notes=body.notes,
        expires_at=body.expires_at,
        purchased_at=datetime.utcnow(),
    )
    db.add(pack)

    # Auto-create an invoice
    invoice = Invoice(
        client_id=body.client_id,
        description=f"{body.pack_name} ({body.total_sessions} sessions)",
        amount_pence=body.price_paid_pence,
        currency=body.currency,
        status="paid",
        date=datetime.utcnow(),
    )
    db.add(invoice)
    await db.flush()

    # Link invoice to pack
    invoice.pack_id = pack.id
    await db.flush()

    return pack


@router.put("/session-packs/{pack_id}/adjust", response_model=SessionPackResponse)
async def adjust_sessions(
    pack_id: uuid.UUID,
    body: SessionPackAdjust,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    """Manually add or deduct sessions from a pack (e.g. mark session as used)."""
    result = await db.execute(
        select(SessionPack).where(
            SessionPack.id == pack_id,
            SessionPack.pt_id == pt.id,
        )
    )
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(status_code=404, detail="Session pack not found")

    new_remaining = pack.sessions_remaining + body.adjustment
    if new_remaining < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deduct {abs(body.adjustment)} — only {pack.sessions_remaining} remaining",
        )

    pack.sessions_remaining = new_remaining

    if new_remaining == 0:
        pack.status = "exhausted"
    elif pack.status == "exhausted" and new_remaining > 0:
        pack.status = "active"

    await db.flush()
    return pack


@router.delete("/session-packs/{pack_id}")
async def cancel_session_pack(
    pack_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessionPack).where(
            SessionPack.id == pack_id,
            SessionPack.pt_id == pt.id,
        )
    )
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(status_code=404, detail="Session pack not found")
    pack.status = "cancelled"
    await db.flush()
    return {"message": "Pack cancelled"}


# ── Invoices ─────────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    client_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        query = (
            select(Invoice)
            .join(ClientProfile, ClientProfile.id == Invoice.client_id)
            .where(ClientProfile.pt_id == user.id)
        )
        if client_id:
            query = query.where(Invoice.client_id == client_id)
    else:
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status_code=404, detail="Client profile not found")
        query = select(Invoice).where(Invoice.client_id == cp.id)

    query = query.order_by(Invoice.date.desc())
    result = await db.execute(query)
    return list(result.scalars().all())