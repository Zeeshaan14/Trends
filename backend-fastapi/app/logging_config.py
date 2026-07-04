import logging
import sys

from pythonjsonlogger.json import JsonFormatter

from app.config import settings


def setup_logging():
    """
    Configure structured JSON logging for production and human-readable logging for development.
    Call this once at app startup (in lifespan).
    """
    root_logger = logging.getLogger()

    # Remove any existing handlers to avoid duplicate log lines
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if settings.ENVIRONMENT == "production":
        # JSON logs for production — machine-parseable by Datadog, CloudWatch, etc.
        formatter = JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
        handler.setFormatter(formatter)
        root_logger.setLevel(logging.INFO)
    else:
        # Human-readable logs for development
        formatter = logging.Formatter(
            fmt="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
            datefmt="%H:%M:%S",
        )
        handler.setFormatter(formatter)
        root_logger.setLevel(logging.DEBUG)

    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING if settings.ENVIRONMENT == "production" else logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
