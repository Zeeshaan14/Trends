from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.db import engine
from app.exceptions import ApiException, api_exception_handler, generic_exception_handler
from app.security.headers import secure_headers
from app.security.rate_limit import limiter

from app.routers import (
    auth, categories, jerseys, cart, orders, payments, admin
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB connections etc if needed
    yield
    # Cleanup
    await engine.dispose()

app = FastAPI(
    title="Trends API",
    description="FastAPI rewrite of the Express.js backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs"
)

# Security Headers Middleware
@app.middleware("http")
async def set_secure_headers(request, call_next):
    response = await call_next(request)
    secure_headers.set_headers(response)
    return response

# CORS Middleware
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Exception Handlers
app.add_exception_handler(ApiException, api_exception_handler)
# app.add_exception_handler(Exception, generic_exception_handler)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(jerseys.router, prefix="/api/jerseys", tags=["Jerseys"])
app.include_router(cart.router, prefix="/api/cart", tags=["Cart"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

@app.get("/api/health")
@app.get("/")
async def health_check():
    return {"message": "Server is healthy 🚀"}
