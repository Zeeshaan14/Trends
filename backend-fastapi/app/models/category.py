from typing import List, TYPE_CHECKING
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .jersey import Jersey

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String, primary_key=True) # nba, nfl, soccer, mlb
    name: Mapped[str] = mapped_column(String)
    image: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)

    jerseys: Mapped[List["Jersey"]] = relationship(back_populates="category")
