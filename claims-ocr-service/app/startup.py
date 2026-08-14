import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import engine
from app.errors import AppError


def verify_database_connection() -> None:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise AppError(
            503,
            "PostgreSQL connection check failed",
            "DATABASE_UNAVAILABLE",
        ) from exc


def verify_s3_connection() -> None:
    settings = get_settings()
    client = None

    try:
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
        )
        client.head_bucket(Bucket=settings.s3_bucket_name)
    except (BotoCoreError, ClientError, ValueError) as exc:
        raise AppError(
            503,
            f"S3 connection check failed for bucket '{settings.s3_bucket_name}'",
            "S3_UNAVAILABLE",
        ) from exc
    finally:
        if client is not None:
            client.close()
