from datetime import datetime
from typing import List
from sqlalchemy import String, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base
import cuid

class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: cuid.cuid())
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="cart")
    items: Mapped[List["CartItem"]] = relationship(back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint('cartId', 'jerseyId', name='cart_items_cart_id_jersey_id_key'),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: cuid.cuid())
    cart_id: Mapped[str] = mapped_column("cartId", ForeignKey("carts.id", ondelete="CASCADE"))
    jersey_id: Mapped[int] = mapped_column("jerseyId", ForeignKey("jerseys.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())

    cart: Mapped["Cart"] = relationship(back_populates="items")
    jersey: Mapped["Jersey"] = relationship(back_populates="cart_items")
