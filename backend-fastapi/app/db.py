from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings

import urllib.parse
db_url = settings.DATABASE_URL

# Safely parse and modify the connection string
parsed = urllib.parse.urlsplit(db_url)

# Remove all query parameters since asyncpg doesn't support Neon's extra params
# like sslmode or channel_binding via the URL string natively.
parsed = parsed._replace(query="")

# Handle asyncpg scheme prefix
if parsed.scheme == 'postgres' or parsed.scheme == 'postgresql':
    parsed = parsed._replace(scheme='postgresql+asyncpg')
elif parsed.scheme == 'sqlite':
    parsed = parsed._replace(scheme='sqlite+aiosqlite')

db_url = urllib.parse.urlunsplit(parsed)

engine = create_async_engine(
    db_url,
    echo=settings.ENVIRONMENT == "development",
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args={"ssl": "require"} if "neon.tech" in settings.DATABASE_URL else {}
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
