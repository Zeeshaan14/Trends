from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.config import settings
from app.db import engine
from app.exceptions import ApiException, api_exception_handler, generic_exception_handler
from app.security.headers import secure_headers
from app.security.rate_limit import limiter
from app.logging_config import setup_logging

from app.routers import (
    auth, jerseys, orders, payments, admin
)

import logging

logger = logging.getLogger("startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Configure structured logging
    setup_logging()

    logger.warning("=" * 80)
    logger.warning("APPLICATION STARTUP")
    logger.warning(f"ENVIRONMENT = {settings.ENVIRONMENT}")

    logger.warning("Environment Variable Status:")
    logger.warning(f"SECRET_KEY: {bool(settings.SECRET_KEY)}")
    logger.warning(f"DATABASE_URL: {bool(settings.DATABASE_URL)}")
    logger.warning(f"RAZORPAY_KEY_ID: {bool(settings.RAZORPAY_KEY_ID)}")
    logger.warning(f"RAZORPAY_KEY_SECRET: {bool(settings.RAZORPAY_KEY_SECRET)}")
    logger.warning(f"R2_ACCESS_KEY_ID: {bool(settings.R2_ACCESS_KEY_ID)}")
    logger.warning(f"R2_SECRET_ACCESS_KEY: {bool(settings.R2_SECRET_ACCESS_KEY)}")
    logger.warning(f"R2_ENDPOINT: {bool(settings.R2_ENDPOINT)}")
    logger.warning(f"R2_ACCOUNT_ID: {bool(settings.R2_ACCOUNT_ID)}")
    logger.warning(f"R2_BUCKET_NAME: {bool(settings.R2_BUCKET_NAME)}")
    logger.warning("=" * 80)

    # Validate critical environment variables in production
    if settings.ENVIRONMENT == "production":
        missing_vars = []

        if not settings.SECRET_KEY or settings.SECRET_KEY == "your-super-secret-key-change-this-in-production":
            missing_vars.append("SECRET_KEY")

        if not settings.DATABASE_URL:
            missing_vars.append("DATABASE_URL")

        if not settings.RAZORPAY_KEY_ID:
            missing_vars.append("RAZORPAY_KEY_ID")

        if not settings.RAZORPAY_KEY_SECRET:
            missing_vars.append("RAZORPAY_KEY_SECRET")

        if (
            not settings.R2_ACCESS_KEY_ID
            or not settings.R2_SECRET_ACCESS_KEY
            or not settings.R2_ENDPOINT
        ):
            missing_vars.append("R2 Credentials/Endpoint")

        if missing_vars:
            logger.error(f"Missing variables: {missing_vars}")

            raise RuntimeError(
                f"Startup failed. Missing critical environment variables for production: {', '.join(missing_vars)}"
            )

    yield

    # Cleanup
    await engine.dispose()
is_prod = settings.ENVIRONMENT == "production"
app = FastAPI(
    title="Trends API",
    description="FastAPI rewrite of the Express.js backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json"
)

class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                from fastapi import Response
                res = Response()
                secure_headers.set_headers(res)
                headers = list(message.get("headers", []))
                for k, v in res.headers.items():
                    if k.lower() != "content-length":
                        headers.append((k.lower().encode("utf-8"), v.encode("utf-8")))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)

app.add_middleware(SecurityHeadersMiddleware)

# Rate Limiting
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CORS must be the outermost middleware so preflight requests are handled first
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Allow any localhost port in dev for hot-reload convenience; disabled in production
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$" if not is_prod else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Exception Handlers
app.add_exception_handler(ApiException, api_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
if is_prod:
    app.add_exception_handler(Exception, generic_exception_handler)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

app.include_router(jerseys.router, prefix="/api/jerseys", tags=["Jerseys"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db

@app.get("/api/health")
@app.get("/")
@limiter.exempt
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected", "message": "Server is healthy 🚀"}
    except Exception:
        import logging
        logging.getLogger("app.main").exception("Health check database connection failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected", "error": "Database query failed"}
        )
