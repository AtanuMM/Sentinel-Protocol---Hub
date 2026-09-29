# Sentinel Protocol — Project Map
> Auto-generated from repomix scan. Last updated: September 2026.
> Use this file as the primary context anchor for all AI-assisted development.

---

## 1. Monorepo Structure

```
root/
├── key-vault/                  → Standalone secret management service (Fastify + Prisma + PostgreSQL)
├── poc-v0.1/
│   ├── fastify-server/         → Legacy all-in-one ingestion (both pipelines; Port 3000)
│   ├── ftp-to-ftp-server/      → FTP-to-FTP microservice (default Port 3000)
│   ├── email-to-ftp-server/    → Email-to-FTP microservice (default Port 3001)
│   ├── whatsapp-to-ftp-server/ → WhatsApp-to-FTP microservice (default Port 3002)
│   ├── storage-core/           → Shared landing-bucket writer (@sentinel/storage-core)
│   └── tpa-react-admin-poc/    → Internal admin control plane (React + Tailwind, minimal UI)
├── ngenclaim-mock/             → Insurance claims dashboard UI (React + Vite + Tailwind + Recharts)
└── docker-compose.yml          → Root infra (Postgres only at root level)
```

---

## 2. Sub-Project Summaries

### A. `key-vault/backend` — Sentinel Vault API
**Purpose:** A standalone, multi-tenant secret manager. Stores encrypted secrets for services (called "channels"). Think: internal AWS KMS / HashiCorp Vault.

**Stack:** Fastify 5, TypeScript, Prisma 7, PostgreSQL, Node.js crypto (AES-256-GCM), `@fastify/cors`

**Run:** `npm run dev` → `tsx --watch src/server.ts` → Port `8000` (assumed)

---

### B. Ingestion backends (`poc-v0.1/*-server`) — Sentinel Harvester

**Purpose:** Event-driven ingestion pipelines. **FTP-to-FTP:** MinIO webhook → Redis dedup → stream to landing bucket → Kafka trace. **Email-to-FTP:** IMAP polling, claim detection, landing upload, Kafka. **WhatsApp-to-FTP:** Meta Cloud API webhook → Redis dedup → Kafka → media harvester → landing bucket (S3/MinIO via `@sentinel/storage-core`).

**Stack (each service):** Fastify 5, TypeScript, Sequelize 6, PostgreSQL, Redis (ioredis), KafkaJS, Vitest. WhatsApp service also uses axios, pdfkit, and `@sentinel/storage-core`.

| Package | Scope | Default port |
|---------|--------|--------------|
| `ftp-to-ftp-server` | FTP pipeline only (`/api/webhook`, provisioning, integration, feed) | 3000 |
| `email-to-ftp-server` | Email pipeline only (`/api/email-to-ftp/...`, `x-vault-token`) | 3001 |
| `whatsapp-to-ftp-server` | WhatsApp pipeline only (`/api/v1/whatsapp/webhook`, provisioning under `/api/v1/whatsapp-to-ftp/`) | 3002 |
| `fastify-server` | **Legacy** — FTP + email pipelines in one process | 3000 |

**Run:** `cd poc-v0.1/<service> && npm run dev` → `tsx watch src/server.ts`

FTP/email services share `DB_URL` / infra env vars and identical `migrations/` when applicable. WhatsApp has its own `whatsapp_channels` table and migrations under `whatsapp-to-ftp-server/migrations/`.

---

### C. `ngenclaim-mock` — Ngenclaim Dashboard UI
**Purpose:** Admin dashboard mock for insurance claims processing. Shows processing trends, channel stats, user management, MDM engine, and a document extraction viewer with JSON output and fraud risk scoring. The **Add Channels** page hosts WhatsApp Embedded Signup (Meta JS SDK → backend connect API).

**Stack:** React 19, Vite 8, Tailwind CSS v4, Recharts, Framer Motion, Lucide React, React Router v7, `@vitejs/plugin-basic-ssl` (HTTPS dev for Meta SDK)

