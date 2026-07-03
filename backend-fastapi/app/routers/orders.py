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
from app.config import settings
from app.services.razorpay_service import create_razorpay_order
from app.services.r2_service import generate_presigned_url

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

    # Create Razorpay order
    try:
        razorpay_order = create_razorpay_order(
            amount_inr=total,
            receipt=order.id,
        )
        order.razorpay_order_id = razorpay_order["id"]
    except Exception as e:
        await db.rollback()
        raise ApiException(f"Failed to create payment order: {str(e)}", 500)
        
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Order created successfully",
        data={
            "id": order.id,
            "status": order.status,
            "subtotal": float(order.subtotal),
            "total": float(order.total),
            "razorpayOrderId": order.razorpay_order_id,
            "razorpayKeyId": settings.RAZORPAY_KEY_ID,
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
            "razorpayOrderId": order.razorpay_order_id,
            "razorpayKeyId": settings.RAZORPAY_KEY_ID,
            "user": {
                "id": order.user.id,
                "email": order.user.email,
                "companyName": order.user.company_name,
                "phone": order.user.phone,
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
                        "hasDesignFile": bool(item.jersey.r2_file_key) if order.status == OrderStatus.PAID else False
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


@router.get("/{order_id}/download/{jersey_id}", response_model=ApiResponse)
async def download_design(
    order_id: str,
    jersey_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Generate a presigned R2 download URL for a specific jersey design.
    Requires: authenticated user, order ownership, paid status.
    """
    # 1. Fetch order with items and jerseys
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.jersey))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise ApiException("Order not found", 404)

    # 2. Verify ownership
    if order.user_id != user.id:
        raise ApiException("Not authorized", 403)

    # 3. Verify payment
    if order.status != OrderStatus.PAID:
        raise ApiException("Payment not completed", 402)

    # 4. Find the jersey in order items
    target_item = next(
        (item for item in order.items if item.jersey_id == jersey_id), None
    )
    if not target_item:
        raise ApiException("Jersey not found in this order", 404)

    # 5. Check R2 file exists
    if not target_item.jersey.r2_file_key:
        raise ApiException("Design file not available", 404)

    # 6. Generate presigned URL (15 min expiry)
    signed_url = generate_presigned_url(target_item.jersey.r2_file_key)

    # 7. Increment download count
    order.download_count += 1
    await db.commit()

    return ApiResponse(
        success=True,
        data={"download_url": signed_url, "expires_in": 900}
    )
