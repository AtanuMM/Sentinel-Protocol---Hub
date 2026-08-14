from pathlib import Path

from app.ocr_agent import extract_claim_data

pdf_path = Path("/home/lp-55/Documents/Prescriptions/prescription-3.jpg")  # or .jpg
payload, model_used = extract_claim_data(str(pdf_path))

print(f"Model used: {model_used}")
print(payload.model_dump_json(indent=2))
