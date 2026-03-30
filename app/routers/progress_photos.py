import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.client import ClientProfile
from app.models.progress_photo import ProgressPhoto
from app.middleware.auth import get_current_user
from app.schemas.progress_photo import ProgressPhotoResponse
from app.services.supabase_service import supabase_admin
from app.config import settings
import httpx

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png"}


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


@router.post(
    "/{client_id}/photos",
    response_model=ProgressPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_photo(
    client_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG allowed")

    today = date.today().isoformat()
    file_id = uuid.uuid4()
    ext = "jpg" if file.content_type == "image/jpeg" else "png"
    storage_path = f"{client_id}/{today}_{file_id}.{ext}"

    file_bytes = await file.read()

    # Upload to Supabase Storage
    async with httpx.AsyncClient() as client_http:
        response = await client_http.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/progress-photos/{storage_path}",
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": file.content_type,
            },
            content=file_bytes,
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail="Failed to upload file")

    photo = ProgressPhoto(
        client_id=client_id,
        date=date.today(),
        file_url=storage_path,
    )
    db.add(photo)
    await db.flush()
    return photo


@router.get("/{client_id}/photos", response_model=list[ProgressPhotoResponse])
async def list_photos(
    client_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)

    result = await db.execute(
        select(ProgressPhoto)
        .where(ProgressPhoto.client_id == client_id)
        .order_by(ProgressPhoto.date.desc())
    )
    photos = list(result.scalars().all())

    # Generate signed URLs
    for photo in photos:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.post(
                f"{settings.SUPABASE_URL}/storage/v1/object/sign/progress-photos/{photo.file_url}",
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                },
                json={"expiresIn": 3600},
            )
            if response.status_code == 200:
                data = response.json()
                photo.file_url = f"{settings.SUPABASE_URL}/storage/v1{data.get('signedURL', '')}"

    return photos


@router.delete("/{client_id}/photos/{photo_id}")
async def delete_photo(
    client_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_client_access(client_id, user, db)

    result = await db.execute(
        select(ProgressPhoto).where(
            ProgressPhoto.id == photo_id, ProgressPhoto.client_id == client_id
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Delete from Supabase Storage
    async with httpx.AsyncClient() as client_http:
        await client_http.delete(
            f"{settings.SUPABASE_URL}/storage/v1/object/progress-photos/{photo.file_url}",
            headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"},
        )

    await db.delete(photo)
    return {"message": "Photo deleted"}