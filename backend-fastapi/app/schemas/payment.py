from typing import Optional
from pydantic import BaseModel

class ProcessPaymentRequest(BaseModel):
    orderId: str
    method: str
    transactionId: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    orderId: str
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str
