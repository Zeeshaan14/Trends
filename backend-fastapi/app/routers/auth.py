from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models.user import User
from app.models.enums import Role
from app.schemas.auth import RegisterUserRequest, AdminLoginRequest, TokenResponse, RefreshTokenRequest
from app.schemas.common import ApiResponse
from app.security.passwords import verify_password
from app.security.jwt import create_access_token, create_refresh_token, decode_token
from app.exceptions import ApiException

router = APIRouter()

@router.post("/register", response_model=ApiResponse[TokenResponse], status_code=201)
async def register(request: RegisterUserRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            company_name=request.companyName,
            email=request.email,
            phone=request.phone,
            role=Role.USER
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    return ApiResponse(
        success=True,
        message="User registered successfully" if not user.id else "User found",
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

@router.post("/admin/login", response_model=ApiResponse[TokenResponse])
async def admin_login(request: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or user.role != Role.ADMIN:
        raise ApiException("Invalid credentials", 401)
        
    if not user.password or not verify_password(request.password, user.password):
        raise ApiException("Invalid credentials", 401)
        
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
async def refresh_token(request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(request.refreshToken)
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

@router.get("/users/{id}", response_model=ApiResponse)
async def get_user(id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.orders).selectinload(User.orders.property.mapper.class_.items).selectinload(User.orders.property.mapper.class_.items.property.mapper.class_.jersey),
            selectinload(User.orders).selectinload(User.orders.property.mapper.class_.payment)
        )
        .where(User.id == id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise ApiException("User not found", 404)
        
    # We will need to serialize this properly. SQLAlchemy models aren't directly pydantic serializable without from_attributes.
    # For now, we return the object and let FastAPI serialize it if ORM mode is on in schemas (which we don't have yet).
    # Since we are returning dynamic dicts, let's construct it:
    
    # We'll rely on a simple dict conversion or rely on pydantic schemas. 
    # To keep it simple and preserve the exact shape:
    orders = []
    for order in user.orders:
        orders.append({
            "id": order.id,
            "status": order.status,
            "total": float(order.total),
            "items": [{"jersey": {"id": item.jersey.id, "name": item.jersey.name, "image": item.jersey.image}, "quantity": item.quantity} for item in order.items],
            "payment": {"id": order.payment.id, "status": order.payment.status} if order.payment else None
        })
        
    return ApiResponse(
        success=True,
        data={
            "id": user.id,
            "email": user.email,
            "companyName": user.company_name,
            "phone": user.phone,
            "role": user.role,
            "orders": orders
        }
    )
