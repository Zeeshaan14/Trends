from typing import List
from pydantic import BaseModel, EmailStr, Field

class OrderItemInput(BaseModel):
    jerseyId: int
    quantity: int = Field(..., ge=1)

class CreateOrderRequest(BaseModel):
    companyName: str
    email: EmailStr
    phone: str
    items: List[OrderItemInput] = Field(..., min_length=1)
