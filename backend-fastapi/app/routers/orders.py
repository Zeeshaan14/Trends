from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.user import User
from app.models.jersey import Jersey
from app.models.order import Order, OrderItem
from app.models.enums import Role, OrderStatus
from app.schemas.order import CreateOrderRequest
from app.schemas.common import ApiResponse
from app.dependencies.auth import get_current_user
from app.exceptions import ApiException

router = APIRouter()

@router.post("", response_model=ApiResponse, status_code=201)
async def create_order(request: CreateOrderRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            company_name=request.companyName,
            email=request.email,
            phone=request.phone,
            role=Role.USER
        )
        db.add(user)
    else:
        user.company_name = request.companyName
        user.phone = request.phone
        
    await db.flush() # get user id
    
    jersey_ids = [item.jerseyId for item in request.items]
    jerseys_result = await db.execute(select(Jersey).where(Jersey.id.in_(jersey_ids)))
    jerseys = jerseys_result.scalars().all()
    
    if len(jerseys) != len(jersey_ids):
        raise ApiException("One or more jerseys not found", 400)
        
    jersey_map = {j.id: j for j in jerseys}
    
    subtotal = sum([float(jersey_map[item.jerseyId].price) * item.quantity for item in request.items])
    tax = 0.0 # 18% GST removed based on previous logic tax = subtotal * 0
    total = subtotal + tax
    
    order = Order(
        user_id=user.id,
        status=OrderStatus.PENDING,
        subtotal=subtotal,
        tax=tax,
        total=total
    )
    db.add(order)
    await db.flush()
    
    order_items = []
    for item in request.items:
        jersey = jersey_map[item.jerseyId]
        oi = OrderItem(
            order_id=order.id,
            jersey_id=item.jerseyId,
            quantity=item.quantity,
            price=jersey.price
        )
        db.add(oi)
        order_items.append(oi)
        
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Order created successfully",
        data={
            "id": order.id,
            "status": order.status,
            "subtotal": float(order.subtotal),
            "total": float(order.total)
        }
    )

@router.get("/{id}", response_model=ApiResponse)
async def get_order_by_id(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.jersey),
            selectinload(Order.user),
            selectinload(Order.payment)
        )
        .where(Order.id == id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise ApiException("Order not found", 404)
        
    return ApiResponse(
        success=True,
        data={
            "id": order.id,
            "status": order.status,
            "subtotal": float(order.subtotal),
            "total": float(order.total),
            "user": {
                "id": order.user.id,
                "email": order.user.email,
                "companyName": order.user.company_name
            },
            "payment": {"id": order.payment.id, "status": order.payment.status} if order.payment else None,
            "items": [
                {
                    "id": item.id,
                    "quantity": item.quantity,
                    "price": float(item.price),
                    "jersey": {
                        "id": item.jersey.id,
                        "name": item.jersey.name,
                        "image": item.jersey.image,
                        "player": item.jersey.player,
                        "downloadUrl": item.jersey.download_url if order.status == OrderStatus.PAID else None
                    }
                } for item in order.items
            ]
        }
    )

@router.get("", response_model=ApiResponse)
async def get_user_orders(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.jersey),
            selectinload(Order.payment)
        )
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    
    data = []
    for order in orders:
        data.append({
            "id": order.id,
            "status": order.status,
            "total": float(order.total),
            "createdAt": order.created_at.isoformat() if order.created_at else None,
            "payment": {"id": order.payment.id, "status": order.payment.status} if order.payment else None,
            "items": [
                {
                    "id": item.id,
                    "quantity": item.quantity,
                    "jersey": {
                        "id": item.jersey.id,
                        "name": item.jersey.name,
                        "image": item.jersey.image
                    }
                } for item in order.items
            ]
        })
        
    return ApiResponse(success=True, data=data)
