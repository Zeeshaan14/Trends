import razorpay
import hmac
import hashlib

from app.config import settings

# Initialize Razorpay client
client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_razorpay_order(amount_inr: float, receipt: str) -> dict:
    """
    Create a Razorpay order.
    
    Args:
        amount_inr: Amount in INR (rupees). Will be converted to paise.
        receipt: Internal order ID used as receipt reference.
    
    Returns:
        Razorpay order dict containing 'id', 'amount', 'currency', etc.
    """
    amount_paise = int(round(amount_inr * 100))  # Razorpay expects paise
    
    order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,  # Auto-capture payment
    }
    
    return client.order.create(data=order_data)


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
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verify the webhook signature for incoming Razorpay webhooks.
    
    Args:
        body: Raw request body bytes.
        signature: The X-Razorpay-Signature header value.
    
    Returns True if the webhook signature is valid.
    """
    try:
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False
