from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ClaimsExtraction
from app.schemas import (
    ClaimExtractionPayload,
    ClaimExtractionResult,
    ClaimListItem,
    ClaimListResponse,
    ExtractionSummary,
)

ClaimStatus = Literal["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"]

router = APIRouter(tags=["claims"])


@router.get("/claims", response_model=ClaimListResponse)
def list_claims(
    db: Annotated[Session, Depends(get_db)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    claim_status: Annotated[ClaimStatus | None, Query(alias="status")] = None,
) -> ClaimListResponse:
    filters = []
    if claim_status is not None:
        filters.append(ClaimsExtraction.status == claim_status)

    total_statement = select(func.count()).select_from(ClaimsExtraction).where(*filters)
    total = db.scalar(total_statement) or 0

    claims_statement = (
        select(ClaimsExtraction)
        .where(*filters)
        .order_by(ClaimsExtraction.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    claims = db.scalars(claims_statement).all()

    items = []
    for claim in claims:
        extracted_json = claim.extracted_json or {}
        document_type = extracted_json.get("document_type")
        overall_confidence = extracted_json.get("overall_confidence")
        items.append(
            ClaimListItem(
                id=claim.id,
                original_filename=claim.original_filename,
                s3_url=claim.s3_url,
                status=claim.status,
                document_type=(
                    document_type if isinstance(document_type, str) else None
                ),
                overall_confidence=(
                    overall_confidence
                    if isinstance(overall_confidence, str)
                    else None
                ),
                model_used=claim.model_used,
                created_at=claim.created_at,
            )
        )

    return ClaimListResponse(items=items, total=total)


@router.get("/claims/{claim_id}", response_model=None)
def get_claim(
    claim_id: UUID,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object | None]:
    claim = db.get(ClaimsExtraction, claim_id)
    if claim is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Claim '{claim_id}' was not found",
        )

    response: dict[str, object | None] = {
        "id": claim.id,
        "status": claim.status,
        "original_filename": claim.original_filename,
        "s3_url": claim.s3_url,
        "error_message": (
            claim.error_message if claim.status == "FAILED" else None
        ),
        "extraction_summary": None,
        "extraction_data": None,
    }
    if claim.status != "PROCESSED":
        return response

    try:
        extraction_data = ClaimExtractionPayload.model_validate(
            claim.extracted_json
        )
    except ValidationError:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored extraction data is invalid",
        ) from None

    result = ClaimExtractionResult(
        extraction_summary=ExtractionSummary(
            file_name=claim.original_filename,
            status=claim.status,
            extraction_timestamp=claim.created_at,
        ),
        extraction_data=extraction_data,
    )
    response["extraction_summary"] = result.extraction_summary
    response["extraction_data"] = result.extraction_data
    return response
