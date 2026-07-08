from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Form, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
import math
import re

def escape_like(s: str) -> str:
    """Escape SQL LIKE special characters."""
    return re.sub(r"([%_\\])", r"\\\1", s)

from app.db import get_db
from app.models.jersey import Jersey
from app.schemas.jersey import JerseyFilterParams
from app.schemas.common import PaginatedResponse, ApiResponse, PaginationMeta
from app.dependencies.auth import get_admin_user
from app.exceptions import ApiException
from app.config import settings
from app.services.r2_service import (
    upload_file_to_r2,
    delete_file_from_r2,
    upload_preview_image_to_r2,
    delete_preview_image_from_r2,
    ALLOWED_IMAGE_TYPES,
    get_public_preview_url,
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


# --- Public endpoints ---

@router.get("", response_model=PaginatedResponse)
async def get_all_jerseys(
    minPrice: Optional[float] = None,
    maxPrice: Optional[float] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    query = select(Jersey)
        
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
        }
    )


# --- Admin endpoints (multipart form + optional file upload) ---

@router.post("", response_model=ApiResponse, status_code=201)
async def create_jersey(
    name: str = Form(...),
    player: str = Form(...),
    price: Decimal = Form(...),
    image: Optional[str] = Form(None),
    originalPrice: Optional[Decimal] = Form(None),
    badge: Optional[str] = Form(None),
    badgeColor: Optional[str] = Form(None),
    design_file: Optional[UploadFile] = File(None),
    preview_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    # Validate files if provided
    if design_file and design_file.filename:
        validate_design_file(design_file)
    if preview_image and preview_image.filename:
        validate_preview_image(preview_image)

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
    )
    db.add(jersey)
    await db.flush()  # get jersey.id for the R2 key

    # Upload preview image to R2 if provided — overwrites the image URL
    if preview_image and preview_image.filename:
        preview_key = f"previews/{jersey.id}/{preview_image.filename}"
        public_url = await upload_preview_image_to_r2(preview_image, preview_key)
        jersey.image = public_url

    # Upload design file to R2 if provided
    if design_file and design_file.filename:
        file_key = f"designs/{jersey.id}/{design_file.filename}"
        await upload_file_to_r2(design_file, file_key)
        jersey.r2_file_key = file_key

    await db.commit()
    
    # Load jersey
    result = await db.execute(select(Jersey).where(Jersey.id == jersey.id))
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
    design_file: Optional[UploadFile] = File(None),
    preview_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    result = await db.execute(select(Jersey).where(Jersey.id == id))
    jersey = result.scalar_one_or_none()
    
    if not jersey:
        raise ApiException("Jersey not found", 404)

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

    # Handle preview image upload/replacement
    if preview_image and preview_image.filename:
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
    if design_file and design_file.filename:
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
    result = await db.execute(select(Jersey).where(Jersey.id == id))
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

