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
from app.dependencies.auth import get_superadmin_user
from app.security.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/verify", response_model=ApiResponse, status_code=201)
@limiter.limit("5/minute")
async def verify_payment(body: VerifyPaymentRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Verify Razorpay payment signature and mark order as paid.
    Called by the frontend after Razorpay checkout success callback.
    """
    # Fetch the order
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.payment), selectinload(Order.items).selectinload(OrderItem.jersey))
        .where(Order.id == body.orderId)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise ApiException("Order not found", 404)
    
    if order.payment and order.payment.status == PaymentStatus.COMPLETED:
        raise ApiException("Payment already completed for this order", 400)
    
    # Verify the Razorpay signature
    is_valid = verify_payment_signature(
        razorpay_order_id=body.razorpayOrderId,
        razorpay_payment_id=body.razorpayPaymentId,
        razorpay_signature=body.razorpaySignature,
    )
    
    if not is_valid:
        # Create a failed payment record
        failed_payment = Payment(
            order_id=order.id,
            method="razorpay",
            transaction_id=body.razorpayPaymentId,
            razorpay_payment_id=body.razorpayPaymentId,
            razorpay_signature=body.razorpaySignature,
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
        transaction_id=body.razorpayPaymentId,
        razorpay_payment_id=body.razorpayPaymentId,
        razorpay_signature=body.razorpaySignature,
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
            "downloadItems": [
                {
                    "jerseyId": item.jersey.id,
                    "name": item.jersey.name,
                    "hasDesignFile": bool(item.jersey.r2_file_key),
                } for item in order.items
            ],
        }
    )


@router.post("/webhook")
@limiter.exempt
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Razorpay webhook handler — safety net for payment confirmation.
    Handles payment.captured and payment.authorized events.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    logger.warning(f"Webhook: Received request, signature present: {bool(signature)}, body length: {len(body)}")
    
    # Verify webhook signature
    is_valid = verify_webhook_signature(body, signature)
    if not is_valid:
        logger.warning(f"Webhook: Invalid signature. Signature: {signature[:20]}...")
        raise ApiException("Invalid webhook signature", 400)
    
    logger.warning("Webhook: Signature verified OK")
    
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise ApiException("Invalid JSON payload", 400)
    
    event = payload.get("event", "")
    logger.warning(f"Webhook: Event type = '{event}'")
    
    # Handle both payment.captured and payment.authorized
    if event in ("payment.captured", "payment.authorized"):
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        razorpay_order_id = payment_entity.get("order_id")
        razorpay_payment_id = payment_entity.get("id")
        amount_paise = payment_entity.get("amount", 0)
        payment_status = payment_entity.get("status", "")
        
        logger.warning(f"Webhook: razorpay_order_id={razorpay_order_id}, payment_id={razorpay_payment_id}, status={payment_status}, amount={amount_paise}")
        
        if not razorpay_order_id or not razorpay_payment_id:
            logger.warning("Webhook: Missing order_id or payment_id")
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
        
        logger.warning(f"Webhook: Found order {order.id}, current status={order.status}")
        
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
            
            logger.warning(f"Webhook: ✅ Payment captured for order {order.id} — status updated to PAID")
        
        return {"status": "ok"}
    
    # Handle order.paid event (common for auto-capture UPI/QR payments)
    if event == "order.paid":
        order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})
        razorpay_order_id = order_entity.get("id")
        amount_paise = order_entity.get("amount_paid", 0)
        
        # Also try to get payment info from the nested payments array
        payments_items = payload.get("payload", {}).get("payment", {}).get("entity", {})
        razorpay_payment_id = payments_items.get("id", "")
        
        logger.warning(f"Webhook order.paid: razorpay_order_id={razorpay_order_id}, payment_id={razorpay_payment_id}, amount={amount_paise}")
        
        if not razorpay_order_id:
            logger.warning("Webhook order.paid: Missing order_id")
            return {"status": "ignored", "reason": "missing data"}
        
        # Find the order by Razorpay order ID
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.payment))
            .where(Order.razorpay_order_id == razorpay_order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            logger.warning(f"Webhook order.paid: Order not found for razorpay_order_id={razorpay_order_id}")
            return {"status": "ignored", "reason": "order not found"}
        
        logger.warning(f"Webhook order.paid: Found order {order.id}, current status={order.status}")
        
        if order.status == OrderStatus.PAID:
            return {"status": "ok", "message": "already processed"}
        
        # Create payment record
        if not order.payment or order.payment.status != PaymentStatus.COMPLETED:
            if order.payment:
                await db.delete(order.payment)
                await db.flush()
            
            payment = Payment(
                order_id=order.id,
                method="razorpay",
                transaction_id=razorpay_payment_id or f"order_{razorpay_order_id}",
                razorpay_payment_id=razorpay_payment_id or "",
                amount=amount_paise / 100,
                status=PaymentStatus.COMPLETED,
            )
            db.add(payment)
            order.status = OrderStatus.PAID
            await db.commit()
            
            logger.warning(f"Webhook order.paid: ✅ Order {order.id} marked PAID")
        
        return {"status": "ok"}
    
    # For other events, just acknowledge
    logger.warning(f"Webhook: Received unhandled event '{event}', ignoring")
    return {"status": "ok", "event": event}


@router.get("/{id}", response_model=ApiResponse)
async def get_payment_by_id(id: str, db: AsyncSession = Depends(get_db), admin=Depends(get_superadmin_user)):
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
