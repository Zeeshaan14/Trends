from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base

if TYPE_CHECKING:
    from .order import OrderItem

class Jersey(Base):
    __tablename__ = "jerseys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String)
    player: Mapped[str] = mapped_column(String)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    original_price: Mapped[Optional[Decimal]] = mapped_column("originalPrice", Numeric(10, 2), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column("reviewCount", Integer, default=0)
    image: Mapped[str] = mapped_column(String)
    r2_file_key: Mapped[Optional[str]] = mapped_column("r2FileKey", String, nullable=True)
    badge: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    badge_color: Mapped[Optional[str]] = mapped_column("badgeColor", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=func.now(), onupdate=func.now())

    order_items: Mapped[List["OrderItem"]] = relationship(
        back_populates="jersey",
        passive_deletes=True,
    )
