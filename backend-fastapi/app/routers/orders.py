from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.user import User
from app.models.jersey import Jersey
from app.models.order import Order, OrderItem
from app.models.enums import Role, OrderStatus
from app.schemas.order import CreateOrderRequest, DownloadDesignRequest
from app.schemas.common import ApiResponse
from app.dependencies.auth import get_current_user
from app.exceptions import ApiException
from app.config import settings
from app.services.razorpay_service import create_razorpay_order
from app.services.r2_service import generate_presigned_url
from app.security.rate_limit import limiter
from app.security.jwt import decode_token

router = APIRouter()

@router.post("", response_model=ApiResponse, status_code=201)
@limiter.limit("10/minute")
async def create_order(body: CreateOrderRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            company_name=body.companyName,
            email=body.email,
            phone=body.phone,
            role=Role.USER
        )
        db.add(user)
    else:
        # Protect existing user data (PII) from override. Only set fields if currently blank.
        if not user.company_name:
            user.company_name = body.companyName
        if not user.phone:
            user.phone = body.phone
        
    await db.flush() # get user id
    
    jersey_ids = [item.jerseyId for item in body.items]
    unique_ids = list(set(jersey_ids))
    jerseys_result = await db.execute(select(Jersey).where(Jersey.id.in_(unique_ids)))
    jerseys = jerseys_result.scalars().all()
    
    if len(jerseys) != len(unique_ids):
        raise ApiException("One or more jerseys not found", 400)
        
    jersey_map = {j.id: j for j in jerseys}
    
    subtotal = sum([float(jersey_map[item.jerseyId].price) * item.quantity for item in body.items])
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
    for item in body.items:
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
        razorpay_order = await create_razorpay_order(
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
            "tax": float(order.tax),
            "total": float(order.total),
            "razorpayOrderId": order.razorpay_order_id,
            "razorpayKeyId": settings.RAZORPAY_KEY_ID,
        }
    )

@router.get("/{id}", response_model=ApiResponse)
@limiter.limit("30/minute")
async def get_order_by_id(id: str, request: Request, email: str | None = None, db: AsyncSession = Depends(get_db)):
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

    # Authorization Check
    is_admin = False
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_token(token)
            if payload.get("type") == "access":
                user_id = payload.get("sub")
                if user_id:
                    user_res = await db.execute(select(User).where(User.id == user_id))
                    user = user_res.scalar_one_or_none()
                    if user and user.role == Role.SUPERADMIN:
                        is_admin = True
        except Exception:
            pass

    if not is_admin:
        if not email or email.strip().lower() != order.user.email.lower():
            raise ApiException("Not authorized to view this order", 403)
        
    return ApiResponse(
        success=True,
        data={
            "id": order.id,
            "status": order.status,
            "subtotal": float(order.subtotal),
            "tax": float(order.tax),
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
@limiter.limit("20/minute")
async def get_user_orders(request: Request, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
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


@router.post("/{order_id}/download/{jersey_id}", response_model=ApiResponse)
@limiter.limit("15/minute")
async def download_design(
    order_id: str,
    jersey_id: int,
    request_data: DownloadDesignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a presigned R2 download URL for a specific jersey design.
    Requires order_id, jersey_id, and the email in the request body.
    No JWT needed — customers check out as guests.
    """
    # 1. Fetch order with items and jerseys
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.jersey),
            selectinload(Order.user),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise ApiException("Order not found", 404)

    # 2. Verify ownership via email (case-insensitive)
    if order.user.email.lower() != request_data.email.lower():
        raise ApiException("Not authorized", 403)

    # 3. Verify payment
    if order.status != OrderStatus.PAID:
        raise ApiException("Payment not completed", 402)

    # 4. Verify download count limits
    if order.download_count >= settings.MAX_DOWNLOAD_COUNT:
        raise ApiException("Download limit exceeded for this order. Contact support.", 403)

    # 5. Find the jersey in order items
    target_item = next(
        (item for item in order.items if item.jersey_id == jersey_id), None
    )
    if not target_item:
        raise ApiException("Jersey not found in this order", 404)

    # 6. Check R2 file exists
    if not target_item.jersey.r2_file_key:
        raise ApiException("Design file not available for this jersey", 404)

    # 7. Generate presigned URL (15 min expiry)
    try:
        signed_url = generate_presigned_url(target_item.jersey.r2_file_key)
    except Exception as e:
        raise ApiException("Download service is currently unavailable. Please try again later.", 503)

    # 8. Increment download count
    order.download_count += 1
    await db.commit()

    return ApiResponse(
        success=True,
        data={"download_url": signed_url, "expires_in": 900}
    )
