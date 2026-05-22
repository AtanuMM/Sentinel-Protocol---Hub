# Sentinel Protocol — Project Map
> Auto-generated from repomix scan. Last updated: April 2026.
> Use this file as the primary context anchor for all AI-assisted development.

---

## 1. Monorepo Structure

```
root/
├── key-vault/              → Standalone secret management service (Fastify + Prisma + PostgreSQL)
├── poc-v0.1/
│   ├── fastify-server/     → Legacy all-in-one ingestion (both pipelines; Port 3000)
│   ├── ftp-to-ftp-server/  → FTP-to-FTP microservice (default Port 3000)
│   ├── email-to-ftp-server/→ Email-to-FTP microservice (default Port 3001)
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

### B. Ingestion backends (`poc-v0.1/*-server`) — Sentinel Harvester

**Purpose:** Event-driven ingestion. **FTP-to-FTP:** MinIO webhook → Redis dedup → stream to landing bucket → Kafka trace. **Email-to-FTP:** IMAP polling, claim detection, landing upload, Kafka.

**Stack (each service):** Fastify 5, TypeScript, Sequelize 6, PostgreSQL, Redis (ioredis), KafkaJS, MinIO SDK, Vitest

| Package | Scope | Default port |
|---------|--------|--------------|
| `ftp-to-ftp-server` | FTP pipeline only (`/api/webhook`, provisioning, integration, feed) | 3000 |
| `email-to-ftp-server` | Email pipeline only (`/api/email-to-ftp/...`, `x-vault-token`) | 3001 |
| `fastify-server` | **Legacy** — both pipelines in one process | 3000 |

**Run:** `cd poc-v0.1/<service> && npm run dev` → `tsx watch src/server.ts`

Same `DB_URL` / infra env vars across services; keep `migrations/` identical if edited in more than one folder.

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

**Ingestion API URLs:** optional Vite env `VITE_INGESTION_FTP_URL` (default `http://localhost:3000`) and `VITE_INGESTION_EMAIL_URL` (defaults to the FTP URL if unset — works with the legacy monolith). When using split services, set `VITE_INGESTION_EMAIL_URL` to the email microservice (e.g. `http://localhost:3001`).

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

### `poc-v0.1` ingestion services — Sequelize / PostgreSQL (same schema, duplicated packages)

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

### `poc-v0.1/fastify-server` (legacy) — combines the above in one process

Same routes as running both microservices behind one `PORT`.

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

### `poc-v0.1/fastify-server` (legacy monolith) and microservice copies

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

### TypeScript (fastify-server, ftp-to-ftp-server, email-to-ftp-server + key-vault)
- **Module system:** `key-vault` uses ES modules (`"type": "module"`). Ingestion services use CommonJS (`"type": "commonjs"`) with TypeScript compiled to dist/.
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
- **Sequelize (ingestion services):** Migration-first. Run `npm run db:migrate` from **one** of `fastify-server`, `ftp-to-ftp-server`, or `email-to-ftp-server` (identical `migrations/`). Models in `src/infra/db.ts`.
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

### `poc-v0.1` ingestion services (`fastify-server`, `ftp-to-ftp-server`, `email-to-ftp-server`)
| Variable | Required | Notes |
|----------|----------|-------|
| `APP_ENCRYPTION_KEY` | YES | AES-256 key for encrypted columns (see `src/config/index.ts`) |
| `DB_URL` | YES | PostgreSQL |
| `REDIS_URL` | YES | Redis |
| MinIO / Kafka | YES | See `src/config/index.ts` |
| `WEBHOOK_SECRET` | No | If unset, HMAC verification is bypassed (FTP webhook) |
| `VAULT_URL` | YES | key-vault base URL (email flows) |

---

## 9. Inter-Service Communication

```
tpa-react-admin-poc  →  ftp-to-ftp-server (3000) / email-to-ftp-server (3001) — REST
                       →  fastify-server (3000) — legacy combined API
ngenclaim-mock       →  (standalone UI — mockData.js)
ftp/email servers    →  key-vault (8000) — REST via vault-client.ts
ingestion services   →  MinIO, Redis, Kafka, PostgreSQL
MinIO                →  ftp-to-ftp-server (POST /api/webhook)
```

---

## 10. What's Incomplete / Coming Next

| Item | Status | Location |
|------|--------|----------|
| Ingestion monolith split | Done | `ftp-to-ftp-server`, `email-to-ftp-server`; legacy `fastify-server` |
| `email-to-ftp` feed module (separate from integration) | Stub / POC | `email-to-ftp/feed/` per `.cursorrules` |
| `ngenclaim-mock` live API integration | Uses mockData.js | `src/data/mockData.js` |
| Encryption key rotation tooling | Planned | See CHANGELOG.md |
| CI pipeline (typecheck + lint + test + migrate) | Not set up | — |
| Integration tests (link-bucket, init-today, webhook) | Not set up | — |