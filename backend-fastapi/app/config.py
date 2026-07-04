import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "https://nujerseys.com,"
        "https://www.nujerseys.com,"
        "https://nu-jerseys.vercel.app"
    )
    ENVIRONMENT: str = "development"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    MAX_DOWNLOAD_COUNT: int = 10

    # Cloudflare R2
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_ACCOUNT_ID: str = ""
    R2_BUCKET_NAME: str = "jersey-designs"
    R2_ENDPOINT: str = ""
    # Public base URL for preview images (e.g. https://pub-xxx.r2.dev or https://cdn.nujerseys.com)
    R2_PUBLIC_BASE_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
