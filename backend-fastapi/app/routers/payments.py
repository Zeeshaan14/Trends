import json
import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.enums import OrderStatus, PaymentStatus
from app.schemas.payment import VerifyPaymentRequest
from app.schemas.common import ApiResponse
from app.exceptions import ApiException
from app.services.razorpay_service import verify_payment_signature, verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/verify", response_model=ApiResponse, status_code=201)
async def verify_payment(request: VerifyPaymentRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify Razorpay payment signature and mark order as paid.
    Called by the frontend after Razorpay checkout success callback.
    """
    # Fetch the order
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.payment), selectinload(Order.items).selectinload(OrderItem.jersey))
        .where(Order.id == request.orderId)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise ApiException("Order not found", 404)
    
    if order.payment and order.payment.status == PaymentStatus.COMPLETED:
        raise ApiException("Payment already completed for this order", 400)
    
    # Verify the Razorpay signature
    is_valid = verify_payment_signature(
        razorpay_order_id=request.razorpayOrderId,
        razorpay_payment_id=request.razorpayPaymentId,
        razorpay_signature=request.razorpaySignature,
    )
    
    if not is_valid:
        # Create a failed payment record
        failed_payment = Payment(
            order_id=order.id,
            method="razorpay",
            transaction_id=request.razorpayPaymentId,
            razorpay_payment_id=request.razorpayPaymentId,
            razorpay_signature=request.razorpaySignature,
            amount=order.total,
            status=PaymentStatus.FAILED,
        )
        db.add(failed_payment)
        await db.commit()
        raise ApiException("Payment verification failed. Signature mismatch.", 400)
    
    # Signature is valid — create payment record and update order
    payment = Payment(
        order_id=order.id,
        method="razorpay",
        transaction_id=request.razorpayPaymentId,
        razorpay_payment_id=request.razorpayPaymentId,
        razorpay_signature=request.razorpaySignature,
        amount=order.total,
        status=PaymentStatus.COMPLETED,
    )
    db.add(payment)
    
    order.status = OrderStatus.PAID
    await db.commit()
    
    return ApiResponse(
        success=True,
        message="Payment verified successfully! Download links are now available.",
        data={
            "payment": {
                "id": payment.id,
                "status": payment.status,
                "amount": float(payment.amount),
            },
            "order": {
                "id": order.id,
                "status": order.status,
            },
            "downloadLinks": [
                {
                    "jerseyId": item.jersey.id,
                    "name": item.jersey.name,
                    "downloadUrl": item.jersey.download_url,
                } for item in order.items
            ],
        }
    )


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Razorpay webhook handler — safety net for payment confirmation.
    Handles payment.captured events in case the frontend callback fails.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    # Verify webhook signature
    is_valid = verify_webhook_signature(body, signature)
    if not is_valid:
        logger.warning("Invalid webhook signature received")
        raise ApiException("Invalid webhook signature", 400)
    
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise ApiException("Invalid JSON payload", 400)
    
    event = payload.get("event", "")
    
    if event == "payment.captured":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        razorpay_order_id = payment_entity.get("order_id")
        razorpay_payment_id = payment_entity.get("id")
        amount_paise = payment_entity.get("amount", 0)
        
        if not razorpay_order_id or not razorpay_payment_id:
            logger.warning("Webhook missing order_id or payment_id")
            return {"status": "ignored", "reason": "missing data"}
        
        # Find the order by Razorpay order ID
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.payment))
            .where(Order.razorpay_order_id == razorpay_order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            logger.warning(f"Webhook: Order not found for razorpay_order_id={razorpay_order_id}")
            return {"status": "ignored", "reason": "order not found"}
        
        # Skip if already paid
        if order.status == OrderStatus.PAID:
            logger.info(f"Webhook: Order {order.id} already paid, skipping")
            return {"status": "ok", "message": "already processed"}
        
        # Create payment record if not exists
        if not order.payment or order.payment.status != PaymentStatus.COMPLETED:
            # Delete any existing failed payment record
            if order.payment:
                await db.delete(order.payment)
                await db.flush()
            
            payment = Payment(
                order_id=order.id,
                method="razorpay",
                transaction_id=razorpay_payment_id,
                razorpay_payment_id=razorpay_payment_id,
                amount=amount_paise / 100,  # Convert paise to INR
                status=PaymentStatus.COMPLETED,
            )
            db.add(payment)
            order.status = OrderStatus.PAID
            await db.commit()
            
            logger.info(f"Webhook: Payment captured for order {order.id}")
        
        return {"status": "ok"}
    
    # For other events, just acknowledge
    logger.info(f"Webhook: Received event {event}, ignoring")
    return {"status": "ok", "event": event}


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
