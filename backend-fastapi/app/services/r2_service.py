import logging
import asyncio
from typing import BinaryIO

import boto3
from botocore.config import Config
from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialized singleton client
_client = None

# Allowed image MIME types for preview images
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/avif",
}


def get_r2_client():
    """Get or create a boto3 S3 client pointing at Cloudflare R2."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )
    return _client


async def upload_file_to_r2(file: UploadFile, file_key: str) -> str:
    """
    Upload a file directly from FastAPI UploadFile to R2 in a non-blocking thread.
    
    Args:
        file: The UploadFile from the request.
        file_key: The object key in R2, e.g. 'designs/42/jersey-design.zip'.
    
    Returns:
        The file_key that was uploaded.
    """
    client = get_r2_client()
    await asyncio.to_thread(
        client.upload_fileobj,
        file.file,
        settings.R2_BUCKET_NAME,
        file_key,
        ExtraArgs={"ContentType": "application/zip"},
    )
    logger.info(f"Uploaded {file_key} to R2 bucket {settings.R2_BUCKET_NAME}")
    return file_key


async def upload_preview_image_to_r2(file: UploadFile, file_key: str) -> str:
    """
    Upload a preview image (JPG/PNG/WEBP/etc.) to R2 for public access in a non-blocking thread.

    Args:
        file: The UploadFile from the request.
        file_key: The object key in R2, e.g. 'previews/42/jersey.jpg'.

    Returns:
        The public URL of the uploaded image.
    """
    content_type = file.content_type or "image/jpeg"
    client = get_r2_client()
    await asyncio.to_thread(
        client.upload_fileobj,
        file.file,
        settings.R2_BUCKET_NAME,
        file_key,
        ExtraArgs={
            "ContentType": content_type,
            "CacheControl": "public, max-age=31536000",  # 1 year cache for public images
        },
    )
    logger.info(f"Uploaded preview image {file_key} to R2 bucket {settings.R2_BUCKET_NAME}")
    return get_public_preview_url(file_key)


def get_public_preview_url(file_key: str) -> str:
    """
    Build the public URL for a preview image stored in R2.

    Args:
        file_key: The object key in R2, e.g. 'previews/42/jersey.jpg'.

    Returns:
        Full public URL string.
    """
    base = settings.R2_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/{file_key}"


def generate_presigned_upload_url(
    file_key: str,
    content_type: str,
    expiry_seconds: int = 900,
) -> str:
    """Generate a presigned PUT URL so clients can upload directly to R2."""
    client = get_r2_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=expiry_seconds,
    )


async def copy_r2_object(source_key: str, dest_key: str, content_type: str | None = None) -> str:
    """Copy an object within the same R2 bucket."""
    client = get_r2_client()
    copy_kwargs = {
        "Bucket": settings.R2_BUCKET_NAME,
        "Key": dest_key,
        "CopySource": {"Bucket": settings.R2_BUCKET_NAME, "Key": source_key},
    }
    if content_type:
        copy_kwargs["ContentType"] = content_type
    await asyncio.to_thread(client.copy_object, **copy_kwargs)
    logger.info(f"Copied R2 object from {source_key} to {dest_key}")
    return dest_key


def generate_presigned_url(file_key: str, expiry_seconds: int = 900) -> str:
    """
    Generate a presigned download URL for an R2 object.
    (Cryptographic signature generated locally, no blocking network calls).
    
    Args:
        file_key: The object key in R2.
        expiry_seconds: URL validity in seconds. Default: 900 (15 minutes).
    
    Returns:
        A presigned URL string.
    """
    client = get_r2_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": file_key},
        ExpiresIn=expiry_seconds,
    )
    return url


async def delete_file_from_r2(file_key: str) -> None:
    """Delete an object from R2 in a non-blocking thread."""
    client = get_r2_client()
    await asyncio.to_thread(client.delete_object, Bucket=settings.R2_BUCKET_NAME, Key=file_key)
    logger.info(f"Deleted {file_key} from R2 bucket {settings.R2_BUCKET_NAME}")


async def delete_preview_image_from_r2(file_key: str) -> None:
    """Delete a preview image object from R2 in a non-blocking thread."""
    client = get_r2_client()
    await asyncio.to_thread(client.delete_object, Bucket=settings.R2_BUCKET_NAME, Key=file_key)
    logger.info(f"Deleted preview image {file_key} from R2 bucket {settings.R2_BUCKET_NAME}")