**Run:** `npm run dev` → Vite dev server → Port `5173` (HTTPS enabled)

**Integration status:** Dashboard and most pages use `mockData.js` only. WhatsApp connect on Add Channels is **partially wired** — calls `whatsapp-to-ftp-server` with `VITE_*` env vars; vault provisioning modal is still a stub.

---

### D. `poc-v0.1/tpa-react-admin-poc` — TPA Control Plane (POC UI)
**Purpose:** Minimal React admin UI for TPA operators to link FTP buckets, provision vault API keys, add email IMAP sources, and monitor the live ingestion feed.

**Stack:** React 19, Vite, Tailwind CSS v4

**Run:** `npm run dev` → Port `5174` (assumed second Vite instance)

**Ingestion API URLs:** optional Vite env `VITE_INGESTION_FTP_URL` (default `http://localhost:3000`) and `VITE_INGESTION_EMAIL_URL` (defaults to the FTP URL if unset — works with the legacy monolith). When using split services, set `VITE_INGESTION_EMAIL_URL` to the email microservice (e.g. `http://localhost:3001`).

**Reference for vault provisioning:** `submitVaultProvision` in `src/App.jsx` — pattern to wire ngenclaim-mock vault modal.

---

### E. `poc-v0.1/whatsapp-to-ftp-server` — WhatsApp Ingestion Microservice
**Purpose:** Receives Meta WhatsApp Cloud API webhooks, deduplicates inbound messages, publishes normalized events to Kafka, and runs an in-process media harvester that downloads attachments (document/image), generates transcript PDFs, and writes to tenant landing storage. Exposes provisioning APIs for Meta Embedded Signup (connect/list/disconnect) and per-channel landing storage configuration.

**Stack:** Fastify 5, TypeScript (CommonJS), Sequelize 6, PostgreSQL, Redis, KafkaJS, axios, pdfkit, `@sentinel/storage-core`

**Run:** `npm run dev` → Port `3002`

**Status docs:** `WHATSAPP_INTEGRATION_STATUS.md` (backend), companion doc in `ngenclaim-mock/WHATSAPP_INTEGRATION_STATUS.md` (frontend)

---

## 3. Database Models

### `key-vault` — Prisma / PostgreSQL

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `User` | `id`, `keycloakId` (unique), `email`, `apiKeyHash` | Keycloak-linked; password never stored |
| `Service` | `id`, `name`, `ownerId → User` | Logical container for secrets (e.g., "FTP-Channel") |
| `ApiKey` | `prefix`, `hash`, `serviceId`, `isRevoked` | Per-service API keys (hashed SHA-256) |
| `Secret` | `keyName`, `encryptedBlob`, `authTag`, `iv`, `wrappedDek`, `dekIv`, `dekTag`, `serviceId` | Envelope-encrypted secrets |
| `AuditLog` | `serviceId`, `action`, `target`, `status`, `ipAddress` | Immutable audit trail |

**WhatsApp secret shapes stored in key-vault (via ingestion services):**

| `keyName` pattern | `value.type` | Contents |
|-------------------|--------------|----------|
| `whatsapp:{phoneNumber}` | `META_WHATSAPP` | `access_token`, `phone_number`, `phone_number_id`, `waba_id` |
| `landing:whatsapp:{channelId}` | `LANDING` | S3/MinIO credentials + `provider` |

---

### `poc-v0.1` FTP/email ingestion — Sequelize / PostgreSQL (shared schema across ftp/email/fastify packages)

| Model | Table | Key Fields | Notes |
|-------|-------|-----------|-------|
| `IngestionChannel` | `Ingestion_Channel_Master` | `organisation_id` (PK), `source_bucket`, `source_prefix`, `external_username`, `external_password_encrypted`, `region`, `is_onboarded` | One row per TPA org |
| `EmailSource` | `Email_Source_Master` | `email_address` (PK), `organisation_id`, `vault_secret_id`, `imap_host`, `imap_port`, `is_active` | Email inbox sources |

