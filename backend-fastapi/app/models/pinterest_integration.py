from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class PinterestIntegration(Base):
    """Holds this app's Pinterest export settings.

    Single-row table (id=1) — export_board_name is the board Pinterest's CSV
    bulk-upload tool (Settings → Import content) pins new jerseys to; it takes
    a literal board name, not an API id.
    """

    __tablename__ = "pinterest_integration"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    export_board_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
