# Sentinel Protocol — Project Map
> Auto-generated from repomix scan. Last updated: April 2026.
> Use this file as the primary context anchor for all AI-assisted development.

---

## 1. Monorepo Structure

```
root/
├── key-vault/              → Standalone secret management service (Fastify + Prisma + PostgreSQL)
├── poc-v0.1/
│   ├── fastify-server/     → Core ingestion backend (Fastify + Sequelize + Kafka + MinIO + Redis)
│   └── tpa-react-admin-poc/→ Internal admin control plane (React + Tailwind, minimal UI)
├── ngenclaim-mock/         → Insurance claims dashboard UI (React + Vite + Tailwind + Recharts)
└── docker-compose.yml      → Root infra (Postgres only at root level)
```

---

## 2. Sub-Project Summaries

### A. `key-vault/backend` — Sentinel Vault API
**Purpose:** A standalone, multi-tenant secret manager. Stores encrypted secrets for services (called "channels"). Think: internal AWS KMS / HashiCorp Vault.

**Stack:** Fastify 5, TypeScript, Prisma 7, PostgreSQL, Node.js crypto (AES-256-GCM), `@fastify/cors`

**Run:** `npm run dev` → `tsx --watch src/server.ts` → Port `8000` (assumed)

---

### B. `poc-v0.1/fastify-server` — Sentinel Harvester (Core Ingestion Backend)
**Purpose:** Event-driven file ingestion pipeline. Receives webhook events from MinIO when TPAs upload PDFs, deduplicates via Redis, streams files to a landing bucket, and signals downstream via Kafka.

**Stack:** Fastify 5, TypeScript, Sequelize 6, PostgreSQL, Redis (ioredis), KafkaJS, MinIO SDK, Vitest

**Run:** `npm run dev` → `tsx watch src/server.ts` → Port `3000`

**Pipelines implemented:**
- `ftp-to-ftp` — fully wired (webhook → dedup → stream → kafka)
- `email-to-ftp` — scaffold exists, provisioning route live, ingestion coming soon

---

### C. `ngenclaim-mock` — Ngenclaim Dashboard UI
**Purpose:** Admin dashboard mock for insurance claims processing. Shows processing trends, channel stats, user management, MDM engine, and a document extraction viewer with JSON output and fraud risk scoring.

**Stack:** React 19, Vite 8, Tailwind CSS v4, Recharts, Framer Motion, Lucide React, React Router v7

**Run:** `npm run dev` → Vite dev server → Port `5173` (default)

---

### D. `poc-v0.1/tpa-react-admin-poc` — TPA Control Plane (POC UI)
**Purpose:** Minimal React admin UI for TPA operators to link FTP buckets, provision vault API keys, add email IMAP sources, and monitor the live ingestion feed.

**Stack:** React 19, Vite, Tailwind CSS v4

**Run:** `npm run dev` → Port `5174` (assumed second Vite instance)

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

### `poc-v0.1/fastify-server` — Sequelize / PostgreSQL

| Model | Table | Key Fields | Notes |
|-------|-------|-----------|-------|
| `IngestionChannel` | `Ingestion_Channel_Master` | `organisation_id` (PK), `source_bucket`, `source_prefix`, `external_username`, `external_password_encrypted`, `region`, `is_onboarded` | One row per TPA org |
| `EmailSource` | `Email_Source_Master` | `email_address` (PK), `organisation_id`, `vault_secret_id`, `imap_host`, `imap_port`, `is_active` | Email inbox sources |

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
| GET | `/health` | None | Vault status check |

**Auth mechanism:** `x-vault-token` header → SHA-256 hash → lookup `User.apiKeyHash` in DB

---

### `poc-v0.1/fastify-server` — Prefix: `/api`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/ping` | None | Health check (returns status, timestamp, node version) |
| GET | `/health/live` | None | Liveness probe |
| GET | `/health/ready` | None | Readiness probe (checks Postgres + Redis) |
| POST | `/link-bucket` | None | Link TPA FTP credentials + initialize MinIO folder hierarchy |
| POST | `/onboard-org` | None | Alias for `/init-today` (idempotent hierarchy check) |
| POST | `/init-today` | None | Create today's date-partition folder in MinIO |
| GET | `/live-feed` | None | Returns 5 most recent ingestion channels |
| POST | `/webhook` | HMAC-SHA256 (`x-webhook-signature`) | MinIO S3 event ingestion webhook |
| POST | `/email-to-ftp/email-source` | `x-vault-token` | Register new monitored email inbox |

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
POST /email-to-ftp/email-source
  → Validate x-vault-token header
  → testImapConnection (ImapFlow) → probe live mail server
  → vaultClient.storeSecret({ password, imap_host, imap_port }) → key-vault API
  → EmailSourceModel.create({ orgId, email, vault_secret_id, ... })
  → Return { email, orgId }
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

### `poc-v0.1/fastify-server`
| File | Role |
|------|------|
| `src/app.ts` | Fastify app factory — registers all plugins + pipelines |
| `src/server.ts` | Startup — dependency assertions, listen, graceful shutdown |
| `src/infra/clients.ts` | MinIO, Redis, Kafka producer singletons |
| `src/infra/db.ts` | Sequelize instance + model initialization |
| `src/utils/crypto.ts` | AES-256-GCM encrypt/decrypt + HMAC-SHA256 |
| `src/utils/dedupKey.ts` | `buildDedupKey(source, orgId, bucket, filename, etag)` |
| `src/utils/vault-client.ts` | HTTP client for key-vault API |
| `src/middleware/webhookAuth.ts` | HMAC signature verifier for MinIO webhooks |
| `src/repositories/ingestionChannel.repository.ts` | DB access layer for Ingestion_Channel_Master |
| `src/modules/pipelines/ftp-to-ftp/ingestion/ingestion.service.ts` | **Core pipeline logic** — the full webhook handler |
| `src/modules/pipelines/email-to-ftp/provisioning/provisioning.service.ts` | Email onboarding with vault + IMAP test |
| `migrations/` | Sequelize migration files — source of truth for schema changes |

