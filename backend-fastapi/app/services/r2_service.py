import logging
from typing import BinaryIO

import boto3
from botocore.config import Config
from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialized singleton client
_client = None


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
    Upload a file directly from FastAPI UploadFile to R2.
    
    Args:
        file: The UploadFile from the request (no temp file needed).
        file_key: The object key in R2, e.g. 'designs/42/jersey-design.zip'.
    
    Returns:
        The file_key that was uploaded.
    """
    client = get_r2_client()
    client.upload_fileobj(
        file.file,
        settings.R2_BUCKET_NAME,
        file_key,
        ExtraArgs={"ContentType": "application/zip"},
    )
    logger.info(f"Uploaded {file_key} to R2 bucket {settings.R2_BUCKET_NAME}")
    return file_key


def generate_presigned_url(file_key: str, expiry_seconds: int = 900) -> str:
    """
    Generate a presigned download URL for an R2 object.
    
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


def delete_file_from_r2(file_key: str) -> None:
    """Delete an object from R2. Used when replacing a design file."""
    client = get_r2_client()
    client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=file_key)
    logger.info(f"Deleted {file_key} from R2 bucket {settings.R2_BUCKET_NAME}")
