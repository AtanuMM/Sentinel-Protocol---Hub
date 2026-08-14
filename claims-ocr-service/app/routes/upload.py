from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import s3_client
from app.db import get_db
from app.models import ClaimsExtraction
from app.schemas import UploadResponse

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
}
MAX_FILE_SIZE = 15 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024

router = APIRouter(tags=["uploads"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
def upload_claim(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
) -> ClaimsExtraction:
    content_type = file.content_type or "unknown"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type: {content_type}. "
                "Allowed: PDF, JPEG, PNG."
            ),
        )

    original_filename = Path(file.filename or "upload").name or "upload"
    extension = Path(original_filename).suffix
    local_path: Path | None = None

    try:
        s3_client.TMP_DIR.mkdir(parents=True, exist_ok=True)
        local_path = s3_client.TMP_DIR / f"{uuid4()}{extension}"

        total_size = 0
        with local_path.open("wb") as destination:
            while chunk := file.file.read(CHUNK_SIZE):
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="File exceeds 15MB limit",
                    )
                destination.write(chunk)

        _, s3_url = s3_client.upload_file(str(local_path), original_filename)
        s3_client.delete_local_file(str(local_path))
        local_path = None

        extraction = ClaimsExtraction(
            s3_url=s3_url,
            original_filename=original_filename,
            status="UPLOADED",
        )
        db.add(extraction)
        db.commit()
        db.refresh(extraction)
        return extraction
    except HTTPException:
        db.rollback()
        raise
    except s3_client.S3UploadError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file to S3",
        ) from None
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save upload record",
        ) from None
    except OSError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process uploaded file",
        ) from None
    finally:
        file.file.close()
        if local_path is not None:
            s3_client.delete_local_file(str(local_path))
