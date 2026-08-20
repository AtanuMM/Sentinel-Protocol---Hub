import logging
import time
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import ocr_agent, s3_client
from app.db import get_db
from app.models import ClaimsExtraction
from app.schemas import ClaimExtractionResult, ExtractionSummary

logger = logging.getLogger(__name__)
router = APIRouter(tags=["processing"])


def _mark_failed(
    db: Session,
    extraction: ClaimsExtraction,
    error_message: str,
) -> None:
    extraction.status = "FAILED"
    extraction.error_message = error_message
    extraction.retry_count = (extraction.retry_count or 0) + 1
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record the processing failure",
        ) from None


def _existing_row_response(extraction: ClaimsExtraction) -> dict[str, object]:
    return {
        "note": (
            "Claim was already processed; existing data returned without "
            "running extraction again."
        ),
        "id": extraction.id,
        "s3_url": extraction.s3_url,
        "original_filename": extraction.original_filename,
        "status": extraction.status,
        "extracted_json": extraction.extracted_json,
        "model_used": extraction.model_used,
        "error_message": extraction.error_message,
        "retry_count": extraction.retry_count,
        "processing_ms": extraction.processing_ms,
        "created_at": extraction.created_at,
        "updated_at": extraction.updated_at,
    }


@router.post("/process/{claim_id}", response_model=None)
def process_claim(
    claim_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    force: Annotated[bool, Query()] = False,
) -> ClaimExtractionResult | dict[str, object]:
    extraction = db.get(ClaimsExtraction, claim_id)
    if extraction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim '{claim_id}' was not found",
        )

    if extraction.status == "PROCESSED" and not force:
        return _existing_row_response(extraction)

    extraction.status = "PROCESSING"
    extraction.error_message = None
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark claim as processing",
        ) from None

    local_file_path: str | None = None
    try:
        s3_key = s3_client.s3_key_from_url(extraction.s3_url)
        local_file_path = s3_client.download_to_temp(s3_key)

        started_at = time.perf_counter()
        payload, model_used = ocr_agent.extract_claim_data(local_file_path)
        processing_ms = int(round((time.perf_counter() - started_at) * 1000))
    except (ocr_agent.OCRExtractionError, ocr_agent.OCRValidationError) as exc:
        _mark_failed(db, extraction, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OCR extraction failed: {exc}",
        ) from None
    except s3_client.S3DownloadError as exc:
        _mark_failed(db, extraction, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"S3 download failed: {exc}",
        ) from None
    finally:
        if local_file_path is not None:
            try:
                s3_client.delete_local_file(local_file_path)
            except OSError:
                logger.warning(
                    "Failed to delete local processing file: %s",
                    local_file_path,
                )

    extraction.status = "PROCESSED"
    extraction.extracted_json = payload.model_dump(mode="json")
    extraction.model_used = model_used
    extraction.error_message = None
    extraction.processing_ms = processing_ms
    try:
        db.commit()
        db.refresh(extraction)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save extraction result",
        ) from None

    summary = ExtractionSummary(
        file_name=extraction.original_filename,
        status="PROCESSED",
        extraction_timestamp=datetime.now(timezone.utc),
    )
    return ClaimExtractionResult(
        extraction_summary=summary,
        extraction_data=payload,
    )