---

### `poc-v0.1/whatsapp-to-ftp-server` — Sequelize / PostgreSQL (own migrations)

| Model | Table | Key Fields | Notes |
|-------|-------|-----------|-------|
| `WhatsappChannel` | `whatsapp_channels` | `id` (PK, auto), `org_id`, `zone_id`, `phone_number` (unique), `kms_service_id`, `vault_token_encrypted`, `waba_id`, `phone_number_id`, `status` (`ACTIVE`/`INACTIVE`), `landing_storage_provider`, `landing_bucket`, `landing_region`, `landing_endpoint`, `landing_kms_key_name`, `landing_use_ssl`, `landing_port` | One row per connected WhatsApp Business number; `zone_id` maps to `insuranceCompanyCode` in storage paths |

---

## 4. API Routes

### `key-vault` — Prefix: `/api/v1`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/provision` | None | Create/update user, returns raw API key (shown ONCE) |
| POST | `/services` | `x-vault-token` | Create a service/channel container |
| GET | `/services` | `x-vault-token` | List services owned by authenticated user |
| POST | `/secrets` | `x-vault-token` | Encrypt and store/update a secret |
| GET | `/secrets/:serviceId` | `x-vault-token` | Bulk fetch + decrypt all secrets for a service |
| GET | `/secrets/:serviceId/:keyName` | `x-vault-token` | Fetch + decrypt a single secret |
| DELETE | `/secrets/by-id/:secretId` | `x-vault-token` | Delete secret (ownership enforced) |
| GET | `/health` | None | Vault status check |

**Auth mechanism:** `x-vault-token` header → SHA-256 hash → lookup `User.apiKeyHash` in DB

---

### `poc-v0.1/ftp-to-ftp-server` — Prefix: `/api` (FTP routes)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/ping` | None | Health check |
| GET | `/health/live` | None | Liveness |
| GET | `/health/ready` | None | Readiness |
| POST | `/link-bucket` | None | Link TPA FTP credentials + MinIO hierarchy |
| POST | `/onboard-org` | None | Alias for `/init-today` |
| POST | `/init-today` | None | Create today's date-partition folder |
| GET | `/live-feed` | None | Recent ingestion channels |
| POST | `/webhook` | HMAC (`x-webhook-signature`) | MinIO S3 webhook |

### `poc-v0.1/email-to-ftp-server` — Prefix: `/api/email-to-ftp`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/ping` | None | Health (same health module) |
| GET | `/health/live` | None | Liveness |
| GET | `/health/ready` | None | Readiness |
| (see OpenAPI) | `/api/email-to-ftp/...` | `x-vault-token` | Email source registration, IMAP poll, etc. |

### `poc-v0.1/whatsapp-to-ftp-server` — Prefix: `/api/v1`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health/live` | None | Liveness |
| GET | `/health/ready` | None | Readiness |
| GET | `/whatsapp/webhook` | None | Meta webhook verification (`hub.mode=subscribe`) |
| POST | `/whatsapp/webhook` | HMAC (`X-Hub-Signature-256`) | Meta inbound message webhook |
| POST | `/whatsapp-to-ftp/whatsapp-channel` | `x-vault-token` | Embedded Signup connect — exchange auth code, store channel + vault secret |
| GET | `/whatsapp-to-ftp/whatsapp-channels` | None ⚠️ | List channels for `?orgId=` (auth not yet added) |
| PATCH | `/whatsapp-to-ftp/whatsapp-channel/:id/landing-storage` | None ⚠️ | Per-channel S3/MinIO landing config (auth not yet added) |
| POST | `/whatsapp-to-ftp/whatsapp-channel/disconnect` | `x-vault-token` | Soft disconnect (`INACTIVE`); vault secret retained |

Swagger UI: `/documentation`. OpenAPI JSON: `/openapi.json`.

### `poc-v0.1/fastify-server` (legacy) — combines FTP + email in one process

