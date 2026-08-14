# Claims OCR Service

Standalone FastAPI service for extracting structured claim data from documents stored in S3-compatible storage. The current scaffold includes configuration, PostgreSQL persistence, Alembic migrations, and a health endpoint. Upload and OCR routes are not implemented yet.

## Requirements

- Python 3.11 or newer
- PostgreSQL 15
- S3-compatible storage such as MinIO
- Gemini API key

The root `docker-compose.yml` provides PostgreSQL and MinIO for local development.

## Setup

From the monorepo root:

```bash
cd claims-ocr-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Update `.env` with the credentials for your environment. Never commit this file.

Once PostgreSQL is running and `DATABASE_URL` is configured, apply all pending migrations as part of setup:

```bash
alembic upgrade head
```

Confirm the database is at the latest revision:

```bash
alembic current
```

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy PostgreSQL URL, for example `postgresql+psycopg2://postgres:postgres123@localhost:5432/sentinel_mdm`. |
| `S3_ENDPOINT_URL` | S3-compatible API endpoint, such as `http://localhost:9000` for local MinIO. |
| `S3_ACCESS_KEY` | S3 or MinIO access key. |
| `S3_SECRET_KEY` | S3 or MinIO secret key. |
| `S3_BUCKET_NAME` | Bucket used for claim documents. The bucket must already exist. |
| `GEMINI_API_KEY` | Google Gemini API key used by the future OCR agent. |
| `PORT` | HTTP port. Defaults to `3003`. |

For local MinIO, the default access and secret keys in `.env.example` match the root Compose configuration. Replace all default credentials outside local development.

## Database migration

The initial migration creates the `claims_extraction` table. Apply it only when the target database is ready:

```bash
alembic upgrade head
```

To inspect the SQL without changing the database:

```bash
alembic upgrade head --sql
```

## Start locally

Activate the virtual environment and run:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 3003
```

Before accepting requests, the service runs `SELECT 1` against PostgreSQL and checks access to `S3_BUCKET_NAME`. Startup fails with a dependency-specific error if either check fails.

Check the service:

```bash
curl http://localhost:3003/health
```

Expected response:

```json
{"status":"ok"}
```

Interactive API documentation is available at `http://localhost:3003/docs`.

## Run with Docker

```bash
docker build -t claims-ocr-service .
docker run --env-file .env -p 3003:3003 claims-ocr-service
```

The service entry in the root `docker-compose.yml` is intentionally commented out for optional local use.
