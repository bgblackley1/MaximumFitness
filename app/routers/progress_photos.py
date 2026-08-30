import uuid
import logging
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
from app.config import settings
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/heic", "image/heif",
    "application/octet-stream",
}


def _bucket() -> str:
    return settings.SUPABASE_PROGRESS_BUCKET


def _storage_base() -> str:
    return f"{settings.SUPABASE_URL}/storage/v1"


def _svc_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_KEY,
    }


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


async def resolve_storage_url(storage_path: str) -> str:
    """
    Converts a relative storage path to a fully accessible URL.

    Priority:
      1. Already a full URL → return as-is.
      2. Public URL (if bucket is public).
      3. Signed URL (works for private bucket — no auth header needed).
      4. Authenticated URL (last resort; won't display in <Image> without headers).

    IMPORTANT: We NEVER mutate the ORM object here. We only resolve URLs
    for the HTTP response. Relative paths stay in the DB permanently so we
    always generate fresh signed URLs and they never expire from the DB.
    """
    if storage_path.startswith("http"):
        return storage_path

    # ── 1. Try public URL ──────────────────────────────────────────────────────
    public_url = f"{_storage_base()}/object/public/{_bucket()}/{storage_path}"
    try:
        async with httpx.AsyncClient(timeout=5) as http:
            r = await http.head(public_url)
            if r.status_code in (200, 206):
                return public_url
    except Exception:
        pass

    # ── 2. Generate signed URL ─────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.post(
                f"{_storage_base()}/object/sign/{_bucket()}/{storage_path}",
                headers={**_svc_headers(), "Content-Type": "application/json"},
                json={"expiresIn": 3600},
            )
        if r.status_code == 200:
            data = r.json()
            # Supabase may return 'signedURL', 'signedUrl', or a full https URL
            signed: str = (
                data.get("signedURL")
                or data.get("signedUrl")
                or data.get("signed_url")
                or ""
            )
            if signed:
                if signed.startswith("http"):
                    # Already full URL
                    return signed
                elif signed.startswith("/storage/v1"):
                    # Has the /storage/v1 prefix already
                    return f"{settings.SUPABASE_URL}{signed}"
                else:
                    # Typical case: starts with /object/sign/...
                    return f"{settings.SUPABASE_URL}/storage/v1{signed}"
        else:
            logger.error(
                "Signed URL failed — status=%s bucket=%s path=%s body=%s",
                r.status_code, _bucket(), storage_path, r.text[:500],
            )
    except Exception as exc:
        logger.error("Signed URL exception: %s", exc)

    # ── 3. Last resort — authenticated URL ────────────────────────────────────
    # This will NOT display in a React Native <Image> component without
    # custom headers, but at least we return something valid.
    logger.warning("Falling back to authenticated URL for: %s", storage_path)
    return f"{_storage_base()}/object/authenticated/{_bucket()}/{storage_path}"


# ── Upload ────────────────────────────────────────────────────────────────────

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

    content_type = (file.content_type or "").lower() or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{content_type}' not allowed. Use JPEG or PNG.",
        )

    filename   = file.filename or ""
    is_png     = filename.lower().endswith(".png") or "png" in content_type
    ext, mime  = ("png", "image/png") if is_png else ("jpg", "image/jpeg")
    storage_path = f"{client_id}/{date.today().isoformat()}_{uuid.uuid4()}.{ext}"

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    logger.info(
        "Uploading photo → bucket=%s path=%s size=%d mime=%s",
        _bucket(), storage_path, len(file_bytes), mime,
    )

    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(
            f"{_storage_base()}/object/{_bucket()}/{storage_path}",
            headers={
                **_svc_headers(),
                "Content-Type": mime,
                "x-upsert": "true",
                "Cache-Control": "3600",
            },
            content=file_bytes,
        )

    if resp.status_code not in (200, 201):
        logger.error(
            "Supabase upload FAILED — status=%s bucket=%s\nResponse: %s",
            resp.status_code, _bucket(), resp.text[:1000],
        )
        raise HTTPException(
            status_code=500,
            detail=(
                f"Storage upload failed (bucket='{_bucket()}', "
                f"http_status={resp.status_code}). "
                f"Supabase said: {resp.text[:200]}"
            ),
        )

    logger.info("Upload succeeded → %s", storage_path)

    # Persist relative path to DB (relative paths never expire)
    photo = ProgressPhoto(
        client_id=client_id,
        date=date.today(),
        file_url=storage_path,
    )
    db.add(photo)
    await db.flush()

    # ── KEY FIX: Resolve to a full URL for the response ────────────────────────
    # Without this the frontend receives a relative path which can't render.
    resolved_url = await resolve_storage_url(storage_path)

    return ProgressPhotoResponse(
        id=photo.id,
        client_id=photo.client_id,
        date=photo.date,
        file_url=resolved_url,
        notes=photo.notes,
        created_at=photo.created_at,
    )


# ── List ──────────────────────────────────────────────────────────────────────

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

    # ── KEY FIX: Build responses WITHOUT mutating ORM objects ─────────────────
    # Mutating ORM objects (photo.file_url = ...) causes SQLAlchemy to commit
    # the signed URL back to the DB. Signed URLs expire after 3600 s, after
    # which all stored photos show grey forever. Keep relative paths in the DB.
    responses: list[ProgressPhotoResponse] = []
    for photo in photos:
        resolved = await resolve_storage_url(photo.file_url)
        responses.append(ProgressPhotoResponse(
            id=photo.id,
            client_id=photo.client_id,
            date=photo.date,
            file_url=resolved,
            notes=photo.notes,
            created_at=photo.created_at,
        ))

    return responses


# ── Delete ────────────────────────────────────────────────────────────────────

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
            ProgressPhoto.id == photo_id,
            ProgressPhoto.client_id == client_id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Recover the raw relative path (in case a full URL was somehow stored)
    raw_path = photo.file_url
    if raw_path.startswith("http"):
        for prefix in [
            f"/object/public/{_bucket()}/",
            f"/object/authenticated/{_bucket()}/",
            f"/object/sign/{_bucket()}/",
        ]:
            if prefix in raw_path:
                raw_path = raw_path.split(prefix)[-1].split("?")[0]
                break

    # Delete from Supabase Storage (non-fatal if it fails)
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            del_resp = await http.delete(
                f"{_storage_base()}/object/{_bucket()}/{raw_path}",
                headers=_svc_headers(),
            )
            if del_resp.status_code not in (200, 204):
                logger.warning(
                    "Storage delete non-success: %s %s",
                    del_resp.status_code, del_resp.text[:200],
                )
    except Exception as exc:
        logger.warning("Storage delete failed (non-fatal): %s", exc)

    await db.delete(photo)
    return {"message": "Photo deleted"}