Same routes as running both microservices behind one `PORT`. Does **not** include WhatsApp pipeline.

---

## 5. Data Flow

### FTP-to-FTP Ingestion Pipeline
```
TPA uploads PDF to MinIO (tpa-source-bucket)
  → MinIO fires webhook → POST /api/webhook
    → verifyWebhookSignature (HMAC-SHA256)
    → Parse: orgId/zone/date/filename + etag
    → buildDedupKey("ftp", orgId, bucket, filename, etag)
    → Redis SET NX EX 86400 → if null: drop (duplicate)
    → IngestionChannelRepository.findByOrgId(orgId)
    → Stream: minioClient.getObject(source) → minioClient.putObject(landing)
    → Kafka: produce IngestionTraceEvent to "claims-ingestion-trace"
    → Redis: update key to "processed"
    → MinIO: delete source file
    → Return { traceId, landingPath }
```

### Email-to-FTP Provisioning Flow (live)
```
POST /api/email-to-ftp/...
  → Validate x-vault-token header
  → testImapConnection (ImapFlow) → probe live mail server
  → vaultClient.storeSecret({ password, imap_host, imap_port }) → key-vault API
  → EmailSourceModel.create({ orgId, email, vault_secret_id, ... })
  → Return { email, orgId }
  [On DB failure] → vaultClient.deleteSecret (rollback orphan)
```

### WhatsApp Webhook Ingestion Pipeline (live — text verified E2E)
```
Meta POST /api/v1/whatsapp/webhook
  → verifyMetaSignature (X-Hub-Signature-256, raw body preserved in app.ts)
  → Parse messages: text, document, image (skip audio/video/location/etc.)
  → findChannelByPhoneNumber(display_phone_number)
  → Redis SET whatsapp:dedup:{messageId} NX EX 86400 → skip duplicate
  → Kafka publish WhatsappRawEvent to "whatsapp-raw-events" topic
  → Return { status: "EVENT_RECEIVED" }
```

### WhatsApp Media Harvester (in-process Kafka consumer)
```
Kafka consumer (group: whatsapp-media-harvester, topic: whatsapp-raw-events)
  → Resolve channel + decrypt vault_token_encrypted (APP_ENCRYPTION_KEY)
  → GET key-vault /secrets/:serviceId → find META_WHATSAPP secret → access_token
  → Text only: buildWhatsappTranscriptPdfBuffer → writeToLanding (transcript PDF)
  → Document/image: Meta Graph API v20.0 download → writeToLanding (media + transcript)
  → buildStorageWriterConfigForChannel() — per-channel S3/MinIO or global env fallback
  → Object key: {orgId}/{zoneId}/{YYYY-MM-DD}/whatsapp/{HHmmss}_{phone}_{type}_{shortWamid}/{fileName}
```

### WhatsApp Embedded Signup Provisioning Flow
```
ngenclaim-mock Add Channels → FB.login (Embedded Signup) → authorizationCode
  → POST /api/v1/whatsapp-to-ftp/whatsapp-channel { orgId, serviceId, zoneId, authorizationCode }
    → Meta Graph: exchange code → access_token
    → Meta Graph: /me/whatsapp_business_accounts → wabaId
    → Meta Graph: /{wabaId}/phone_numbers → phoneNumberId, display_phone_number
    → Meta Graph: POST /{wabaId}/subscribed_apps (warn-only on failure)
    → vaultClient.storeSecret({ type: META_WHATSAPP, access_token, ... }) → key-vault
    → WhatsappChannelModel.create({ org_id, zone_id, phone_number, kms_service_id, vault_token_encrypted, ... })
    → Return { phoneNumber, orgId, wabaId }
  [On DB failure] → vaultClient.deleteSecret (rollback orphan)
```

