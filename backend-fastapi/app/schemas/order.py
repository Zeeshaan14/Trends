from typing import List
from pydantic import BaseModel, EmailStr, Field

class OrderItemInput(BaseModel):
    jerseyId: int
    quantity: int = Field(..., ge=1)

import re
from pydantic import field_validator

class CreateOrderRequest(BaseModel):
    companyName: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    items: List[OrderItemInput] = Field(..., min_length=1)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Strip all formatting characters, leaving only digits and optionally +
        cleaned = re.sub(r"[^\d+]", "", v)
        if len(cleaned) < 10 or len(cleaned) > 15:
            raise ValueError("Phone number must have between 10 and 15 digits")
        return cleaned

class DownloadDesignRequest(BaseModel):
    email: EmailStr
