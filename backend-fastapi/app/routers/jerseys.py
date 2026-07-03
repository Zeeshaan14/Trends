from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Form, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional
import math

from app.db import get_db
from app.models.jersey import Jersey
from app.schemas.jersey import JerseyFilterParams
from app.schemas.common import PaginatedResponse, ApiResponse, PaginationMeta
from app.dependencies.auth import get_admin_user
from app.exceptions import ApiException
from app.services.r2_service import upload_file_to_r2, delete_file_from_r2

router = APIRouter()

# --- File validation ---

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB


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
        query = query.where(
            or_(
                Jersey.name.ilike(f"%{search}%"),
                Jersey.player.ilike(f"%{search}%")
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

@router.post("", response_model=ApiResponse, status_code=201)
async def create_jersey(
    name: str = Form(...),
    player: str = Form(...),
    price: Decimal = Form(...),
    image: str = Form(...),
    categoryId: str = Form(...),
    originalPrice: Optional[Decimal] = Form(None),
    badge: Optional[str] = Form(None),
    badgeColor: Optional[str] = Form(None),
    design_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    # Validate file if provided
    if design_file and design_file.filename:
        validate_design_file(design_file)

    jersey = Jersey(
        name=name,
        player=player,
        price=price,
        original_price=originalPrice,
        image=image,
        badge=badge,
        badge_color=badgeColor,
        category_id=categoryId,
    )
    db.add(jersey)
    await db.flush()  # get jersey.id for the R2 key

    # Upload design file to R2 if provided
    if design_file and design_file.filename:
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
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    result = await db.execute(select(Jersey).where(Jersey.id == id))
    jersey = result.scalar_one_or_none()
    
    if not jersey:
        raise ApiException("Jersey not found", 404)

    # Update fields if provided
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

    # Handle design file upload/replacement
    if design_file and design_file.filename:
        validate_design_file(design_file)
        # Delete old file from R2 if exists
        if jersey.r2_file_key:
            try:
                delete_file_from_r2(jersey.r2_file_key)
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

    # Delete design file from R2 if exists
    if jersey.r2_file_key:
        try:
            delete_file_from_r2(jersey.r2_file_key)
        except Exception:
            pass  # Non-critical, continue with DB deletion

    await db.delete(jersey)
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Jersey deleted"
    )
