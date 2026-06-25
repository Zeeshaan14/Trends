from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base
from .enums import PaymentStatus
import cuid

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: cuid.cuid())
    order_id: Mapped[str] = mapped_column("orderId", ForeignKey("orders.id", ondelete="CASCADE"), unique=True)
    method: Mapped[str] = mapped_column(String)
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus, native_enum=False), default=PaymentStatus.PENDING)
    transaction_id: Mapped[Optional[str]] = mapped_column("transactionId", String, nullable=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column("razorpayPaymentId", String, nullable=True)
    razorpay_signature: Mapped[Optional[str]] = mapped_column("razorpaySignature", String, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=func.now(), onupdate=func.now())

    order: Mapped["Order"] = relationship(back_populates="payment")