### Secret Encryption Flow (key-vault)
```
POST /secrets { serviceId, keyName, value }
  → CryptoService.encrypt(plainText)
    → Generate DEK (32 random bytes)
    → Generate IV (12 bytes)
    → AES-256-GCM encrypt plainText with DEK → encryptedBlob + authTag
    → Generate dekIv (12 bytes)
    → AES-256-GCM encrypt DEK with MASTER_ROOT_KEY → wrappedDek + dekTag
  → prisma.secret.upsert({ serviceId_keyName unique constraint })
```

---

## 6. Key Files Reference

### `key-vault/backend`
| File | Role |
|------|------|
| `src/server.ts` | App bootstrap, CORS, route registration, graceful shutdown |
| `src/services/CryptoService.ts` | **DO NOT TOUCH** — Envelope encryption engine |
| `src/services/SecretService.ts` | CRUD layer wrapping CryptoService |
| `src/middleware/auth.ts` | `verifyVaultToken` — hashes token and looks up User |
| `src/routes/authRoutes.ts` | `/auth/provision` — user onboarding |
| `src/routes/serviceRoutes.ts` | Service CRUD |
| `src/routes/secretRoutes.ts` | Secret CRUD (ownership-enforced) |
| `src/lib/prisma.ts` | Prisma client singleton (pg pool adapter) |
| `prisma/schema.prisma` | Source of truth for DB schema |

### `poc-v0.1/fastify-server` (legacy monolith) and FTP/email microservice copies

The same file layout exists under `ftp-to-ftp-server` and `email-to-ftp-server` (duplicated `src/` per split). Key roles:

| File | Role |
|------|------|
| `src/app.ts` | Fastify app factory — registers plugins + pipeline(s) for that package |
| `src/server.ts` | Startup — dependency assertions, listen, graceful shutdown |
| `src/infra/clients.ts` | MinIO, Redis, Kafka producer singletons |
| `src/infra/db.ts` | Sequelize instance + model initialization |
| `src/utils/crypto.ts` | AES-256-GCM encrypt/decrypt + HMAC-SHA256 |
| `src/utils/dedupKey.ts` | `buildDedupKey(source, orgId, bucket, filename, etag)` |
| `src/utils/vault-client.ts` | HTTP client for key-vault API |
| `src/middleware/webhookAuth.ts` | HMAC signature verifier for MinIO webhooks |
| `src/repositories/ingestionChannel.repository.ts` | DB access for Ingestion_Channel_Master |
| `src/modules/pipelines/ftp-to-ftp/ingestion/ingestion.service.ts` | FTP webhook handler |
| `src/modules/pipelines/email-to-ftp/` | Email provisioning + IMAP ingestion |
| `migrations/` | Sequelize migrations — keep in sync across the three packages if changed |

### `poc-v0.1/whatsapp-to-ftp-server`
| File | Role |
|------|------|
| `src/app.ts` | Fastify bootstrap, raw body parser for Meta HMAC, `/api/v1` prefix |
| `src/server.ts` | DB/Redis/Kafka checks, starts media harvester, graceful shutdown |
| `src/config/index.ts` | Env config, `buildStorageWriterConfigFromEnv()`, `buildStorageWriterConfigForChannel()` |
| `src/utils/vault-client.ts` | HTTP client for key-vault (store/list/get/delete secrets) |
| `src/utils/crypto.ts` | APP_ENCRYPTION_KEY encrypt/decrypt for `vault_token_encrypted` column |
| `src/models/whatsapp-channel.model.ts` | Sequelize model incl. landing metadata columns |
| `src/repositories/whatsappChannel.repository.ts` | DB access for `whatsapp_channels` |
| `src/modules/pipelines/whatsapp-to-ftp/webhook/webhook.service.ts` | Verification, signature check, dedup, Kafka publish, message typing |
| `src/modules/pipelines/whatsapp-to-ftp/webhook/signature.ts` | `X-Hub-Signature-256` HMAC verification |
| `src/modules/pipelines/whatsapp-to-ftp/workers/media-harvester.ts` | Kafka consumer, Meta media download, landing writes, path naming |
| `src/modules/pipelines/whatsapp-to-ftp/workers/transcript-gen.ts` | PDF transcript generation (pdfkit) |
| `src/modules/pipelines/whatsapp-to-ftp/provisioning/provisioning.service.ts` | Embedded Signup connect, list, disconnect, landing storage PATCH |
| `migrations/` | WhatsApp-specific migrations (`whatsapp_channels`, landing columns) |
| `WHATSAPP_INTEGRATION_STATUS.md` | Handover doc — verified vs unverified items |

