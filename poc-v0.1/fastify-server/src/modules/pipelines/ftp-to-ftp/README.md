# Pipeline: FTP-to-FTP

This folder contains all code specific to the **FTP-to-FTP ingestion pipeline**:
files land in an external S3/MinIO-compatible bucket (the TPA's "source bucket",
acting as the FTP drop zone) and are forwarded to the Sentinel landing bucket
for downstream processing.

Source zone -> Sentinel landing zone, with no other protocols involved.

## Endpoints owned by this pipeline

All paths below are registered through [`index.ts`](./index.ts) and remain
unchanged from the pre-grouping layout.

| Endpoint           | Module         | Purpose                                                |
|--------------------|----------------|--------------------------------------------------------|
| `POST /api/link-bucket`   | `integration`  | Persist TPA credentials and initialize org hierarchy.  |
| `POST /api/onboard-org`   | `provisioning` | Onboard an organisation (idempotent hierarchy check).  |
| `POST /api/init-today`    | `provisioning` | Create the daily date-partition `.sentinel_ready` marker. |
| `GET  /api/live-feed`     | `feed`         | Return the most recent ingestion channels.             |
| `POST /api/webhook`       | `ingestion`    | MinIO S3 event webhook (HMAC-verified).                |

## Folder layout

```
ftp-to-ftp/
  index.ts              -> registerFtpToFtpPipeline(app)
  integration/          -> /api/link-bucket
  provisioning/         -> /api/onboard-org, /api/init-today
  feed/                 -> /api/live-feed
  ingestion/            -> /api/webhook
  types/
    webhook.ts          -> MinIO S3 event payload shape (pipeline-local)
```

## What is shared vs pipeline-local

**Pipeline-local** (lives in this folder, safe to change without affecting other pipelines):

- Route/controller/service/schema files for the five endpoints above.
- `types/webhook.ts` — MinIO S3 event shape is specific to this pipeline's
  source adapter.

**Shared** (lives outside `pipelines/`, reused by every pipeline):

- `src/config/` — env-backed configuration.
- `src/infra/` — MinIO, Redis, Kafka, and Sequelize clients.
- `src/models/ingestionChannel.model.ts` and
  `src/repositories/ingestionChannel.repository.ts` — the
  `Ingestion_Channel_Master` table is intended to back any ingestion pipeline.
- `src/middleware/webhookAuth.ts` — generic HMAC-SHA256 verifier.
- `src/utils/crypto.ts` — AES-256-GCM encryption utilities.
- `src/errors/appError.ts`, `src/plugins/error-handler.ts` — error contract.
- `src/modules/health/` — liveness/readiness endpoints.

## Adding a new pipeline (Phase 2 and beyond)

When a new ingestion path is introduced (for example **email-to-FTP**), create a
sibling folder under `src/modules/pipelines/` with the same shape:

```
modules/pipelines/
  ftp-to-ftp/
  email-to-ftp/
    index.ts
    <module>/…
    types/…
```

The `email-to-ftp` scaffold now exists as placeholder-only boilerplate at
`src/modules/pipelines/email-to-ftp/` (coming soon).

Then register it in [`src/app.ts`](../../../app.ts) alongside the existing
pipeline:

```ts
app.register(registerFtpToFtpPipeline);
app.register(registerEmailToFtpPipeline);
```

Prefer reusing the shared data layer (`IngestionChannelRepository`,
`webhookAuth`, crypto utilities) before introducing pipeline-local duplicates.
