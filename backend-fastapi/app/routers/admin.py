from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
import math

from app.db import get_db
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.models.jersey import Jersey
from app.models.enums import PaymentStatus
from app.schemas.common import PaginatedResponse, ApiResponse, PaginationMeta
from app.dependencies.auth import get_admin_user

# Import endpoints from other routers to reuse logic if we wanted to, 
# but we can also just define them directly. Let's just define dashboard and listing logic here.
# Admin jersey/category CRUD should technically be imported or redefined. We'll use the ones from jerseys.py by including it in main directly, or we can redefine it here.
# For simplicity, we just provide the admin views.

router = APIRouter()

@router.get("/dashboard", response_model=ApiResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_user)):
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    total_jerseys = (await db.execute(select(func.count(Jersey.id)))).scalar() or 0
    
    total_revenue_result = await db.execute(select(func.sum(Payment.amount)).where(Payment.status == PaymentStatus.COMPLETED))
    total_revenue = total_revenue_result.scalar() or 0
    
    recent_orders_result = await db.execute(
        select(Order)
        .options(selectinload(Order.user), selectinload(Order.payment))
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    recent_orders = recent_orders_result.scalars().all()
    
    recent_payments_result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.order).selectinload(Order.user))
        .order_by(Payment.created_at.desc())
        .limit(5)
    )
    recent_payments = recent_payments_result.scalars().all()
    
    orders_by_status_result = await db.execute(
        select(Order.status, func.count(Order.id))
        .group_by(Order.status)
    )
    orders_by_status = [{"status": row[0], "_count": row[1]} for row in orders_by_status_result.all()]
    
    return ApiResponse(
        success=True,
        data={
            "stats": {
                "totalUsers": total_users,
                "totalOrders": total_orders,
                "totalJerseys": total_jerseys,
                "totalRevenue": float(total_revenue),
                "ordersByStatus": orders_by_status
            },
            "recentOrders": [{"id": o.id, "status": o.status, "total": float(o.total)} for o in recent_orders],
            "recentPayments": [{"id": p.id, "amount": float(p.amount), "status": p.status} for p in recent_payments]
        }
    )

@router.get("/orders", response_model=PaginatedResponse)
async def get_all_orders(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    query = select(Order).options(selectinload(Order.user), selectinload(Order.payment))
    if status:
        query = query.where(Order.status == status)
        
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    
    skip = (page - 1) * limit
    query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    orders = (await db.execute(query)).scalars().all()
    
    return PaginatedResponse(
        success=True,
        data=[{"id": o.id, "status": o.status, "total": float(o.total), "user": {"email": o.user.email}} for o in orders],
        pagination=PaginationMeta(page=page, limit=limit, total=total, totalPages=math.ceil(total/limit))
    )

@router.get("/payments", response_model=PaginatedResponse)
async def get_all_payments(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    query = select(Payment).options(selectinload(Payment.order).selectinload(Order.user))
    if status:
        query = query.where(Payment.status == status)
        
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    
    skip = (page - 1) * limit
    query = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit)
    payments = (await db.execute(query)).scalars().all()
    
    return PaginatedResponse(
        success=True,
        data=[{"id": p.id, "amount": float(p.amount), "status": p.status, "order": {"id": p.order.id}} for p in payments],
        pagination=PaginationMeta(page=page, limit=limit, total=total, totalPages=math.ceil(total/limit))
    )

@router.get("/users", response_model=PaginatedResponse)
async def get_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user)
):
    query = select(User)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    
    skip = (page - 1) * limit
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    users = (await db.execute(query)).scalars().all()
    
    # We ideally want order count per user here. We can fetch it with group_by.
    # For now, simplifying response.
    return PaginatedResponse(
        success=True,
        data=[{"id": u.id, "email": u.email, "companyName": u.company_name, "role": u.role} for u in users],
        pagination=PaginationMeta(page=page, limit=limit, total=total, totalPages=math.ceil(total/limit))
    )
