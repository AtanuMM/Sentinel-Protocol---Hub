import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routes import router
from app.routes.upload import router as upload_router
from app.s3_client import ensure_bucket_exists
from app.startup import verify_database_connection

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("Checking PostgreSQL connection")
    verify_database_connection()
    logger.info("PostgreSQL connection established")

    logger.info("Ensuring S3 bucket is available")
    ensure_bucket_exists()
    logger.info("S3 bucket is available")

    yield


app = FastAPI(title="Claims OCR Service", lifespan=lifespan)
app.include_router(router)
app.include_router(upload_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
