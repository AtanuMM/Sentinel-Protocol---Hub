import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote, unquote
from uuid import uuid4

import boto3
from boto3.s3.transfer import S3UploadFailedError
from botocore.client import BaseClient
from botocore.exceptions import BotoCoreError, ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
TMP_DIR = Path(__file__).resolve().parent.parent / "tmp"


class S3UploadError(Exception):
    pass


class S3DownloadError(Exception):
    pass


@lru_cache(maxsize=1)
def get_s3_client() -> BaseClient:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name="us-east-1",
    )


def ensure_bucket_exists() -> None:
    settings = get_settings()
    client = get_s3_client()

    try:
        client.head_bucket(Bucket=settings.s3_bucket_name)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket_name)


def upload_file(local_path: str, original_filename: str) -> tuple[str, str]:
    settings = get_settings()
    safe_filename = Path(original_filename).name
    date_prefix = datetime.now(timezone.utc).date().isoformat()
    s3_key = f"claims-ocr/{date_prefix}/{uuid4()}/{safe_filename}"

    try:
        get_s3_client().upload_file(local_path, settings.s3_bucket_name, s3_key)
    except (BotoCoreError, ClientError, OSError, S3UploadFailedError):
        raise S3UploadError(f"Failed to upload '{safe_filename}'") from None

    encoded_key = quote(s3_key, safe="/")
    endpoint = settings.s3_endpoint_url.rstrip("/")
    s3_url = f"{endpoint}/{settings.s3_bucket_name}/{encoded_key}"
    return s3_key, s3_url


def download_to_temp(s3_key: str) -> str:
    settings = get_settings()
    extension = Path(s3_key).suffix
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    local_path = TMP_DIR / f"{uuid4()}{extension}"

    try:
        get_s3_client().download_file(settings.s3_bucket_name, s3_key, str(local_path))
    except (BotoCoreError, ClientError, OSError):
        local_path.unlink(missing_ok=True)
        raise S3DownloadError(f"Failed to download S3 object '{s3_key}'") from None

    return str(local_path)


def s3_key_from_url(s3_url: str) -> str:
    settings = get_settings()
    expected_prefix = (
        f"{settings.s3_endpoint_url.rstrip('/')}/{settings.s3_bucket_name}/"
    )
    if not s3_url.startswith(expected_prefix):
        raise S3DownloadError("Stored S3 URL does not match the configured bucket")

    s3_key = unquote(s3_url.removeprefix(expected_prefix))
    if not s3_key:
        raise S3DownloadError("Stored S3 URL does not contain an object key")
    return s3_key


def delete_local_file(local_path: str) -> None:
    try:
        Path(local_path).unlink()
    except FileNotFoundError:
        logger.warning("Local temp file already absent: %s", local_path)
