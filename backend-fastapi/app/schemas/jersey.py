from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, Field

class CreateJerseyRequest(BaseModel):
    name: str
    player: str
    price: Decimal
    originalPrice: Optional[Decimal] = None
    image: str
    badge: Optional[str] = None
    badgeColor: Optional[str] = None

class UpdateJerseyRequest(BaseModel):
    name: Optional[str] = None
    player: Optional[str] = None
    price: Optional[Decimal] = None
    originalPrice: Optional[Decimal] = None
    image: Optional[str] = None
    badge: Optional[str] = None
    badgeColor: Optional[str] = None

class PresignedUploadRequest(BaseModel):
    fileType: Literal["design", "preview"]
    filename: str
    contentType: str
    jerseyId: Optional[int] = None


class JerseyFilterParams(BaseModel):
    minPrice: Optional[float] = Field(None, ge=0)
    maxPrice: Optional[float] = Field(None, ge=0)
    search: Optional[str] = None
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
