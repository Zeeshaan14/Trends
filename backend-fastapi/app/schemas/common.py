from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel, Field

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[str] = None

class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    totalPages: int

class PaginatedResponse(ApiResponse[T]):
    pagination: PaginationMeta
