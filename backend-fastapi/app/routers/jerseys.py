from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Form, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional
import math
import re
import uuid

def escape_like(s: str) -> str:
    """Escape SQL LIKE special characters."""
    return re.sub(r"([%_\\])", r"\\\1", s)

from app.db import get_db
from app.models.jersey import Jersey
from app.models.order import OrderItem
from app.schemas.jersey import JerseyFilterParams, PresignedUploadRequest
from app.schemas.common import PaginatedResponse, ApiResponse, PaginationMeta
from app.dependencies.auth import get_admin_user
from app.exceptions import ApiException
from app.config import settings
from app.services.r2_service import (
    upload_file_to_r2,
    delete_file_from_r2,
    upload_preview_image_to_r2,
    delete_preview_image_from_r2,
    copy_r2_object,
    ALLOWED_IMAGE_TYPES,
    get_public_preview_url,
    generate_presigned_upload_url,
)

router = APIRouter()

# --- File validation ---

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB
MAX_PREVIEW_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_design_file(file: UploadFile):
    """Validate that the uploaded file is a .zip under 100MB."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise ApiException("Only .zip files are allowed", 400)
    if file.content_type and file.content_type not in (
        "application/zip",
        "application/x-zip-compressed",
        "application/octet-stream",
    ):
        raise ApiException("Invalid file type. Only zip files accepted.", 400)
    # Check file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_UPLOAD_SIZE:
        raise ApiException("File too large. Maximum size is 100MB.", 400)


def validate_preview_image(file: UploadFile):
    """Validate that the uploaded file is an image under 10MB."""
    if file.content_type and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ApiException(
            f"Invalid image type '{file.content_type}'. Accepted: JPEG, PNG, WEBP, GIF, SVG, AVIF.",
            400,
        )
    # Check file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_PREVIEW_IMAGE_SIZE:
        raise ApiException("Preview image too large. Maximum size is 10MB.", 400)


ALLOWED_BADGE_COLORS = {"red", "blue", "green", "primary", "orange", "yellow", "purple", "slate", "default", "", None}

def validate_badge_color(color: Optional[str]):
    if color is not None and color.strip() not in ALLOWED_BADGE_COLORS:
        raise ApiException(
            "Invalid badge color. Allowed: red, blue, green, primary, orange, yellow, purple, slate, default",
            400
        )


def safe_filename(name: str) -> str:
    """Strip path segments and unsafe characters from an uploaded filename."""
    base = name.replace("\\", "/").split("/")[-1]
    cleaned = re.sub(r"[^\w.\-]", "_", base)
    return cleaned[:200] or "file"


def build_upload_file_key(file_type: str, filename: str, jersey_id: Optional[int] = None) -> str:
    safe_name = safe_filename(filename)
    if jersey_id is not None:
        prefix = "designs" if file_type == "design" else "previews"
        return f"{prefix}/{jersey_id}/{safe_name}"
    return f"pending/{uuid.uuid4().hex}/{safe_name}"


async def finalize_pending_preview_key(pending_key: str, jersey_id: int) -> str:
    filename = pending_key.split("/")[-1]
    dest_key = f"previews/{jersey_id}/{filename}"
    
    import mimetypes
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = "image/jpeg"
        
    await copy_r2_object(pending_key, dest_key, content_type=content_type)
    try:
        await delete_preview_image_from_r2(pending_key)
    except Exception:
        pass
    return dest_key


async def finalize_pending_design_key(pending_key: str, jersey_id: int) -> str:
    filename = pending_key.split("/")[-1]
    dest_key = f"designs/{jersey_id}/{filename}"
    await copy_r2_object(pending_key, dest_key, "application/zip")
    try:
        await delete_file_from_r2(pending_key)
    except Exception:
        pass
    return dest_key


def validate_pending_key(file_key: str, file_type: str) -> None:
    if not file_key.startswith("pending/"):
        raise ApiException(f"Invalid {file_type} file key", 400)
    parts = file_key.split("/")
    if len(parts) != 3 or not parts[1] or not parts[2]:
        raise ApiException(f"Invalid {file_type} file key", 400)


async def apply_preview_file_key(jersey: Jersey, preview_file_key: str) -> None:
    if preview_file_key.startswith("pending/"):
        validate_pending_key(preview_file_key, "preview")
        dest_key = await finalize_pending_preview_key(preview_file_key, jersey.id)
    elif preview_file_key.startswith(f"previews/{jersey.id}/"):
        dest_key = preview_file_key
    else:
        raise ApiException("Invalid preview file key", 400)
    jersey.image = get_public_preview_url(dest_key)


async def apply_design_file_key(jersey: Jersey, design_file_key: str) -> None:
    if design_file_key.startswith("pending/"):
        validate_pending_key(design_file_key, "design")
        if not design_file_key.lower().endswith(".zip"):
            raise ApiException("Only .zip files are allowed", 400)
        dest_key = await finalize_pending_design_key(design_file_key, jersey.id)
    elif design_file_key.startswith(f"designs/{jersey.id}/"):
        dest_key = design_file_key
    else:
        raise ApiException("Invalid design file key", 400)
    jersey.r2_file_key = dest_key


# --- Public endpoints ---

@router.get("", response_model=PaginatedResponse)
async def get_all_jerseys(
    categoryId: Optional[str] = None,
    minPrice: Optional[float] = None,
    maxPrice: Optional[float] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    query = select(Jersey).options(selectinload(Jersey.category))
    
    if categoryId:
        query = query.where(Jersey.category_id == categoryId)
        
    if minPrice is not None:
        query = query.where(Jersey.price >= minPrice)
        
    if maxPrice is not None:
        query = query.where(Jersey.price <= maxPrice)
        
    if search:
        safe_search = escape_like(search[:100])
        query = query.where(
            or_(
                Jersey.name.ilike(f"%{safe_search}%"),
                Jersey.player.ilike(f"%{safe_search}%")
            )
        )
        
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Paginate
    skip = (page - 1) * limit
    query = query.order_by(Jersey.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    jerseys = result.scalars().all()
    
    data = []
    for j in jerseys:
        data.append({
            "id": j.id,
            "name": j.name,
            "player": j.player,
            "price": float(j.price),
            "originalPrice": float(j.original_price) if j.original_price else None,
            "rating": j.rating,
            "reviewCount": j.review_count,
            "image": j.image,
            "badge": j.badge,
            "badgeColor": j.badge_color,
            "categoryId": j.category_id,
            "category": {"id": j.category.id, "name": j.category.name} if j.category else None
        })
        
    return PaginatedResponse(
        success=True,
        data=data,
        pagination=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            totalPages=math.ceil(total / limit) if limit else 0
        )
    )

@router.get("/{id}", response_model=ApiResponse)
async def get_jersey_by_id(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Jersey)
        .options(selectinload(Jersey.category))
        .where(Jersey.id == id)
    )
    jersey = result.scalar_one_or_none()
    
    if not jersey:
        raise ApiException("Jersey not found", 404)
        
    return ApiResponse(
        success=True,
        data={
            "id": jersey.id,
            "name": jersey.name,
            "player": jersey.player,
            "price": float(jersey.price),
            "originalPrice": float(jersey.original_price) if jersey.original_price else None,
            "rating": jersey.rating,
            "reviewCount": jersey.review_count,
            "image": jersey.image,
            "hasDesignFile": bool(jersey.r2_file_key),
            "badge": jersey.badge,
            "badgeColor": jersey.badge_color,
            "categoryId": jersey.category_id,
            "category": {"id": jersey.category.id, "name": jersey.category.name} if jersey.category else None
        }
    )


# --- Admin endpoints (multipart form + optional file upload) ---

@router.post("/upload-url", response_model=ApiResponse)
async def get_jersey_upload_url(
    body: PresignedUploadRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Return a presigned PUT URL so the admin UI can upload large files directly to R2."""
    safe_name = safe_filename(body.filename)

    if body.fileType == "design":
        if not safe_name.lower().endswith(".zip"):
            raise ApiException("Only .zip files are allowed", 400)
        content_type = "application/zip"
    else:
        if body.contentType not in ALLOWED_IMAGE_TYPES:
            raise ApiException(
                f"Invalid image type '{body.contentType}'. Accepted: JPEG, PNG, WEBP, GIF, SVG, AVIF.",
                400,
            )
        content_type = body.contentType

    if body.jerseyId is not None:
        result = await db.execute(select(Jersey.id).where(Jersey.id == body.jerseyId))
        if result.scalar_one_or_none() is None:
            raise ApiException("Jersey not found", 404)

    file_key = build_upload_file_key(body.fileType, safe_name, body.jerseyId)
    upload_url = generate_presigned_upload_url(file_key, content_type)

    return ApiResponse(
        success=True,
        data={
            "uploadUrl": upload_url,
            "fileKey": file_key,
            "publicUrl": get_public_preview_url(file_key) if body.fileType == "preview" else None,
        },
    )