### `poc-v0.1/storage-core`
| File | Role |
|------|------|
| `src/writer.ts` | `writeToLanding()` — object key layout, S3/MinIO upload |
| `src/utils/redactStorageConfig.ts` | Credential redaction before logging |

### `ngenclaim-mock`
| File | Role |
|------|------|
| `src/App.jsx` | Router — public (Gateway, Login) + protected (DashboardLayout) routes |
| `src/pages/Dashboard.jsx` | Main dashboard with filter bar + reactive stat cards + charts (mock data) |
| `src/pages/AddChannels.jsx` | Channel provisioning — **WhatsApp Embedded Signup modal** (live backend call) |
| `src/utils/facebookSdk.js` | Meta JS SDK dynamic loader + `FB.init` |
| `src/types/whatsappChannel.js` | JSDoc types for connect request/response |
| `src/hooks/useIngressConnections.js` | FTP/email connection hooks (stubs — TODO wire to APIs) |
| `src/components/layout/DashboardLayout.jsx` | Sidebar + TopNavbar + Footer shell |
| `src/components/ui/ProcessTable.jsx` | File queue table + PDF/JSON extraction modal + fraud risk indicator |
| `src/data/mockData.js` | All mock data (channelStats, chartData, dummyUsers, fileQueue) |
| `src/index.css` | Global CSS + Tailwind v4 theme tokens (color-ng-*) |
| `vite.config.js` | HTTPS dev server (`basicSsl`), ngrok `allowedHosts` for Meta SDK |
| `.env.example` | `VITE_META_APP_ID`, `VITE_META_LOGIN_CONFIG_ID`, `VITE_WHATSAPP_INGESTION_URL`, `VITE_VAULT_TOKEN` |
| `WHATSAPP_INTEGRATION_STATUS.md` | Handover doc — frontend verified vs unverified items |

---

## 7. Coding Conventions

### TypeScript (ingestion services + key-vault)
- **Module system:** `key-vault` uses ES modules (`"type": "module"`). Ingestion services use CommonJS (`"type": "commonjs"`) with TypeScript compiled to dist/.
- **Pattern:** MVC — controller handles request/reply, service contains business logic, repository handles DB
- **Error handling:** `AppError(statusCode, message, code)` → caught by `registerErrorHandler` plugin
- **Async:** All async functions use `async/await`. Retry wrapper `withRetries(fn, 3)` used in FTP ingestion.
- **Imports:** Use `.js` extension in key-vault ESM imports (e.g., `from '../lib/prisma.js'`)
- **Path alias:** `@/*` maps to `src/*` in key-vault tsconfig
- **Encryption keys:** Never stored in DB. `MASTER_ROOT_KEY` = 64-char hex env var. Validated at startup.
- **Passwords/tokens:** Always stored as AES-256-GCM encrypted blobs (`*_encrypted` suffix), never plaintext.
- **WhatsApp dedup:** Redis `SET key value NX EX 86400` — always NX, 24h TTL (same pattern as FTP).
- **WhatsApp pipeline folder:** New WhatsApp logic lives under `src/modules/pipelines/whatsapp-to-ftp/` in `whatsapp-to-ftp-server` only.

