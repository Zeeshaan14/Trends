from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base
from .enums import Role

import cuid

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: cuid.cuid())
    company_name: Mapped[str] = mapped_column("companyName", String)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    phone: Mapped[str] = mapped_column(String)
    role: Mapped[Role] = mapped_column(SAEnum(Role, native_enum=False), default=Role.USER)
    password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=func.now(), onupdate=func.now())

    # Relations (use string annotations to avoid circular imports)
    orders: Mapped[List["Order"]] = relationship(back_populates="user")
