from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.enums import OrderStatus, PaymentStatus
from app.schemas.payment import ProcessPaymentRequest
from app.schemas.common import ApiResponse
from app.exceptions import ApiException

router = APIRouter()

@router.post("/", response_model=ApiResponse, status_code=201)
async def process_payment(request: ProcessPaymentRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.payment), selectinload(Order.items).selectinload(OrderItem.jersey))
        .where(Order.id == request.orderId)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise ApiException("Order not found", 404)
        
    if order.payment:
        raise ApiException("Payment already exists for this order", 400)
        
    payment = Payment(
        order_id=order.id,
        method=request.method,
        transaction_id=request.transactionId,
        amount=order.total,
        status=PaymentStatus.COMPLETED
    )
    db.add(payment)
    
    order.status = OrderStatus.PAID
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Payment successful! Download links are now available.",
        data={
            "payment": {
                "id": payment.id,
                "status": payment.status,
                "amount": float(payment.amount)
            },
            "order": {
                "id": order.id,
                "status": order.status
            },
            "downloadLinks": [
                {
                    "jerseyId": item.jersey.id,
                    "name": item.jersey.name,
                    "downloadUrl": item.jersey.download_url
                } for item in order.items
            ]
        }
    )

@router.get("/{id}", response_model=ApiResponse)
async def get_payment_by_id(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Payment)
        .options(
            selectinload(Payment.order).selectinload(Order.user),
            selectinload(Payment.order).selectinload(Order.items).selectinload(OrderItem.jersey)
        )
        .where(Payment.id == id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise ApiException("Payment not found", 404)
        
    return ApiResponse(
        success=True,
        data={
            "id": payment.id,
            "status": payment.status,
            "amount": float(payment.amount),
            "order": {
                "id": payment.order.id,
                "status": payment.order.status,
                "user": {
                    "email": payment.order.user.email
                }
            }
        }
    )
