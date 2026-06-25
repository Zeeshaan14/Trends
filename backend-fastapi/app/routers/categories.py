from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.models.category import Category
from app.models.jersey import Jersey
from app.schemas.category import CreateCategoryRequest
from app.schemas.common import ApiResponse
from app.dependencies.auth import get_admin_user
from app.exceptions import ApiException
from sqlalchemy.orm import selectinload

router = APIRouter()

@router.get("", response_model=ApiResponse)
async def get_all_categories(db: AsyncSession = Depends(get_db)):
    import traceback
    try:
        result = await db.execute(select(Category))
        categories = result.scalars().all()
        
        # We need to include jersey counts
        counts_result = await db.execute(
            select(Jersey.category_id, func.count(Jersey.id))
            .group_by(Jersey.category_id)
        )
        counts = dict(counts_result.all())
        
        data = []
        for cat in categories:
            data.append({
                "id": cat.id,
                "name": cat.name,
                "image": cat.image,
                "description": cat.description,
                "_count": {"jerseys": counts.get(cat.id, 0)}
            })
            
        return ApiResponse(success=True, data=data)
    except Exception as e:
        return ApiResponse(success=False, error=traceback.format_exc())

@router.get("/{id}", response_model=ApiResponse)
async def get_category_by_id(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.jerseys))
        .where(Category.id == id)
    )
    category = result.scalar_one_or_none()
    
    if not category:
        raise ApiException("Category not found", 404)
        
    return ApiResponse(
        success=True,
        data={
            "id": category.id,
            "name": category.name,
            "image": category.image,
            "description": category.description,
            "jerseys": [{"id": j.id, "name": j.name, "price": float(j.price), "image": j.image} for j in category.jerseys]
        }
    )

@router.post("", response_model=ApiResponse, status_code=201)
async def create_category(
    request: CreateCategoryRequest, 
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    category = Category(**request.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    
    return ApiResponse(
        success=True,
        data={
            "id": category.id,
            "name": category.name,
            "image": category.image,
            "description": category.description
        }
    )