### React (ngenclaim-mock + tpa-react-admin-poc)
- **Component style:** Functional components with hooks. No class components.
- **Styling:** Tailwind CSS v4 utility classes. Custom theme via `@theme {}` in `index.css`. Color tokens: `var(--color-ng-primary)` = `#00D1FF`, `var(--color-ng-secondary)` = `#2E6BFF`.
- **State:** Local `useState` + `useMemo` for derived data. No global state manager (no Redux/Zustand).
- **Auth (mock):** `localStorage.getItem('ngen_user')` checked on mount. Dummy users in `mockData.js`.
- **Icons:** Lucide React exclusively.
- **Charts:** Recharts (BarChart, PieChart) via ResponsiveContainer.
- **Animation:** Framer Motion for page/component transitions.
- **Routing:** React Router v7 with nested routes under `DashboardLayout`.
- **Meta SDK:** Load dynamically via `facebookSdk.js`; dev requires HTTPS (Vite basicSsl) + domain allowlisting (ngrok for local).

### Database Conventions
- **Prisma (key-vault):** Schema-first. Run `prisma migrate dev` for changes. Never use `sync({ alter: true })`.
- **Sequelize (FTP/email):** Migration-first. Run `npm run db:migrate` from one of `fastify-server`, `ftp-to-ftp-server`, or `email-to-ftp-server` (identical `migrations/`).
- **Sequelize (WhatsApp):** Own migrations in `whatsapp-to-ftp-server/migrations/`. Run `npm run db:migrate` from that package.
- **Primary keys:** UUIDs in key-vault (Prisma default). String org IDs in Sequelize (business key = `organisation_id` / `org_id`).
- **Timestamps:** `createdAt` / `updatedAt` on all models. Sequelize uses `underscored: true`.
- **Encrypted columns:** Always suffixed `_encrypted` (e.g., `external_password_encrypted`, `vault_token_encrypted`).

---

## 8. Environment Variables

### `key-vault/backend`
| Variable | Required | Notes |
|----------|----------|-------|
| `MASTER_ROOT_KEY` | YES | 64-char hex. Startup fails without it. |
| `DATABASE_URL` | YES | PostgreSQL connection string |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `production` enables HTTPS + strict CORS |
| `ALLOWED_ORIGIN` | Prod only | CORS origin whitelist |
| `SSL_KEY_PATH` / `SSL_CERT_PATH` | Prod only | SSL cert paths |

### `poc-v0.1` FTP/email ingestion (`fastify-server`, `ftp-to-ftp-server`, `email-to-ftp-server`)
| Variable | Required | Notes |
|----------|----------|-------|
| `APP_ENCRYPTION_KEY` | YES | AES-256 key for encrypted columns (see `src/config/index.ts`) |
| `DB_URL` | YES | PostgreSQL |
| `REDIS_URL` | YES | Redis |
| MinIO / Kafka | YES | See `src/config/index.ts` |
| `WEBHOOK_SECRET` | No | If unset, HMAC verification is bypassed (FTP webhook) |
| `VAULT_URL` | YES | key-vault base URL (email flows) |

### `poc-v0.1/whatsapp-to-ftp-server`
| Variable | Required | Notes |
|----------|----------|-------|
| `APP_ENCRYPTION_KEY` | YES | Encrypts `vault_token_encrypted` on channel rows |
| `DB_URL` | YES | PostgreSQL (shared DB; own `whatsapp_channels` table) |
| `REDIS_URL` | YES | Message dedup |
| `KAFKA_BOOTSTRAP_SERVERS` | YES | Raw events topic consumer/producer |
| `WHATSAPP_VERIFY_TOKEN` | YES | Meta webhook GET handshake |
| `WHATSAPP_APP_SECRET` | YES | Meta webhook HMAC + token exchange |
| `META_APP_ID` | YES | Embedded Signup token exchange |
| `VAULT_URL` | YES | key-vault base URL (default `http://localhost:8000/api/v1`) |
| `WHATSAPP_RAW_EVENTS_TOPIC` | No | Default `whatsapp-raw-events` |
| `STORAGE_PROVIDER` | YES* | Global fallback: `MINIO`, `S3`, `GCP`, `AZURE` — per-channel config overrides when set |
| `AWS_*` / `MINIO_*` | Conditional | Required when `STORAGE_PROVIDER` matches; or configure per-channel via PATCH landing-storage |
| `PORT` | No | Default `3002` |

