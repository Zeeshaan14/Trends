from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.cart import Cart, CartItem
from app.models.jersey import Jersey
from app.schemas.cart import AddToCartRequest, UpdateCartItemRequest
from app.schemas.common import ApiResponse
from app.dependencies.auth import get_current_user
from app.exceptions import ApiException

router = APIRouter()

@router.get("", response_model=ApiResponse)
async def get_cart(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items).selectinload(CartItem.jersey))
        .where(Cart.user_id == user.id)
    )
    cart = result.scalar_one_or_none()
    
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
        items = []
    else:
        items = cart.items
        
    subtotal = sum([float(item.jersey.price) * item.quantity for item in items])
    item_count = sum([item.quantity for item in items])
    
    return ApiResponse(
        success=True,
        data={
            "id": cart.id,
            "userId": cart.user_id,
            "items": [
                {
                    "id": item.id,
                    "cartId": item.cart_id,
                    "jerseyId": item.jersey_id,
                    "quantity": item.quantity,
                    "jersey": {
                        "id": item.jersey.id,
                        "name": item.jersey.name,
                        "price": float(item.jersey.price),
                        "image": item.jersey.image
                    }
                } for item in items
            ],
            "subtotal": subtotal,
            "itemCount": item_count
        }
    )

@router.post("/items", response_model=ApiResponse, status_code=201)
async def add_to_cart(
    request: AddToCartRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    result = await db.execute(select(Cart).where(Cart.user_id == user.id))
    cart = result.scalar_one_or_none()
    
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
        
    # check existing
    result = await db.execute(
        select(CartItem)
        .where(CartItem.cart_id == cart.id, CartItem.jersey_id == request.jerseyId)
    )
    cart_item = result.scalar_one_or_none()
    
    if cart_item:
        cart_item.quantity += request.quantity
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            jersey_id=request.jerseyId,
            quantity=request.quantity
        )
        db.add(cart_item)
        
    await db.commit()
    await db.refresh(cart_item)
    
    return ApiResponse(
        success=True,
        message="Item added to cart",
        data={
            "id": cart_item.id,
            "cartId": cart_item.cart_id,
            "jerseyId": cart_item.jersey_id,
            "quantity": cart_item.quantity
        }
    )

@router.patch("/items/{id}", response_model=ApiResponse)
async def update_cart_item(
    id: str,
    request: UpdateCartItemRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    # Verify cart belongs to user
    result = await db.execute(
        select(CartItem)
        .join(Cart)
        .where(CartItem.id == id, Cart.user_id == user.id)
    )
    cart_item = result.scalar_one_or_none()
    
    if not cart_item:
        raise ApiException("Cart item not found", 404)
        
    if request.quantity <= 0:
        await db.delete(cart_item)
        await db.commit()
        return ApiResponse(success=True, message="Item removed from cart")
        
    cart_item.quantity = request.quantity
    await db.commit()
    
    return ApiResponse(
        success=True,
        data={
            "id": cart_item.id,
            "quantity": cart_item.quantity
        }
    )

@router.delete("/items/{id}", response_model=ApiResponse)
async def remove_from_cart(
    id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    result = await db.execute(
        select(CartItem)
        .join(Cart)
        .where(CartItem.id == id, Cart.user_id == user.id)
    )
    cart_item = result.scalar_one_or_none()
    
    if cart_item:
        await db.delete(cart_item)
        await db.commit()
        
    return ApiResponse(success=True, message="Item removed from cart")

@router.delete("", response_model=ApiResponse)
async def clear_cart(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(select(Cart).where(Cart.user_id == user.id))
    cart = result.scalar_one_or_none()
    
    if cart:
        await db.execute(CartItem.__table__.delete().where(CartItem.cart_id == cart.id))
        await db.commit()
        
    return ApiResponse(success=True, message="Cart cleared")
