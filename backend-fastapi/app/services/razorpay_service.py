import razorpay
import hmac
import hashlib
import logging

from app.config import settings
from app.exceptions import ApiException

logger = logging.getLogger(__name__)

# Lazy-initialized Razorpay client
_client = None


def get_razorpay_client() -> razorpay.Client:
    """Get or create the Razorpay client singleton."""
    global _client
    if _client is None:
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            logger.error("Razorpay integration error: key_id or key_secret is missing in settings")
            raise ApiException("Payment gateway credentials are not configured", 500)
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return _client


import asyncio


def _create_razorpay_order_sync(amount_inr: float, receipt: str) -> dict:
    """
    Synchronous helper — creates a Razorpay order (makes a blocking HTTP call).
    """
    amount_paise = int(round(amount_inr * 100))  # Razorpay expects paise
    
    order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,  # Auto-capture payment
    }
    
    client = get_razorpay_client()
    return client.order.create(data=order_data)


async def create_razorpay_order(amount_inr: float, receipt: str) -> dict:
    """
    Create a Razorpay order without blocking the async event loop.
    
    Args:
        amount_inr: Amount in INR (rupees). Will be converted to paise.
        receipt: Internal order ID used as receipt reference.
    
    Returns:
        Razorpay order dict containing 'id', 'amount', 'currency', etc.
    """
    return await asyncio.to_thread(_create_razorpay_order_sync, amount_inr, receipt)


def verify_payment_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    """
    Verify the payment signature using HMAC-SHA256.
    
    Razorpay sends a signature that is computed as:
    HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
    
    Returns True if the signature is valid.
    """
    try:
        client = get_razorpay_client()
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        logger.warning(
            f"Razorpay payment signature mismatch: order_id={razorpay_order_id}, payment_id={razorpay_payment_id}"
        )
        return False
    except Exception as e:
        logger.exception("Error verifying Razorpay payment signature")
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verify the webhook signature for incoming Razorpay webhooks.
    
    Args:
        body: Raw request body bytes.
        signature: The X-Razorpay-Signature header value.
    
    Returns True if the webhook signature is valid.
    """
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.error("Razorpay webhook signature verification failed: RAZORPAY_WEBHOOK_SECRET is not configured.")
        return False
    try:
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception as e:
        logger.exception("Error verifying Razorpay webhook signature")
        return False
