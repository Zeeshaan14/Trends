from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models.user import User
from app.models.enums import Role
from app.security.jwt import decode_token
from app.exceptions import ApiException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/admin/login", auto_error=False)

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not token:
        token = request.cookies.get("admin_access_token")
        
    if not token:
        raise ApiException("Not authenticated", 401)
    
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise ApiException("Invalid token type", 401)
        
    user_id = payload.get("sub")
    if not user_id:
        raise ApiException("Invalid token payload", 401)
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise ApiException("User not found", 401)
        
    return user

async def get_admin_user(
    user: User = Depends(get_current_user)
) -> User:
    if user.role != Role.ADMIN:
        raise ApiException("Admin access required", 403)
    return user
