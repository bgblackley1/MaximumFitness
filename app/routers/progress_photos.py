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

# Broad set of accepted MIME types — React Native sometimes reports heic/heif
ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/heic", "image/heif",
    "application/octet-stream",  # fallback when RN can't detect type
}


def _bucket() -> str:
    """Return the configured progress-photo bucket name."""
    return settings.SUPABASE_PROGRESS_BUCKET


def _storage_base() -> str:
    return f"{settings.SUPABASE_URL}/storage/v1"


def _service_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_KEY,
    }


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


async def _get_public_url(storage_path: str) -> str | None:
    """
    Try to get a public URL first (works if bucket is set to public).
    Returns None if the bucket is private.
    """
    public_url = f"{_storage_base()}/object/public/{_bucket()}/{storage_path}"
    try:
        async with httpx.AsyncClient() as http:
            r = await http.head(public_url, timeout=5)
            if r.status_code in (200, 206):
                return public_url
    except Exception:
        pass
    return None


async def _get_signed_url(storage_path: str) -> str | None:
    """
    Generate a signed URL for private bucket access.
    Returns None if generation fails.
    """
    try:
        async with httpx.AsyncClient() as http:
            r = await http.post(
                f"{_storage_base()}/object/sign/{_bucket()}/{storage_path}",
                headers={**_service_headers(), "Content-Type": "application/json"},
                json={"expiresIn": 3600},
                timeout=10,
            )
            if r.status_code == 200:
                data = r.json()
                # Supabase returns either 'signedURL' or 'signedUrl'
                signed = data.get("signedURL") or data.get("signedUrl") or ""
                if signed:
                    # signed is like /object/sign/bucket/path?token=...
                    return f"{settings.SUPABASE_URL}/storage/v1{signed}"
            logger.warning(
                "Signed URL generation failed: status=%s body=%s",
                r.status_code, r.text[:500],
            )
    except Exception as exc:
        logger.warning("Signed URL generation exception: %s", exc)
    return None


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

    # ── Content-type check ────────────────────────────────────────────────────
    # React Native Web sometimes sends application/octet-stream; accept it.
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{content_type}' not allowed. Use JPEG or PNG.",
        )

    # ── Determine extension ───────────────────────────────────────────────────
    original_name = file.filename or ""
    if original_name.lower().endswith(".png") or content_type == "image/png":
        ext = "png"
        mime = "image/png"
    else:
        ext = "jpg"
        mime = "image/jpeg"

    # ── Build storage path ────────────────────────────────────────────────────
    today         = date.today().isoformat()
    file_id       = uuid.uuid4()
    storage_path  = f"{client_id}/{today}_{file_id}.{ext}"
    bucket        = _bucket()

    # ── Read file bytes ───────────────────────────────────────────────────────
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    logger.info(
        "Uploading photo: bucket=%s path=%s size=%d mime=%s",
        bucket, storage_path, len(file_bytes), mime,
    )

    # ── Upload to Supabase Storage ────────────────────────────────────────────
    upload_url = f"{_storage_base()}/object/{bucket}/{storage_path}"
    async with httpx.AsyncClient(timeout=30) as http:
        upload_resp = await http.post(
            upload_url,
            headers={
                **_service_headers(),
                "Content-Type": mime,
                "x-upsert": "true",          # allow overwrite if same name
                "Cache-Control": "3600",
            },
            content=file_bytes,
        )

    if upload_resp.status_code not in (200, 201):
        # Log the ACTUAL Supabase error so you can see what's wrong
        logger.error(
            "Supabase Storage upload FAILED: status=%s bucket=%s path=%s\n"
            "Response body: %s",
            upload_resp.status_code, bucket, storage_path, upload_resp.text[:1000],
        )
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to upload to Supabase Storage "
                f"(bucket='{bucket}', status={upload_resp.status_code}). "
                f"Check that the bucket exists and the service key has INSERT permission. "
                f"Supabase error: {upload_resp.text[:200]}"
            ),
        )

    logger.info("Supabase upload succeeded: path=%s", storage_path)

    # ── Persist to DB ─────────────────────────────────────────────────────────
    photo = ProgressPhoto(
        client_id=client_id,
        date=date.today(),
        # Store only the relative path; full URL is resolved on each fetch
        file_url=storage_path,
    )
    db.add(photo)
    await db.flush()
    return photo


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

    # Resolve full URLs — try public first, fall back to signed URL
    for photo in photos:
        raw_path = photo.file_url

        # Skip if already a full https URL (from older records)
        if raw_path.startswith("http"):
            continue

        # Try public URL first (instant, no expiry)
        public = await _get_public_url(raw_path)
        if public:
            photo.file_url = public
            continue

        # Fall back to signed URL (works for private buckets)
        signed = await _get_signed_url(raw_path)
        if signed:
            photo.file_url = signed
        else:
            # Last resort: build the direct object URL (may need auth)
            photo.file_url = (
                f"{_storage_base()}/object/authenticated/{_bucket()}/{raw_path}"
            )

    return photos


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
            ProgressPhoto.id == photo_id, ProgressPhoto.client_id == client_id
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    raw_path = photo.file_url
    # Only try to delete from Storage if we have a path (not a full URL yet)
    if not raw_path.startswith("http"):
        try:
            async with httpx.AsyncClient(timeout=10) as http:
                await http.delete(
                    f"{_storage_base()}/object/{_bucket()}/{raw_path}",
                    headers=_service_headers(),
                )
        except Exception as exc:
            logger.warning("Storage delete failed (non-fatal): %s", exc)

    await db.delete(photo)
    return {"message": "Photo deleted"}