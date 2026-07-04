import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models.user import User
from app.models.enums import Role
from app.schemas.auth import AdminLoginRequest, TokenResponse, RefreshTokenRequest
from app.schemas.common import ApiResponse
from app.security.passwords import verify_password, get_password_hash, is_bcrypt_hash
from app.security.jwt import create_access_token, create_refresh_token, decode_token
from app.security.rate_limit import limiter
from app.exceptions import ApiException

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/admin/login", response_model=ApiResponse[TokenResponse])
@limiter.limit("5/minute")
async def admin_login(body: AdminLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    
    if not user or user.role != Role.ADMIN:
        raise ApiException("Invalid credentials", 401)
        
    if not user.password or not verify_password(body.password, user.password):
        raise ApiException("Invalid credentials", 401)

    # Auto-rehash legacy plain-text passwords to bcrypt on successful login
    if not is_bcrypt_hash(user.password):
        logger.warning(f"Rehashing legacy plain-text password for admin user: {user.email}")
        user.password = get_password_hash(body.password)
        await db.commit()
        
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    return ApiResponse(
        success=True,
        message="Login successful",
        data=TokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user={
                "id": user.id,
                "email": user.email,
                "companyName": user.company_name,
                "role": user.role
            }
        )
    )

@router.post("/refresh", response_model=ApiResponse[TokenResponse])
@limiter.limit("10/minute")
async def refresh_token(body: RefreshTokenRequest, request: Request, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refreshToken)
    if payload.get("type") != "refresh":
        raise ApiException("Invalid token type", 401)
        
    user_id = payload.get("sub")
    if not user_id:
        raise ApiException("Invalid token payload", 401)
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise ApiException("User not found", 401)
        
    access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)
    
    return ApiResponse(
        success=True,
        data=TokenResponse(
            accessToken=access_token,
            refreshToken=new_refresh_token,
            user={
                "id": user.id,
                "email": user.email,
                "companyName": user.company_name,
                "role": user.role
            }
        )
    )