### `ngenclaim-mock` (Vite — prefix `VITE_`)
| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_META_APP_ID` | YES (WhatsApp) | Meta Developer Console app id |
| `VITE_META_LOGIN_CONFIG_ID` | YES (WhatsApp) | Facebook Login for Business config id (Embedded Signup) |
| `VITE_WHATSAPP_INGESTION_URL` | YES (WhatsApp) | Default `http://localhost:3002` — whatsapp-to-ftp-server base URL |
| `VITE_VAULT_TOKEN` | TEMP | Dev placeholder `sv_live_...` — should come from vault provisioning UI, not baked into env |

---

## 9. Inter-Service Communication

```
tpa-react-admin-poc     →  ftp-to-ftp-server (3000) / email-to-ftp-server (3001) — REST
                        →  fastify-server (3000) — legacy combined API
                        →  key-vault (8000) — vault provisioning (submitVaultProvision)

ngenclaim-mock          →  whatsapp-to-ftp-server (3002) — WhatsApp connect API (partial)
                        →  key-vault (8000) — NOT wired yet (vault modal stub; uses VITE_VAULT_TOKEN)
                        →  mockData.js — dashboard, users, file queue (no live APIs)

whatsapp-to-ftp-server  →  key-vault (8000) — store/list META_WHATSAPP + LANDING secrets
                        →  Meta Graph API — token exchange, media download, subscribed_apps
                        →  Redis, Kafka, PostgreSQL
                        →  S3/MinIO landing bucket via @sentinel/storage-core

ftp/email servers       →  key-vault (8000) — REST via vault-client.ts
ingestion services      →  MinIO, Redis, Kafka, PostgreSQL
MinIO                   →  ftp-to-ftp-server (POST /api/webhook)
Meta WhatsApp Cloud API →  whatsapp-to-ftp-server (POST /api/v1/whatsapp/webhook)
```

---

## 10. What's Incomplete / Coming Next

| Item | Status | Location |
|------|--------|----------|
| Ingestion monolith split (FTP + email) | Done | `ftp-to-ftp-server`, `email-to-ftp-server`; legacy `fastify-server` |
| WhatsApp ingestion microservice | Done (backend) | `whatsapp-to-ftp-server` — text E2E verified; doc/image paths built not live-tested |
| WhatsApp frontend Embedded Signup | Partial | `ngenclaim-mock/src/pages/AddChannels.jsx` — popup works; full connect→success not verified |
| ngenclaim vault provisioning modal | Stub | `AddChannels.jsx` `onVaultSubmit` — wire to `POST /api/v1/auth/provision` |
| ngenclaim hardcoded org/service/zone | Placeholder | `ORG_ID`, `WHATSAPP_KMS_SERVICE_ID`, `WHATSAPP_ZONE_ID` in AddChannels.jsx |
| WhatsApp list/PATCH route auth | Missing | `provisioning.routes.ts` — GET channels, PATCH landing-storage open |
| Phone number normalization on webhook | Missing | Exact string match on `display_phone_number` vs DB |
| `subscribed_apps` failure handling | Warn-only | May leave channel without webhooks until manual Graph API call |
| ngenclaim dashboard live API | Uses mockData.js | `src/data/mockData.js` |
| `email-to-ftp` feed module | Stub / POC | `email-to-ftp/feed/` per `.cursorrules` |
| Encryption key rotation tooling | Planned | See CHANGELOG.md |
| CI pipeline (typecheck + lint + test + migrate) | Not set up | — |
| Integration tests (link-bucket, init-today, webhook) | Not set up | — |

**Handover docs for WhatsApp work:**
- Backend: `poc-v0.1/whatsapp-to-ftp-server/WHATSAPP_INTEGRATION_STATUS.md`
- Frontend: `ngenclaim-mock/WHATSAPP_INTEGRATION_STATUS.md`
