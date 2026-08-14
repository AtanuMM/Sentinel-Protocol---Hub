import logging
import random
import time
from functools import lru_cache

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.config import get_settings
from app.schemas import ClaimExtractionPayload

logger = logging.getLogger(__name__)


class OCRExtractionError(Exception):
    pass


class OCRValidationError(Exception):
    pass


@lru_cache(maxsize=1)
def build_client() -> genai.Client:
    return genai.Client(api_key=get_settings().gemini_api_key)


def build_prompt() -> str:
    return """
You are classifying and extracting structured data from a scanned or
photographed Indian medical or insurance document. The document may be
handwritten, printed, or mixed, and may be in English or contain Hindi or
Bengali text.

First classify the document into exactly one document_type:
- "claim_form" for an insurance claim form
- "prescription" for a prescription or doctor note
- "other" for a clearly medical or insurance-related document that fits
  neither category, such as a discharge summary or lab report

For document_type "claim_form", populate claim_details with these six sections:
primary_insured_details, patient_hospitalized_details, hospitalization_info,
claim_expenses_summary, bank_details, and submitted_documents_checklist. Leave
prescription_details null.

For document_type "prescription", populate prescription_details with:
doctor_name, doctor_registration_no, clinic_or_hospital_name, patient_name,
patient_age, patient_gender, date_of_visit, diagnosis_or_complaint, medicines,
advice_notes, and follow_up_date. Leave claim_details null.

For medicines, extract each distinct medicine as a separate list entry with
name, dosage, frequency, duration, and notes. If dosage, frequency, or duration
is illegible for a medicine, leave only that sub-field null. Do not drop the
medicine entry and do not guess the missing value.

For document_type "other", attempt best-effort extraction into whichever of
claim_details or prescription_details fits the document better. Leave both
sections null if neither structure fits.

Extract only information that is legible and actually present in the source
document. If a field is blank, illegible, or absent, return null for that
field. Never guess, infer, or fabricate a value.

Preserve dates, times, and monetary amounts exactly as written, as strings,
even when a format is incomplete or non-standard. For example, preserve
"DD/MM/YY" if that literal text is present, and preserve partial monetary
figures. Do not normalize or reformat these values.

Set overall_confidence according to the document's overall clarity:
- "high" for clearly printed text or very legible handwriting
- "medium" when handwriting is readable with some effort
- "low" when significant portions are illegible or ambiguous

Translate non-English field values written in Hindi or Bengali into English.
If a translation is uncertain, return the original text instead of guessing.
""".strip()


def _call_gemini(
    client: genai.Client,
    model_name: str,
    local_file_path: str,
) -> ClaimExtractionPayload:
    uploaded_file = client.files.upload(file=local_file_path)
    response = client.models.generate_content(
        model=model_name,
        contents=[uploaded_file, build_prompt()],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ClaimExtractionPayload,
        ),
    )

    try:
        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            return ClaimExtractionPayload.model_validate(parsed)

        response_text = response.text
        if not response_text:
            raise ValueError("Gemini returned an empty response")
        return ClaimExtractionPayload.model_validate_json(response_text)
    except (TypeError, ValueError, ValidationError):
        raise OCRValidationError(
            f"Gemini response from model '{model_name}' failed schema validation"
        ) from None


def _is_rate_limit_error(exc: Exception) -> bool:
    return isinstance(exc, errors.APIError) and (
        exc.code == 429 or exc.status == "RESOURCE_EXHAUSTED"
    )


def _describe_error(exc: Exception) -> str:
    if isinstance(exc, errors.APIError):
        detail = exc.message or exc.status or "Gemini API request failed"
        return f"{type(exc).__name__}({exc.code}): {detail}"
    return f"{type(exc).__name__}: {exc}"


def _extract_with_model(
    client: genai.Client,
    model_name: str,
    local_file_path: str,
    max_attempts: int,
) -> ClaimExtractionPayload:
    for attempt in range(1, max_attempts + 1):
        try:
            payload = _call_gemini(client, model_name, local_file_path)
            logger.info(
                "Gemini extraction succeeded with model=%s retries=%d",
                model_name,
                attempt - 1,
            )
            return payload
        except Exception as exc:
            if not _is_rate_limit_error(exc) or attempt == max_attempts:
                raise

            delay_seconds = (2 ** (attempt - 1)) + random.uniform(0, 0.5)
            logger.warning(
                "Gemini rate limited model=%s attempt=%d/%d; retrying in %.2fs",
                model_name,
                attempt,
                max_attempts,
                delay_seconds,
            )
            time.sleep(delay_seconds)

    raise OCRExtractionError(f"No extraction attempt ran for model '{model_name}'")


def extract_claim_data(local_file_path: str) -> tuple[ClaimExtractionPayload, str]:
    settings = get_settings()
    client = build_client()
    max_attempts = max(1, settings.gemini_max_retries)
    primary_failure: Exception | None = None

    try:
        payload = _extract_with_model(
            client,
            settings.gemini_model_primary,
            local_file_path,
            max_attempts,
        )
        return payload, settings.gemini_model_primary
    except Exception as exc:
        primary_failure = exc
        logger.warning(
            "Primary Gemini model failed; switching to fallback model=%s: %s",
            settings.gemini_model_fallback,
            _describe_error(exc),
        )

    try:
        payload = _extract_with_model(
            client,
            settings.gemini_model_fallback,
            local_file_path,
            max_attempts,
        )
        return payload, settings.gemini_model_fallback
    except Exception as fallback_error:
        if primary_failure is None:
            primary_failure = OCRExtractionError("Primary model did not run")
        primary_detail = _describe_error(primary_failure)
        fallback_detail = _describe_error(fallback_error)
        raise OCRExtractionError(
            "Gemini extraction failed for both models. "
            f"Primary: {primary_detail}. Fallback: {fallback_detail}"
        ) from None
