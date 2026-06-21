from pydantic import BaseModel, Field

class AddToCartRequest(BaseModel):
    jerseyId: int
    quantity: int = Field(1, ge=1)

class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(..., ge=0)
