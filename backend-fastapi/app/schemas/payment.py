from typing import Optional
from pydantic import BaseModel

class ProcessPaymentRequest(BaseModel):
    orderId: str
    method: str
    transactionId: Optional[str] = None
