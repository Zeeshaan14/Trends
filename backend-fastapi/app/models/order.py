from datetime import datetime
from decimal import Decimal
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, Numeric, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base
from .enums import OrderStatus
import cuid

if TYPE_CHECKING:
    from .payment import Payment
    from .user import User
    from .jersey import Jersey

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: cuid.cuid())
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus, native_enum=False), default=OrderStatus.PENDING)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    razorpay_order_id: Mapped[Optional[str]] = mapped_column("razorpayOrderId", String, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now(), index=True)
    download_count: Mapped[int] = mapped_column("downloadCount", Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payment: Mapped[Optional["Payment"]] = relationship(back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: cuid.cuid())
    order_id: Mapped[str] = mapped_column("orderId", ForeignKey("orders.id", ondelete="CASCADE"))
    jersey_id: Mapped[int] = mapped_column("jerseyId", ForeignKey("jerseys.id"))
    quantity: Mapped[int]
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())

    order: Mapped["Order"] = relationship(back_populates="items")
    jersey: Mapped["Jersey"] = relationship(back_populates="order_items")