### `ngenclaim-mock`
| File | Role |
|------|------|
| `src/App.jsx` | Router — public (Gateway, Login) + protected (DashboardLayout) routes |
| `src/pages/Dashboard.jsx` | Main dashboard with filter bar + reactive stat cards + charts |
| `src/components/layout/DashboardLayout.jsx` | Sidebar + TopNavbar + Footer shell |
| `src/components/ui/ProcessTable.jsx` | File queue table + PDF/JSON extraction modal + fraud risk indicator |
| `src/data/mockData.js` | All mock data (channelStats, chartData, dummyUsers) |
| `src/index.css` | Global CSS + Tailwind v4 theme tokens (color-ng-*) |

---

## 7. Coding Conventions

### TypeScript (fastify-server + key-vault)
- **Module system:** `key-vault` uses ES modules (`"type": "module"`). `fastify-server` uses CommonJS (`"type": "commonjs"`) with TypeScript compiled to dist/.
- **Pattern:** MVC — controller handles request/reply, service contains business logic, repository handles DB
- **Error handling:** `AppError(statusCode, message, code)` → caught by `registerErrorHandler` plugin
- **Async:** All async functions use `async/await`. Retry wrapper `withRetries(fn, 3)` used in ingestion.
- **Imports:** Use `.js` extension in key-vault ESM imports (e.g., `from '../lib/prisma.js'`)
- **Path alias:** `@/*` maps to `src/*` in key-vault tsconfig
- **Encryption keys:** Never stored in DB. `MASTER_ROOT_KEY` = 64-char hex env var. Validated at startup.
- **Passwords:** Always stored as AES-256-GCM encrypted blobs, never plaintext.

### React (ngenclaim-mock + tpa-react-admin-poc)
- **Component style:** Functional components with hooks. No class components.
- **Styling:** Tailwind CSS v4 utility classes. Custom theme via `@theme {}` in `index.css`. Color tokens: `var(--color-ng-primary)` = `#00D1FF`, `var(--color-ng-secondary)` = `#2E6BFF`.
- **State:** Local `useState` + `useMemo` for derived data. No global state manager (no Redux/Zustand).
- **Auth (mock):** `localStorage.getItem('ngen_user')` checked on mount. Dummy users in `mockData.js`.
- **Icons:** Lucide React exclusively.
- **Charts:** Recharts (BarChart, PieChart) via ResponsiveContainer.
- **Animation:** Framer Motion for page/component transitions.
- **Routing:** React Router v7 with nested routes under `DashboardLayout`.

### Database Conventions
- **Prisma (key-vault):** Schema-first. Run `prisma migrate dev` for changes. Never use `sync({ alter: true })`.
- **Sequelize (fastify-server):** Migration-first. Run `npm run db:migrate`. Models initialized in `src/infra/db.ts`.
- **Primary keys:** UUIDs in key-vault (Prisma default). String org IDs in Sequelize (business key = `organisation_id`).
- **Timestamps:** `createdAt` / `updatedAt` on all models. Sequelize uses `underscored: true` for EmailSource.
- **Encrypted columns:** Always suffixed `_encrypted` (e.g., `external_password_encrypted`).

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

### `poc-v0.1/fastify-server`
| Variable | Required | Notes |
|----------|----------|-------|
| `ENCRYPTION_KEY` | YES | AES-256 key for `external_password_encrypted` |
| `DATABASE_URL` | YES | PostgreSQL |
| `REDIS_URL` | YES | Redis connection |
| `MINIO_*` | YES | endpoint, port, useSSL, accessKey, secretKey |
| `KAFKA_BROKERS` | YES | Comma-separated broker list |
| `WEBHOOK_SECRET` | No | If unset, HMAC verification is bypassed |
| `LANDING_BUCKET` | YES | Destination bucket name |
| `INGESTION_TOPIC` | YES | Kafka topic (default: `claims-ingestion-trace`) |
| `VAULT_URL` | YES | key-vault base URL for email provisioning |

---

## 9. Inter-Service Communication

```
tpa-react-admin-poc  →  fastify-server (port 3000) — REST
ngenclaim-mock       →  (standalone UI, no live API calls yet — uses mockData.js)
fastify-server       →  key-vault (port 8000) — REST via vault-client.ts
fastify-server       →  MinIO — SDK (minio npm)
fastify-server       →  Redis — ioredis
fastify-server       →  Kafka — kafkajs
fastify-server       →  PostgreSQL — Sequelize
key-vault            →  PostgreSQL — Prisma
MinIO                →  fastify-server (webhook POST /api/webhook)
```

---

## 10. What's Incomplete / Coming Next

| Item | Status | Location |
|------|--------|----------|
| `email-to-ftp` ingestion service | Scaffold only | `src/modules/pipelines/email-to-ftp/ingestion/ingestion.service.ts` |
| `email-to-ftp` feed, integration modules | Stubs only | `email-to-ftp/feed/`, `integration/` |
| `ngenclaim-mock` live API integration | Uses mockData.js | `src/data/mockData.js` |
| Encryption key rotation tooling | Planned | See CHANGELOG.md |
| CI pipeline (typecheck + lint + test + migrate) | Not set up | — |
| Integration tests (link-bucket, init-today, webhook) | Not set up | — |