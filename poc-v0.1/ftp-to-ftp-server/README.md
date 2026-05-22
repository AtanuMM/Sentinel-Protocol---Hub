# FTP-to-FTP ingestion microservice

Standalone Fastify app for the **FTP-to-FTP** pipeline only (MinIO webhook, integration, provisioning, feed). Same Controller → Service → Repository layout as the legacy monolith.

## Run locally

```bash
npm install
cp .env.example .env   # edit values; `PORT` controls the listen port
npm run dev
```

Listen port comes from **`PORT` in `.env`** (see [`.env.example`](.env.example), default **3000** if unset or empty).

**`GET /api/ping`** includes **`"service":"ftp-to-ftp-server"`** so you can tell this apart from the email microservice (which has no `/api/email-to-ftp/*` routes).

## Environment

Uses the same variables as the original ingestion backend: `DB_URL`, `REDIS_URL`, `KAFKA_*`, MinIO, `LANDING_BUCKET`, `INGESTION_TOPIC`, `WEBHOOK_SECRET`, `APP_ENCRYPTION_KEY`, etc. See [`src/config/index.ts`](src/config/index.ts).

## Database migrations

Identical Sequelize migrations live in `migrations/`. Run **`npm run db:migrate`** from this folder **or** from [`email-to-ftp-server`](../email-to-ftp-server)—do not maintain divergent migration files.

## API

- Swagger UI: `/documentation` (non-production by default)
- OpenAPI JSON: `/openapi.json` when Swagger UI is disabled

Webhook: `POST /api/webhook` (unchanged from monolith).

**Which process is this?** `GET /api/_sentinel` returns JSON with `"service":"ftp-to-ftp-server"`. If you need email APIs (`/api/email-to-ftp/...`), run **`email-to-ftp-server`** on another `PORT`.

## TPA admin (`tpa-react-admin-poc`)

FTP and health-style checks use **`VITE_INGESTION_FTP_URL`** (default `http://localhost:3000`). Email routes use **`VITE_INGESTION_EMAIL_URL`** when set; otherwise they follow the FTP URL (works with the legacy monolith on one port).