@router.post("", response_model=ApiResponse, status_code=201)
async def create_jersey(
    name: str = Form(...),
    player: str = Form(...),
    price: Decimal = Form(...),
    image: Optional[str] = Form(None),
    categoryId: str = Form(...),
    originalPrice: Optional[Decimal] = Form(None),
    badge: Optional[str] = Form(None),
    badgeColor: Optional[str] = Form(None),
    design_file: Optional[UploadFile] = File(None),
    preview_image: Optional[UploadFile] = File(None),
    designFileKey: Optional[str] = Form(None),
    previewImageKey: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    # Validate files if provided
    if design_file and design_file.filename:
        validate_design_file(design_file)
    if preview_image and preview_image.filename:
        validate_preview_image(preview_image)
    
    validate_badge_color(badgeColor)

    # Resolve the display image — file upload takes priority over URL string
    display_image = image or ""

    jersey = Jersey(
        name=name,
        player=player,
        price=price,
        original_price=originalPrice,
        image=display_image,
        badge=badge,
        badge_color=badgeColor,
        category_id=categoryId,
    )
    db.add(jersey)
    await db.flush()  # get jersey.id for the R2 key

    # Upload preview image to R2 if provided — overwrites the image URL
    if previewImageKey:
        await apply_preview_file_key(jersey, previewImageKey)
    elif preview_image and preview_image.filename:
        preview_key = f"previews/{jersey.id}/{preview_image.filename}"
        public_url = await upload_preview_image_to_r2(preview_image, preview_key)
        jersey.image = public_url

    # Upload design file to R2 if provided
    if designFileKey:
        await apply_design_file_key(jersey, designFileKey)
    elif design_file and design_file.filename:
        file_key = f"designs/{jersey.id}/{design_file.filename}"
        await upload_file_to_r2(design_file, file_key)
        jersey.r2_file_key = file_key

    await db.commit()
    
    # Load category
    result = await db.execute(select(Jersey).options(selectinload(Jersey.category)).where(Jersey.id == jersey.id))
    jersey = result.scalar_one()
    
    return ApiResponse(
        success=True,
        data={
            "id": jersey.id,
            "name": jersey.name,
            "player": jersey.player,
            "price": float(jersey.price),
            "image": jersey.image,
            "hasDesignFile": bool(jersey.r2_file_key),
            "category": {"id": jersey.category.id, "name": jersey.category.name} if jersey.category else None
        }
    )

@router.patch("/{id}", response_model=ApiResponse)
async def update_jersey(
    id: int,
    name: Optional[str] = Form(None),
    player: Optional[str] = Form(None),
    price: Optional[Decimal] = Form(None),
    originalPrice: Optional[Decimal] = Form(None),
    image: Optional[str] = Form(None),
    badge: Optional[str] = Form(None),
    badgeColor: Optional[str] = Form(None),
    categoryId: Optional[str] = Form(None),
    design_file: Optional[UploadFile] = File(None),
    preview_image: Optional[UploadFile] = File(None),
    designFileKey: Optional[str] = Form(None),
    previewImageKey: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    result = await db.execute(select(Jersey).where(Jersey.id == id))
    jersey = result.scalar_one_or_none()
    
    if not jersey:
        raise ApiException("Jersey not found", 404)

    validate_badge_color(badgeColor)

    # Update scalar fields if provided
    if name is not None:
        jersey.name = name
    if player is not None:
        jersey.player = player
    if price is not None:
        jersey.price = price
    if originalPrice is not None:
        jersey.original_price = originalPrice
    if image is not None:
        jersey.image = image
    if badge is not None:
        jersey.badge = badge
    if badgeColor is not None:
        jersey.badge_color = badgeColor
    if categoryId is not None:
        jersey.category_id = categoryId

    # Handle preview image upload/replacement
    if previewImageKey:
        old_image = jersey.image or ""
        public_base = (settings.R2_PUBLIC_BASE_URL or "").rstrip("/")
        if public_base and old_image.startswith(public_base) and "/previews/" in old_image:
            old_key = old_image.replace(public_base + "/", "", 1)
            try:
                await delete_preview_image_from_r2(old_key)
            except Exception:
                pass
        await apply_preview_file_key(jersey, previewImageKey)
    elif preview_image and preview_image.filename:
        validate_preview_image(preview_image)
        # Delete old preview image from R2 if it was previously uploaded there
        # We detect R2 preview images by checking if the current image URL starts with our public base URL
        # and has a 'previews/' path segment
        old_image = jersey.image or ""
        public_base = (settings.R2_PUBLIC_BASE_URL or "").rstrip("/")
        if public_base and old_image.startswith(public_base) and "/previews/" in old_image:
            old_key = old_image.replace(public_base + "/", "", 1)
            try:
                await delete_preview_image_from_r2(old_key)
            except Exception:
                pass  # Non-critical, continue
        # Upload new preview image
        preview_key = f"previews/{jersey.id}/{preview_image.filename}"
        public_url = await upload_preview_image_to_r2(preview_image, preview_key)
        jersey.image = public_url

    # Handle design file upload/replacement
    if designFileKey:
        if jersey.r2_file_key:
            try:
                await delete_file_from_r2(jersey.r2_file_key)
            except Exception:
                pass
        await apply_design_file_key(jersey, designFileKey)
    elif design_file and design_file.filename:
        validate_design_file(design_file)
        # Delete old file from R2 if exists
        if jersey.r2_file_key:
            try:
                await delete_file_from_r2(jersey.r2_file_key)
            except Exception:
                pass  # Old file might not exist, continue
        # Upload new file
        file_key = f"designs/{jersey.id}/{design_file.filename}"
        await upload_file_to_r2(design_file, file_key)
        jersey.r2_file_key = file_key

    await db.commit()
    
    # Fetch fresh
    result = await db.execute(select(Jersey).options(selectinload(Jersey.category)).where(Jersey.id == id))
    jersey = result.scalar_one()
    
    return ApiResponse(
        success=True,
        data={
            "id": jersey.id,
            "name": jersey.name,
            "player": jersey.player,
            "price": float(jersey.price),
            "image": jersey.image,
            "hasDesignFile": bool(jersey.r2_file_key),
            "category": {"id": jersey.category.id, "name": jersey.category.name} if jersey.category else None
        }
    )

@router.delete("/{id}", response_model=ApiResponse)
async def delete_jersey(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    result = await db.execute(select(Jersey).where(Jersey.id == id))
    jersey = result.scalar_one_or_none()
    
    if not jersey:
        raise ApiException("Jersey not found", 404)

    order_count_result = await db.execute(
        select(func.count()).select_from(OrderItem).where(OrderItem.jersey_id == id)
    )
    if (order_count_result.scalar() or 0) > 0:
        raise ApiException(
            "Cannot delete this jersey because it appears in existing orders. "
            "Remove it from the storefront instead, or contact support.",
            409,
        )

    # Delete private design file (zip) from R2 if exists
    if jersey.r2_file_key:
        try:
            await delete_file_from_r2(jersey.r2_file_key)
        except Exception:
            pass  # Non-critical, continue with DB deletion

    # Delete public preview image from R2 if it was uploaded there
    old_image = jersey.image or ""
    public_base = (settings.R2_PUBLIC_BASE_URL or "").rstrip("/")
    if public_base and old_image.startswith(public_base) and "/previews/" in old_image:
        old_preview_key = old_image.replace(public_base + "/", "", 1)
        try:
            await delete_preview_image_from_r2(old_preview_key)
        except Exception:
            pass  # Non-critical, continue with DB deletion

    await db.delete(jersey)
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Jersey deleted"
    )

