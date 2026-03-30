import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.payment import Subscription, Invoice
from app.middleware.auth import get_current_user, get_current_pt
from app.services.stripe_service import stripe_service
from app.schemas.payment import (
    CreateCustomerRequest,
    CreateSubscriptionRequest,
    SubscriptionResponse,
    InvoiceResponse,
    SubscriptionUpdate,
)

router = APIRouter()


@router.post("/create-customer")
async def create_customer(
    body: CreateCustomerRequest,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClientProfile)
        .where(ClientProfile.id == body.client_id, ClientProfile.pt_id == pt.id)
        .options(selectinload(ClientProfile.user))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    customer = await stripe_service.create_customer(
        email=client.user.email, name=client.user.name
    )
    return {"stripe_customer_id": customer.id}


@router.post("/create-subscription")
async def create_subscription(
    body: CreateSubscriptionRequest,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    stripe_sub = await stripe_service.create_subscription(
        customer_id=body.stripe_customer_id,
        price_id=body.stripe_price_id,
    )

    subscription = Subscription(
        client_id=body.client_id,
        stripe_subscription_id=stripe_sub.id,
        stripe_customer_id=body.stripe_customer_id,
        plan_name=body.plan_name,
        amount_pence=body.amount_pence,
        currency=body.currency or "gbp",
        billing_cycle=body.billing_cycle,
        status="active",
    )
    db.add(subscription)
    await db.flush()
    return {"subscription_id": str(subscription.id), "stripe_subscription_id": stripe_sub.id}


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        result = await db.execute(
            select(Subscription)
            .join(ClientProfile)
            .where(ClientProfile.pt_id == user.id)
            .options(selectinload(Subscription.client).selectinload(ClientProfile.user))
        )
    else:
        result = await db.execute(
            select(Subscription)
            .join(ClientProfile)
            .where(ClientProfile.user_id == user.id)
        )
    return list(result.scalars().all())


@router.put("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: uuid.UUID,
    body: SubscriptionUpdate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if body.action == "cancel" and sub.stripe_subscription_id:
        await stripe_service.cancel_subscription(sub.stripe_subscription_id)
        sub.status = "cancelled"
    elif body.action == "pause" and sub.stripe_subscription_id:
        await stripe_service.pause_subscription(sub.stripe_subscription_id)
        sub.status = "paused"
    elif body.action == "resume" and sub.stripe_subscription_id:
        await stripe_service.resume_subscription(sub.stripe_subscription_id)
        sub.status = "active"

    await db.flush()
    return sub


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    client_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        query = select(Invoice).join(ClientProfile).where(ClientProfile.pt_id == user.id)
        if client_id:
            query = query.where(Invoice.client_id == client_id)
    else:
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        query = select(Invoice).where(Invoice.client_id == client.id)

    query = query.order_by(Invoice.date.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/setup-intent")
async def create_setup_intent(
    stripe_customer_id: str,
    user: User = Depends(get_current_user),
):
    intent = await stripe_service.create_setup_intent(stripe_customer_id)
    return {"client_secret": intent.client_secret}


# ── Stripe webhook (NO auth middleware) ──

@router.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe_service.construct_webhook_event(payload, sig_header)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "invoice.paid":
        result = await db.execute(
            select(Invoice).where(Invoice.stripe_invoice_id == data["id"])
        )
        invoice = result.scalar_one_or_none()
        if invoice:
            invoice.status = "paid"

    elif event_type == "invoice.payment_failed":
        result = await db.execute(
            select(Invoice).where(Invoice.stripe_invoice_id == data["id"])
        )
        invoice = result.scalar_one_or_none()
        if invoice:
            invoice.status = "failed"
        # Also update subscription to past_due
        sub_id = data.get("subscription")
        if sub_id:
            result = await db.execute(
                select(Subscription).where(
                    Subscription.stripe_subscription_id == sub_id
                )
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = "past_due"

    elif event_type in (
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == data["id"]
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            stripe_status = data.get("status", "")
            status_map = {
                "active": "active",
                "past_due": "past_due",
                "canceled": "cancelled",
                "unpaid": "past_due",
            }
            sub.status = status_map.get(stripe_status, sub.status)

    await db.commit()
    return {"status": "ok"}