# app/routers/clients.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.middleware.auth import get_current_pt, get_current_client, get_current_user
from app.services.client_service import client_service
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter()


@router.get("/me", response_model=ClientResponse)
async def get_my_client_profile(
    user: User = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClientProfile)
        .where(ClientProfile.user_id == user.id)
        .options(selectinload(ClientProfile.user))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client profile not found")
    last_check_in = await client_service.get_last_check_in(db, client.id)
    return ClientResponse(
        id=client.id, user_id=client.user_id, pt_id=client.pt_id,
        name=client.user.name, email=client.user.email, phone=client.user.phone,
        age=client.age, sex=client.sex, height_cm=client.height_cm,
        starting_weight_kg=client.starting_weight_kg,
        goals=client.goals, injuries=client.injuries, notes=client.notes,
        status=client.status, plan_type=client.plan_type,
        created_at=client.created_at, last_check_in=last_check_in,
    )


@router.get("", response_model=list[ClientResponse])
async def list_clients(
    search: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    goal: str | None = Query(None),
    injury: str | None = Query(None),
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    clients = await client_service.get_clients(
        db, pt_id=pt.id, search=search, status=status_filter, goal=goal, injury=injury
    )
    results = []
    for c in clients:
        last_check_in = await client_service.get_last_check_in(db, c.id)
        results.append(ClientResponse(
            id=c.id, user_id=c.user_id, pt_id=c.pt_id,
            name=c.user.name, email=c.user.email, phone=c.user.phone,
            age=c.age, sex=c.sex, height_cm=c.height_cm,
            starting_weight_kg=c.starting_weight_kg,
            goals=c.goals, injuries=c.injuries, notes=c.notes,
            status=c.status, plan_type=c.plan_type,
            created_at=c.created_at, last_check_in=last_check_in,
        ))
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    client_profile, temp_password = await client_service.create_client(
        db, pt_id=pt.id,
        name=body.name, email=body.email, phone=body.phone,
        age=body.age, sex=body.sex,
        height_cm=body.height_cm, starting_weight_kg=body.starting_weight_kg,
        goals=body.goals, injuries=body.injuries, notes=body.notes,
    )
    return {
        "id": str(client_profile.id),
        "user_id": str(client_profile.user_id),
        "pt_id": str(client_profile.pt_id),
        "name": body.name, "email": body.email,
        "status": client_profile.status,
        "created_at": client_profile.created_at.isoformat(),
        "temp_password": temp_password,
        "message": f"Client created. Share these login details: email={body.email}, password={temp_password}",
    }


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    client = await client_service.get_client_by_id(db, client_id, pt.id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    last_check_in = await client_service.get_last_check_in(db, client.id)
    return ClientResponse(
        id=client.id, user_id=client.user_id, pt_id=client.pt_id,
        name=client.user.name, email=client.user.email, phone=client.user.phone,
        age=client.age, sex=client.sex, height_cm=client.height_cm,
        starting_weight_kg=client.starting_weight_kg,
        goals=client.goals, injuries=client.injuries, notes=client.notes,
        status=client.status, plan_type=client.plan_type,
        created_at=client.created_at, last_check_in=last_check_in,
    )


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    client = await client_service.get_client_by_id(db, client_id, pt.id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = body.model_dump(exclude_unset=True)

    # ── Update User model fields (name, phone) ────────────────────────────────
    # get_client_by_id loads the user via selectinload so client.user is available
    if ('name' in update_data or 'phone' in update_data) and client.user:
        if 'name' in update_data and update_data['name']:
            client.user.name  = update_data.pop('name')
        else:
            update_data.pop('name', None)
        if 'phone' in update_data:
            client.user.phone = update_data.pop('phone')
        await db.flush()
    else:
        update_data.pop('name',  None)
        update_data.pop('phone', None)

    # ── Update ClientProfile fields ───────────────────────────────────────────
    updated = await client_service.update_client(db, client, **update_data)
    last_check_in = await client_service.get_last_check_in(db, updated.id)

    return ClientResponse(
        id=updated.id, user_id=updated.user_id, pt_id=updated.pt_id,
        name=updated.user.name   if updated.user else '',
        email=updated.user.email if updated.user else '',
        phone=updated.user.phone if updated.user else None,
        age=updated.age, sex=updated.sex, height_cm=updated.height_cm,
        starting_weight_kg=updated.starting_weight_kg,
        goals=updated.goals, injuries=updated.injuries, notes=updated.notes,
        status=updated.status, plan_type=updated.plan_type,
        created_at=updated.created_at, last_check_in=last_check_in,
    )


@router.delete("/{client_id}", status_code=status.HTTP_200_OK)
async def archive_client(
    client_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    client = await client_service.get_client_by_id(db, client_id, pt.id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await client_service.archive_client(db, client)
    return {"message": "Client archived"}