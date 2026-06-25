from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional
import math

from app.db import get_db
from app.models.jersey import Jersey
from app.schemas.jersey import CreateJerseyRequest, UpdateJerseyRequest
from app.schemas.common import PaginatedResponse, ApiResponse, PaginationMeta
from app.dependencies.auth import get_admin_user
from app.exceptions import ApiException

router = APIRouter()

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
            "downloadUrl": jersey.download_url,
            "badge": jersey.badge,
            "badgeColor": jersey.badge_color,
            "categoryId": jersey.category_id,
            "category": {"id": jersey.category.id, "name": jersey.category.name} if jersey.category else None
        }
    )

@router.post("", response_model=ApiResponse, status_code=201)
async def create_jersey(
    request: CreateJerseyRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    jersey = Jersey(
        name=request.name,
        player=request.player,
        price=request.price,
        original_price=request.originalPrice,
        image=request.image,
        download_url=request.downloadUrl,
        badge=request.badge,
        badge_color=request.badgeColor,
        category_id=request.categoryId
    )
    db.add(jersey)
    await db.commit()
    await db.refresh(jersey)
    
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
            "category": {"id": jersey.category.id, "name": jersey.category.name} if jersey.category else None
        }
    )

@router.patch("/{id}", response_model=ApiResponse)
async def update_jersey(
    id: int,
    request: UpdateJerseyRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    result = await db.execute(select(Jersey).where(Jersey.id == id))
    jersey = result.scalar_one_or_none()
    
    if not jersey:
        raise ApiException("Jersey not found", 404)
        
    update_data = request.model_dump(exclude_unset=True)
    if "originalPrice" in update_data:
        update_data["original_price"] = update_data.pop("originalPrice")
    if "downloadUrl" in update_data:
        update_data["download_url"] = update_data.pop("downloadUrl")
    if "badgeColor" in update_data:
        update_data["badge_color"] = update_data.pop("badgeColor")
    if "categoryId" in update_data:
        update_data["category_id"] = update_data.pop("categoryId")
        
    for key, value in update_data.items():
        setattr(jersey, key, value)
        
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
        
    await db.delete(jersey)
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Jersey deleted"
    )
