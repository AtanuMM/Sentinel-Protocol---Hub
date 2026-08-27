# Sentinel Protocol — Enterprise Technical Reference

**Version:** POC v0.1  
**Last updated:** 2026-06-15  
**Scope:** Monorepo at `Product-Omni/` — ingestion microservices, KMS, shared storage library, poll orchestrator, API gateway, and local Docker infrastructure.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Infrastructure Layer (Docker Compose)](#3-infrastructure-layer-docker-compose)
4. [API Gateway (nginx/OpenResty)](#4-api-gateway-nginxopenresty)
5. [Key Vault (KMS) Service](#5-key-vault-kms-service)
6. [Storage Core Library (`@sentinel/storage-core`)](#6-storage-core-library-sentinelstorage-core)
7. [FTP-to-FTP Ingestion Service](#7-ftp-to-ftp-ingestion-service)
8. [Email-to-FTP Ingestion Service](#8-email-to-ftp-ingestion-service)
9. [Poll Orchestrator Service](#9-poll-orchestrator-service)
10. [Data Flows](#10-data-flows)
11. [Multi-Tenancy Model](#11-multi-tenancy-model)
12. [Security Architecture](#12-security-architecture)
13. [Known Gaps and Future Work](#13-known-gaps-and-future-work)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [API Reference](#15-api-reference)

---

## 1. System Overview

### What Sentinel Protocol Is

Sentinel Protocol is a **multi-tenant healthcare claims ingestion platform** designed for Third-Party Administrators (TPAs). It solves the problem of collecting claim documents from heterogeneous insurer source systems — FTP servers, email inboxes, and (planned) messaging channels — normalizing them into a **Sentinel landing bucket** (MinIO/S3-compatible object storage), and emitting **metadata-only Kafka events** so downstream MDM, OCR, and adjudication systems can process files without the ingestion layer holding file bytes in message queues.

The platform separates concerns into:

| Layer | Responsibility |
|-------|----------------|
| **API Gateway** | Edge routing, JWT auth, optional payload encryption |
| **Key Vault (KMS)** | Envelope-encrypted credential storage per tenant service |
| **Ingestion microservices** | Channel registration, provisioning, legacy webhook handling |
| **Poll Orchestrator** | Horizontally scalable scheduled polling via Kafka |
| **Storage Core** | Shared reader/writer drivers + Kafka publish |
| **Infrastructure** | PostgreSQL (trace/MDM DB), Redis (dedup), Kafka (job + event bus), MinIO (landing + TPA simulation) |

### SaaS vs Licensed Deployment Model

The codebase supports two deployment postures:

- **SaaS (multi-tenant hosted):** A single Sentinel stack serves many TPAs. Each TPA is identified by `orgId`. Credentials are isolated in KMS per `Service` record owned by a provisioned user. Landing bucket paths namespace by `orgId`. The poll orchestrator fans out jobs for all active channels from a shared `Ingestion_Channel_Master` table.

- **Licensed (single-tenant / on-prem):** The same microservices run in the customer's VPC. Docker Compose (or future Kubernetes manifests) bundles Postgres, Kafka, MinIO, and optionally local Redis. TPAs configure their own `STORAGE_PROVIDER` and KMS `MASTER_ROOT_KEY`. No multi-tenant control plane is required beyond org-scoped DB rows and KMS service ownership checks.

Both models share identical service binaries; isolation is enforced by **orgId namespacing**, **KMS ownership checks**, and **per-tenant encrypted columns** — not separate code paths.

### Multi-Tenant Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  TPA Admin  │────▶│ API Gateway  │────▶│ ftp-to-ftp /    │
│  UI / API   │     │  (port 5000) │     │ email-to-ftp    │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────┐               ▼
                    │  Key Vault   │◀──── x-vault-token ──── KMS secrets
                    │  (port 8000) │
                    └──────────────┘
                                                   │
┌─────────────────┐     ┌──────────────┐          ▼
│ Poll Orchestrator│────▶│  poll-jobs   │──▶ Worker pool
│  (scheduler)    │     │    topic     │          │
└─────────────────┘     └──────────────┘          ▼
                                          @sentinel/storage-core
                                                   │
                    ┌──────────────┐               ▼
                    │    MinIO     │◀──── landing bucket write
                    │  (port 9000) │
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │ ingestion-   │──▶ downstream consumers
                    │ events topic │
                    └──────────────┘
```

Each tenant (TPA) registers one or more ingestion channels. Credentials never sit in plaintext in Postgres — only KMS envelope blobs and locally encrypted vault tokens.

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| HTTP framework | Fastify 5 |
| Language | TypeScript (strict) |
| Message bus | Apache Kafka (KRaft mode, no ZooKeeper) |
| Object storage | MinIO AIStor (S3-compatible) |
| Primary DB | PostgreSQL 15 (`sentinel_mdm`) |
| Cache / dedup | Redis (local host, port 6380 in dev) |
| ORM (ingestion) | Sequelize |
| ORM (KMS) | Prisma |
| Edge proxy | nginx/OpenResty (Lua: JWT, AES) |
| FTP client | `basic-ftp` |
| IMAP client | `imapflow` |
| Email testing | GreenMail + Roundcube |

---

## 2. Repository Structure

### Annotated Directory Tree

```
Product-Omni/
├── api-gateway/              # OpenResty/nginx reverse proxy (port 5000)
│   ├── nginx.conf            # Routing, JWT, AES encryption Lua blocks
│   └── html/                 # Static gateway landing page
├── key-vault/
│   └── backend/              # KMS microservice (Fastify + Prisma, port 8000)
│       ├── src/
│       │   ├── server.ts
│       │   ├── routes/       # auth, services, secrets
│       │   ├── services/     # CryptoService, SecretService
│       │   └── middleware/   # verifyVaultToken
│       └── prisma/           # User, Service, Secret, AuditLog schema
├── poc-v0.1/
│   ├── ftp-to-ftp-server/    # FTP ingestion API (default port 3000)
│   ├── email-to-ftp-server/  # Email ingestion API (default port 3001)
│   ├── poll-orchestrator/    # Kafka scheduler + worker pool
│   ├── storage-core/         # @sentinel/storage-core shared library
│   ├── fastify-server/       # Legacy all-in-one (deprecated)
│   └── tpa-react-admin-poc/  # TPA admin UI (port 5174)
├── ngenclaim-mock/           # Claims dashboard mock UI (port 5173)
├── docker-compose.yml        # Local infra: MinIO, Postgres, Kafka, GreenMail, gateway
├── minio_data/               # Bind mount — MinIO object data
├── postgres_data/            # Bind mount — Postgres data
└── docs/                     # This documentation
```

### Service Relationships

| Service | Consumes | Produces |
|---------|----------|----------|
| `ftp-to-ftp-server` | KMS, Postgres, Redis, MinIO, Kafka | Channel rows, hierarchy markers |
| `email-to-ftp-server` | KMS, Postgres, Redis, MinIO, Kafka, IMAP | Email source rows, claim artifacts |
| `poll-orchestrator` | Postgres, Redis, Kafka, KMS, storage-core | `poll-jobs` messages, landing files, `ingestion-events` |
| `storage-core` | MinIO (writer), source systems (readers), Kafka | Landing objects, metadata events |
| `key-vault/backend` | Postgres | Encrypted secrets, API keys |
| `api-gateway` | Upstream microservices | Proxied HTTP, JWT gate |

**Dependency direction:** Ingestion services → KMS (credentials). Poll orchestrator → storage-core (transfer). storage-core → Kafka (events only, never file bytes).

---

## 3. Infrastructure Layer (Docker Compose)

File: `docker-compose.yml`

### Services

| Service | Container | Purpose | Host Ports |
|---------|-----------|---------|------------|
| **minio** | `sentinel-s3` | S3-compatible object storage (TPA buckets + landing) | 9000 (API), 9001 (console) |
| **db** | `sentinel-db` | PostgreSQL 15 — `sentinel_mdm` database | 5432 |
| **redis-insight** | `sentinel-redis-insight` | Redis GUI (points at host Redis) | 8001 → 5540 |
| **kafka** | `sentinel-kafka` | KRaft-mode Kafka broker | 9092 (external), 29092 (internal) |
| **kafka-ui** | `sentinel-kafka-ui` | Kafka topic browser | 8080 |
| **greenmail** | `sentinel-greenmail` | Test SMTP/IMAP server | 3025, 3143, 3993 |
| **roundcube** | `sentinel-roundcube` | Webmail UI for GreenMail | 8888 |
| **api-gateway** | `sentinel-api-gateway` | nginx/OpenResty edge | 5000 |

**Commented out (not running in default compose):**

- `redis` container — replaced by **local host Redis** on port 6379 (services connect via `redis://localhost:6380` in `.env.example`; adjust if your local Redis uses 6379)
- `ftp-harvester` / `email-harvester` — ingestion services run on host via `npm run dev`

### Network Topology

All active containers share the default Docker bridge network. Internal Kafka listener: `kafka:29092`. External clients (host-run Node services) use `localhost:9092`.

The API gateway uses `extra_hosts: host.docker.internal:host-gateway` to reach **host-bound** microservices:

| Upstream | Target |
|----------|--------|
| `email_ftp_service` | `host.docker.internal:3001` |
| `ftp_ftp_service` | `host.docker.internal:3002` |
| `key_vault_service` | `host.docker.internal:8000` |

> **Note:** `ftp-to-ftp-server` defaults to `PORT=3000`. The gateway upstream is configured for port **3002** — align `PORT` or nginx upstream when testing through the gateway.

### Data Persistence

| Storage | Type | Path |
|---------|------|------|
| MinIO objects | Bind mount | `./minio_data:/data` |
| MinIO license | Bind mount (read-only) | `./minio.license:/minio.license:ro` |
| PostgreSQL | Bind mount | `./postgres_data:/var/lib/postgresql/data` |
| Roundcube SQLite | Named volume | `roundcube_data` |

Kafka uses ephemeral broker storage (no volume) — topics are re-created by `poll-orchestrator` on startup via `provisionTopics()`.

### Why Local Redis Instead of Docker Redis

The Redis service block in `docker-compose.yml` is **commented out** with the note: *"Port 6380 used to avoid conflict with your local Redis."* Developers run Redis natively on the host (often already installed for other projects). `redis-insight` connects via `host.docker.internal:6379`. Ingestion services and poll-orchestrator read `REDIS_URL=redis://localhost:6380` — configure to match your local Redis port.

---

## 4. API Gateway (nginx/OpenResty)

File: `api-gateway/nginx.conf`

### Full Routing Table

| Location | Method | Upstream | Rewrite | Auth / Notes |
|----------|--------|----------|---------|--------------|
| `/health` | GET | inline | — | Returns `{"status":"UP"}` |
| `/` | GET | static files | — | Serves `html/index.html` |
| `/api/v1/service/` | * | *(no proxy_pass)* | — | JWT + AES Lua (see below); **does not proxy** without a more-specific block |
| `/api/v1/service/user-managment-service` | * | `user_service` (192.168.1.77:7001) | Strip prefix → backend path | No JWT Lua (specific block overrides generic) |
| `/api/v1/service/mdm-managment-service` | * | `mdm_service` (192.168.1.77:7002) | Strip prefix | No JWT Lua |
| `/api/v1/service/ftp-ingestion` | * | `ftp_ftp_service` (host:3002) | Strip prefix | No JWT Lua; forwards client headers including `x-vault-token` |
| `/api/v1/service/email-ingestion` | * | `email_ftp_service` (host:3001) | Strip prefix | No JWT Lua |
| `/api/v1/service/key-vault` | * | `key_vault_service` (host:8000) | Strip prefix | No JWT Lua; `x-vault-token` passthrough |
| `/__gateway_error_*` | — | internal | — | JSON error pages for 500/502/503/504 |

**Example rewrite:**

```
GET /api/v1/service/ftp-ingestion/api/link-bucket
  → proxy_pass http://ftp_ftp_service/api/link-bucket
```

### JWT Authentication Flow (Lua)

Applies only to the generic `location /api/v1/service/` block (not concrete microservice routes):

1. **`init_by_lua_block`:** Registers public routes in `skipAuth_routes` shared dict (`/`, `/health`).
2. **`rewrite_by_lua_block`:**
   - Skip auth if path+method matches public registry.
   - Require `Authorization: Bearer <token>`.
   - Verify JWT with secret `"omni@123"` via `resty.jwt`.
   - On success: set headers `X-User-ID`, `X-User-Info` (JSON payload).
   - On failure: `401` with JSON error.

### Request Decryption and Response Encryption (AES-128-CBC)

Also in the generic `/api/v1/service/` block:

| Phase | Behavior |
|-------|----------|
| **Request** (`access_by_lua_block`) | If JSON body has `{ "data": "<base64>" }`, decrypt with AES-128-CBC key/IV `"1234567890123456"`, replace body with plaintext JSON |
| **Response** (`body_filter_by_lua_block`) | Buffer full response, encrypt with same key/IV, return `{ "data": "<base64>" }` |
| **Headers** (`header_filter_by_lua_block`) | CORS headers; strip `Content-Length` (body size changes after encryption) |

Controlled by `ngx.shared.config:set("encryption_enabled", true)` in `init_by_lua_block`.

### Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
limit_req zone=api_limit burst=40 nodelay;  # on /api/v1/service/
```

20 requests/second per client IP with burst of 40.

### `host.docker.internal` Bridge

Docker Desktop / Linux `host-gateway` maps `host.docker.internal` to the host machine. This lets containerized nginx reach Node services running via `npm run dev` on the host without containerizing ingestion services.

### CORS Handling

- **Preflight:** `OPTIONS` on `/api/v1/service/` returns 204 with `Access-Control-Allow-Origin`, credentials, methods, and headers.
- **Response:** `Access-Control-Allow-Origin` set to request origin (or `*`).

Allowed headers in preflight: `Authorization`, `Content-Type`, `x-uid` — **`x-vault-token` is not listed** in CORS allow-headers (browser clients may need this added for cross-origin KMS calls).

### `x-vault-token` Passthrough

Concrete microservice location blocks do not strip custom headers. nginx forwards `x-vault-token` from client to upstream by default. The Key Vault route proxies to `host.docker.internal:8000` where Fastify's `verifyVaultToken` validates the header.

---

## 5. Key Vault (KMS) Service

Path: `key-vault/backend/`

### Purpose

A dedicated secret store exists because **TPA source credentials** (FTP passwords, IMAP passwords, cloud access keys) must never live in plaintext in the ingestion database. The KMS provides envelope encryption, ownership-scoped access, and a stable API (`x-vault-token`) that microservices call without implementing crypto themselves.

### Envelope Encryption Architecture

Implementation: `key-vault/backend/src/services/CryptoService.ts` + `SecretService.ts`

```
Plaintext secret
       │
       ▼
┌──────────────────┐
│ Random DEK (32 B)│─── AES-256-GCM ───▶ encryptedBlob + authTag + iv
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ MASTER_ROOT_KEY  │─── AES-256-GCM ───▶ wrappedDek + dekTag + dekIv
└──────────────────┘
```

| Field | Role |
|-------|------|
| `encryptedBlob` | Ciphertext of secret value |
| `authTag`, `iv` | GCM integrity + nonce for payload |
| `wrappedDek`, `dekTag`, `dekIv` | DEK encrypted by 256-bit master key |

`MASTER_ROOT_KEY` must be a **64-character hex string** (32 bytes). Validated at startup in `server.ts`; process exits if invalid.

### `x-vault-token` Lifecycle

| Step | Function | File |
|------|----------|------|
| 1. Provision user | `POST /api/v1/auth/provision` | `routes/authRoutes.ts` |
| 2. Generate raw key | `sv_live_${crypto.randomBytes(24).hex}` | `authRoutes.ts` |
| 3. Store hash | SHA-256 → `User.apiKeyHash` | Prisma `User` model |
| 4. Client stores raw key | Shown once in provision response | — |
| 5. Protected requests | Header `x-vault-token: <rawKey>` | All `/services`, `/secrets` routes |
| 6. Validation | `verifyVaultToken` → hash → lookup User | `middleware/auth.ts` |

Re-provisioning the same `keycloakId` **regenerates** the API key (updates hash).

### Full API Surface

Base prefix: `/api/v1` (except `/health`)

#### Unauthenticated

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/auth/provision` | `{ keycloakId, email }` | `{ message, apiKey, userId }` |
| GET | `/health` | — | `{ status, env, timestamp }` |

#### Protected (`x-vault-token` required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/services` | Create service/channel `{ name, description? }` |
| GET | `/api/v1/services` | List caller's services with secret counts |
| POST | `/api/v1/secrets` | Store `{ serviceId, keyName, value }` — upsert |
| GET | `/api/v1/secrets/:serviceId` | List all decrypted secrets for service |
| GET | `/api/v1/secrets/:serviceId/:keyName` | Get single decrypted secret |
| DELETE | `/api/v1/secrets/by-id/:secretId` | Delete secret (ownership verified) |

Every protected route checks `service.ownerId === request.user.id`.

### Microservice Registration Flow

```
1. POST /api/v1/auth/provision          → apiKey (client stores)
2. POST /api/v1/services                → serviceId
3. POST /api/v1/secrets                 → store ftp:{orgId} or imap:{email} credential object
4. POST /api/link-bucket (ftp service)  → persists kms_service_id + vault_token_encrypted in DB
```

Callers pass plaintext `value` objects — **KMS encrypts via `SecretService.storeSecret` → `CryptoService.encrypt`**. Callers never perform envelope encryption themselves.

### Local AES-256-GCM for `vault_token_encrypted`

Ingestion services encrypt the raw vault API key before storing in Postgres:

```typescript
// poc-v0.1/ftp-to-ftp-server/src/utils/crypto.ts
encryptText(input.vaultToken)  // → iv:tag:ciphertext (hex)
```

Key source: first 32 bytes of `APP_ENCRYPTION_KEY` env var. This is **separate from KMS envelope encryption** because:

- The poll orchestrator must decrypt vault tokens **without calling KMS** (chicken-and-egg: KMS auth requires the token).
- DB backups should not expose raw API keys even if KMS is offline.
- All ingestion services + poll-orchestrator must share the **identical** `APP_ENCRYPTION_KEY`.

---

## 6. Storage Core Library (`@sentinel/storage-core`)

Path: `poc-v0.1/storage-core/`  
Package reference: `"@sentinel/storage-core": "file:../storage-core"` in ingestion service `package.json` files.

### Why a Shared Library, Not a Microservice

File transfer is **synchronous and stream-oriented**. A separate microservice would add network hops for multi-GB PDF streams. The library embeds directly in poll workers and (legacy) in-process poll engines, sharing one implementation for reader strategy selection, landing path construction, and Kafka metadata publish.

### Module Breakdown

| Module | File | Exports |
|--------|------|---------|
| Public API | `src/index.ts` | Re-exports reader, writer, types |
| Reader facade | `src/reader.ts` | `listNewFiles`, `readFromSource`, `resolveProvider`, `resolveDriver` |
| Writer facade | `src/writer.ts` | `writeToLanding`, `buildObjectKey`, `buildKafkaPayload` |
| Kafka client | `src/kafka-client.ts` | `getProducer`, `publishEvent` |
| Types | `src/types.ts` | `ReadInput`, `WriteInput`, `FileDescriptor`, `TransferResult`, `KafkaEventPayload`, driver interfaces |

### Reader Driver Architecture (Strategy Pattern)

```
listNewFiles(input)
  → resolveProvider(input.sourceCredentials)     // credentials.provider
  → resolveDriver(provider)                        // switch on FTP|MINIO|S3|GCP|AZURE
  → driver.listNewFiles(orgId, sourceCredentials)
```

| Provider | Driver file | Status |
|----------|-------------|--------|
| FTP | `drivers/reader/ftp.reader.ts` | **Implemented** — `basic-ftp` tree walk |
| MINIO | `drivers/reader/minio.reader.ts` | **Implemented** |
| S3 | `drivers/reader/s3.reader.ts` | Stub — throws not implemented |
| GCP | `drivers/reader/gcp.reader.ts` | Stub |
| AZURE | `drivers/reader/azure.reader.ts` | Stub |

### Writer Driver Architecture

```
writeToLanding(stream, input, storageConfig)
  → storageConfig.provider                         // MINIO|S3|GCP|AZURE (explicit param from caller)
  → buildObjectKey(input)
  → driver.write(stream, input, objectKey, storageConfig)
  → publishEvent(buildKafkaPayload(...))           // best-effort
```

Each host service (poll-orchestrator, ftp-to-ftp-server, whatsapp-to-ftp-server) resolves `storageConfig` from its **own `.env`** via `buildStorageWriterConfig()` and passes it as the third argument. storage-core writer drivers do **not** read landing credentials from `process.env`.

| Provider | Driver file | Status |
|----------|-------------|--------|
| MINIO | `drivers/writer/minio.writer.ts` | **Implemented** |
| S3 | `drivers/writer/s3.writer.ts` | **Implemented** |
| GCP | `drivers/writer/gcp.writer.ts` | Stub |
| AZURE | `drivers/writer/azure.writer.ts` | Stub |

### `ReadInput` Fields

| Field | Description |
|-------|-------------|
| `orgId` | TPA tenant identifier |
| `fileName` | Placeholder in list context; actual name from `FileDescriptor` during read |
| `mimeType` | MIME type hint |
| `fileSizeBytes` | Size hint |
| `sourceChannel` | e.g. `FTP_INGESTION`, `EMAIL_INGESTION` |
| `sourceCredentials` | Decrypted KMS object; **must include `provider` string** |

### `WriteInput` Fields

| Field | Description |
|-------|-------------|
| `orgId` | Tenant |
| `zoneId` | Geographic/logical zone from parsed source path |
| `contextFolder` | Claim folder name (from source path segment) |
| `fileName` | Destination filename |
| `mimeType` | Content type |
| `fileSizeBytes` | Byte count |
| `sourceChannel` | Channel enum for landing path segment |

### `FileDescriptor` and Path Parsing

Source paths must have **≥ 6 segments** after splitting on `/`:

```
/{segment0}/{zoneId}/{year}/{month}/{claimFolder}/{fileName}
```

Parser: `fileDescriptorFromParts()` in `ftp.reader.ts` / `minio.reader.ts`

| Index | Maps to |
|-------|---------|
| `parts[1]` | `zoneId` |
| `parts[4]` | `claimFolder` |
| `parts[last]` | `fileName` |

Example comment in code: `/Health_Claims/{zoneId}/{YYYY}/{MM_Month}/{CLM-...}/{filename}`

MIME detection: `.pdf` → `application/pdf`, else `application/octet-stream`.

### Landing Bucket Path Pattern

Built by `buildObjectKey()` in `writer.ts`:

```
{orgId}/{zoneId}/{YYYY-MM-DD}/{channel}/{contextFolder}/{fileName}
```

Where `channel = sourceChannel.toLowerCase().replace('_ingestion', '')` — e.g. `FTP_INGESTION` → `ftp`.

### Kafka Publish Flow

| Property | Value |
|----------|-------|
| Topic | `ingestion-events` (constant in `kafka-client.ts`) |
| Client ID | `sentinel-storage-core` |
| Message key | `payload.orgId` |
| Env var | `KAFKA_BROKER` (comma-separated brokers) |
| Producer | Singleton via `getProducer()` |

**Files never pass through Kafka.** Only `KafkaEventPayload` metadata:

```typescript
{
  eventId, timestamp, orgId, sourceChannel,
  payload: { fileName, storageProvider, bucketName, objectKey, fileSizeBytes, mimeType }
}
```

Upload succeeds even if Kafka publish fails (logged, not thrown).

### Multi-Cloud Switching

| Concern | Control |
|---------|---------|
| **Writer** (landing destination) | `StorageWriterConfig` explicit param — built by each host service from its own `.env` (`STORAGE_PROVIDER`, `AWS_*` or `MINIO_*`) via `buildStorageWriterConfig()` |
| **Reader** (TPA source) | `sourceCredentials` param — `provider` field inside KMS-stored credential object |

A TPA can store FTP credentials in KMS while Sentinel lands files to MinIO — reader and writer are independently configured. Both use explicit parameters into storage-core; neither relies on storage-core reading host env for connection credentials (readers may still use env for IMAP mailbox name / TLS dev flags only).

---

## 7. FTP-to-FTP Ingestion Service

Path: `poc-v0.1/ftp-to-ftp-server/`  
Default port: **3000**

### Service Purpose

- Register TPA source buckets/channels (`linkBucket`)
- Initialize daily partition markers (`initToday`)
- Legacy MinIO webhook ingestion (`/api/webhook`)
- Expose health, live feed, and OpenAPI documentation

**Polling has moved** to `poll-orchestrator`; in-process `poll.engine.ts` is disconnected from `server.ts`.

### Full API Surface

See [Section 15](#15-api-reference) for curl examples.

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/ping`, `/api/health/live`, `/api/health/ready` | None |
| POST | `/api/link-bucket` | `x-vault-token` header |
| POST | `/api/init-today`, `/api/onboard-org` | None (POC) |
| GET | `/api/live-feed` | None |
| POST | `/api/webhook` | `x-webhook-signature` if `WEBHOOK_SECRET` set |

### `linkBucket` Flow

**Call chain:**

```
POST /api/link-bucket
  → IntegrationController.linkBucket          (integration.controller.ts)
    → IntegrationService.linkBucket           (integration.service.ts)
      → Minio.Client.putObject(.sentinel_root marker)
      → buildCredentialValue(input)
      → vaultClient.storeSecret({ serviceId, keyName: ftp:{orgId}, value })
      → IngestionChannelRepository.upsert(...)
```

### `buildCredentialValue` — Per-Provider Credential Shapes

| Provider | KMS value shape |
|----------|-----------------|
| **FTP** (default) | `{ provider, host, port, user, password, secure, bucket }` |
| **MINIO** | `{ provider, endpoint, access_key, secret_key, bucket, secure }` |
| **S3** | `{ provider, region, access_key, secret_key, bucket }` |
| **GCP** | `{ provider, project_id, access_key, secret_key, bucket }` |
| **AZURE** | `{ provider, account_name, account_key, container }` |

### `Ingestion_Channel_Master` Schema

Table: `"Ingestion_Channel_Master"` — model: `models/ingestionChannel.model.ts`

| Column | Type | Description |
|--------|------|-------------|
| `organisation_id` | STRING (PK) | TPA org identifier |
| `source_prefix` | STRING | `{orgId}/{zone}/` prefix |
| `source_bucket` | STRING | TPA bucket name |
| `external_username` | STRING | Source access key / FTP user |
| `external_password_encrypted` | TEXT | AES-256-GCM via `encryptText(password)` |
| `region` | STRING | Region or zone label |
| `is_onboarded` | BOOLEAN | Default false; true after linkBucket |
| `kms_service_id` | STRING (nullable) | KMS Service UUID |
| `vault_token_encrypted` | TEXT (nullable) | Encrypted `x-vault-token` for poll workers |
| `createdAt`, `updatedAt` | DATE | Sequelize timestamps |

### KMS Integration

On `linkBucket`:
- Credentials stored in KMS under key `ftp:{orgId}` with caller's `kmsServiceId`
- DB stores `kms_service_id` and `vault_token_encrypted: encryptText(vaultToken)`

Poll orchestrator reads these columns to build `PollJobMessage`.

### Local Encryption of Vault Token

`encryptText` uses `APP_ENCRYPTION_KEY` (32-byte key from env string). Format: `{iv_hex}:{tag_hex}:{ciphertext_hex}`. Poll orchestrator's `decryptText` reverses this before calling KMS.

### Provisioning Flow

**Call chain:**

```
POST /api/init-today  { orgId, zone }
  → ProvisioningController.initToday
    → ProvisioningService.initToday
      → repository.findByOrgId
      → decryptText(external_password_encrypted)  [or migrate legacy plaintext]
      → tpaClient.statObject(.sentinel_root)        [verify hierarchy]
      → tpaClient.putObject({orgId}/{zone}/{today}/.sentinel_ready)
```

Creates daily partition marker: `{orgId}/{zone}/{YYYY-MM-DD}/.sentinel_ready`.

### Migration History: Webhook → Poll Orchestrator

| Era | Mechanism | Entry point |
|-----|-----------|-------------|
| **Legacy** | MinIO bucket notification webhook | `POST /api/webhook` → `IngestionService.processWebhook` |
| **Current** | Scheduled Kafka jobs | `poll-orchestrator` → `handlePollJob` → storage-core |

`server.ts` lines 5–6, 18, 27: `startPolling` / `stopPolling` imports and calls are **commented out**.

### Why `poll.engine.ts` Was Disconnected

In-process polling does not scale across tenants — each ftp-to-ftp instance would duplicate poll loops. The dedicated orchestrator centralizes scheduling, uses Kafka for horizontal worker scaling, and decouples API availability from poll cadence.

File retained for reference; logic mirrors worker pool steps.

### Deduplication (Legacy Webhook / In-Process Poll)

**Webhook / poll.engine dedup key** (`ftp-to-ftp-server/src/utils/dedupKey.ts`):

```
file:dedup:{source}:{orgId}:{bucket}:{filename}:{etag}
```

**Poll orchestrator dedup key** (different format):

```
file:dedup:{source}:{orgId}:{bucket}:{filePath}
```

Legacy flow: Redis `SET key value NX EX 86400` (24h TTL per `.cursorrules`). Poll engine checks `GET` for `processed` state before claiming.

---

## 8. Email-to-FTP Ingestion Service

Path: `poc-v0.1/email-to-ftp-server/`  
Default port: **3001**  
Route prefix: `/api/email-to-ftp`

### Service Purpose

- Register IMAP email sources with KMS-backed credentials
- Poll mailboxes for claim-related emails with PDF attachments
- Upload transcript PDF + attachments to MinIO landing bucket
- Emit Kafka trace events and persist artifact metadata

### Full API Surface

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/email-to-ftp/email-sources` | `x-vault-token` |
| POST | `/api/email-to-ftp/email-source` | `x-vault-token` |
| POST | `/api/email-to-ftp/email-source/test` | `x-vault-token` |
| POST | `/api/email-to-ftp/email-source/preview` | `x-vault-token` |
| POST | `/api/email-to-ftp/email-source/poll-claims` | `x-vault-token` |

Stub modules (`feed/`, `integration/`) exist but are **not registered** in the pipeline index.

### IMAP Polling Architecture — `last_processed_uid` Watermark

**Model:** `Email_Source_Master` — PK: `email_address`, column `last_processed_uid` (integer, default 0).

**Registration** (`ProvisioningService.registerEmailSource`):

```
testImapConnection
  → getMaxUidForMailbox (if startFromCurrentMailboxWatermark !== false)
  → vaultClient.storeSecret({ keyName: imap:{email}, value: { host, port, user, pass } })
  → EmailSourceModel.create({ last_processed_uid: maxUid })
```

**Poll** (`EmailIngestionService.pollClaimEmails`):

```
load EmailSourceModel
  → resolveRegisteredImapCredentials (vault list)
  → ImapFlow: search UIDs where uid > last_processed_uid
  → for each UID: keyword match → PDF extract → MinIO upload → Kafka
  → EmailSourceModel.update({ last_processed_uid: maxSeenUid })
```

Watermark advances for **all scanned UIDs**, even when no claim PDFs matched.

Env: `IMAP_POLL_MAILBOX` (default `INBOX`), `EMAIL_CLAIM_KEYWORDS`, `EMAIL_POLL_MAX_MESSAGES`.

### Why Email Uses Watermark Instead of Redis Dedup (Primary)

IMAP UIDs are monotonic per mailbox — the watermark provides idempotency without per-file Redis keys. Redis dedup **is still used** for attachment uploads within a poll (`buildDedupKey` + `SET NX EX`) to prevent duplicate MinIO objects on retry.

Poll orchestrator explicitly **skips Redis dedup** for `channelType === 'EMAIL'` in `handlePollJob` (watermark is authoritative at the email service layer when called via HTTP; orchestrator EMAIL path is future work).

### KMS Integration Status

| Operation | Status |
|-----------|--------|
| `storeSecret` on registration | **Implemented** |
| `listSecretsForService` for IMAP resolve | **Implemented** (optional `KMS_BASE_URL` routing) |
| `deleteSecret` on registration rollback | **Implemented** |
| `IngestionChannelModel.kms_service_id` | Model exists; **not used** by email pipeline |
| Local `encryptText` for vault tokens | **Not used** in email paths (serviceId + vault token passed per request) |

---

## 9. Poll Orchestrator Service

Path: `poc-v0.1/poll-orchestrator/`

### Why a Dedicated Orchestrator

| Problem | Solution |
|---------|----------|
| N tenants × poll interval in each API pod | Single scheduler publishes Kafka jobs |
| Credential fetch + list + transfer is slow | Worker pool with `pLimit` concurrency |
| API restarts interrupt polling | Kafka consumer group resumes |
| Vault tokens needed at poll time | Encrypted in DB, decrypted per job |

### Architecture

```
startScheduler() ──setInterval──▶ runCycle()
                                    │
                                    ▼
                          IngestionChannel.findActiveForPolling()
                                    │
                                    ▼
                          publishPollJob() ──▶ poll-jobs topic
                                    │
                                    ▼
startWorkerPool() ──consumer──▶ handlePollJob()
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              decryptText    listSecretsForService  listNewFiles
                    │               │               │
                    └───────────────┴───────────────┘
                                    ▼
                          readFromSource → writeToLanding
                                    │
                                    ▼
                          ingestion-events topic
```

### Scheduler — `startScheduler` / `stopScheduler`

File: `scheduler/cron.ts`

- `startScheduler()`: `setInterval(runCycle, config.pollIntervalMs)` — default 300000 ms (5 min)
- `stopScheduler()`: `clearInterval`
- **First cycle runs after first interval elapses** (no immediate `runCycle()` on startup)

### `runCycle` — Building `PollJobMessage`

```typescript
for (const channel of await IngestionChannel.findActiveForPolling()) {
  await publishPollJob({
    credId: `${channel.organisation_id}:${kmsServiceId}`,
    orgId: channel.organisation_id,
    zoneId: channel.region,
    kmsServiceId,
    vaultToken: channel.vault_token_encrypted!,  // still encrypted
    channelType: detectChannelType(kmsServiceId), // always 'FTP' today
    scheduledAt: new Date().toISOString(),
  })
}
```

Eligibility: `is_onboarded=true`, non-null `kms_service_id` and `vault_token_encrypted`.

### `PollJobMessage` Interface

File: `kafka.ts`

| Field | Purpose |
|-------|---------|
| `credId` | Kafka message key; `{orgId}:{kmsServiceId}` |
| `orgId` | Tenant |
| `zoneId` | From `region` column |
| `kmsServiceId` | KMS service UUID for secret lookup |
| `vaultToken` | **Encrypted** vault API key (decrypted in worker via `decryptText`) |
| `channelType` | `FTP` \| `EMAIL` \| `WHATSAPP` |
| `scheduledAt` | ISO timestamp of scheduling |

Keeping `vaultToken` encrypted in Kafka messages limits exposure if a topic is compromised — workers decrypt with shared `APP_ENCRYPTION_KEY`.

### Worker Pool

| Property | Value |
|----------|-------|
| Consumer group | `poll-orchestrator-workers` |
| Topic | `config.pollJobsTopic` (default `poll-jobs`) |
| Message concurrency | `pLimit(config.pollConcurrency)` — default 10 |
| File concurrency | Inner `pLimit(config.pollConcurrency)` per job |

### `handlePollJob` Step-by-Step

File: `workers/pool.ts`

1. `decryptText(job.vaultToken)` → plain vault API key
2. `vaultClient.listSecretsForService(job.kmsServiceId, plainVaultToken)`
3. Find secret with `value.provider` → `sourceCredentials`
4. `sourceChannelForType(job.channelType)` → e.g. `FTP_INGESTION`
5. `listNewFiles({ orgId, sourceCredentials, sourceChannel, ... })`
6. For each file:
   - **EMAIL:** skip Redis dedup → `transferFile`
   - **FTP/WHATSAPP:** Redis 3-step dedup → `transferFile`
7. `transferFile`: `readFromSource` → `writeToLanding`

### Redis Dedup Implementation

Key format (`poll-orchestrator/src/utils/dedupKey.ts`):

```
file:dedup:{source}:{orgId}:{bucket}:{filePath}
```

Where `bucket = file.filePath.split('/')[1]` (zoneId segment).

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `SET dedupKey 'processing' EX ttl NX` | Claim file |
| 2 | `SET dedupKey 'processed' EX ttl` | Mark success |
| 3 | `DEL dedupKey` | Release on failure for retry |

Default TTL: `DEDUP_TTL_SEC=604800` (7 days).

### Why EMAIL Skips Redis Dedup

Email channels use IMAP UID watermarks (`last_processed_uid`) managed by the email service. File-path dedup would conflict with UID-based semantics. Orchestrator EMAIL branch transfers directly (future: should delegate to email service HTTP poll endpoint).

### Kafka Topic Auto-Provisioning

`provisionTopics()` in `kafka.ts` creates if missing:

| Topic | Partitions | Replication |
|-------|------------|-------------|
| `poll-jobs` | 3 | 1 |
| `ingestion-events` | 3 | 1 |

Uses Kafka Admin API on startup.

### Graceful Shutdown

File: `index.ts` — on `SIGINT`/`SIGTERM`:

1. `stopScheduler()`
2. `stopWorkerPool()` — consumer stop + disconnect
3. `disconnectRedis()`
4. `sequelize.close()`
5. `process.exit(0)`

### `channelType` Defaulting to FTP

`detectChannelType()` returns hardcoded `'FTP'`. The `Ingestion_Channel_Master` table has **no `channel_type` column** yet — all channels are treated as FTP for orchestrator purposes.

### Startup Order

```
main()
  → provisionTopics()
  → sequelize.authenticate()
  → connectRedis()
  → startWorkerPool()
  → startScheduler()
```

---

## 10. Data Flows

### End-to-End FTP Ingestion (Current Architecture)

```
1. TPA Admin: POST /api/v1/auth/provision → apiKey
2. TPA Admin: POST /api/v1/services → kmsServiceId
3. TPA Admin: POST /api/link-bucket (x-vault-token)
     → IntegrationService.linkBucket
     → KMS secret ftp:{orgId} + DB row with vault_token_encrypted

4. TPA Admin: POST /api/init-today
     → ProvisioningService.initToday
     → .sentinel_ready marker for today

5. poll-orchestrator scheduler (every POLL_INTERVAL_MS):
     → runCycle → publishPollJob → poll-jobs

6. Worker handlePollJob:
     → decryptText(vaultToken)
     → vaultClient.listSecretsForService
     → listNewFiles (storage-core / ftp.reader)
     → Redis dedup SET NX
     → readFromSource → writeToLanding
     → publishEvent → ingestion-events

7. Downstream consumer reads ingestion-events metadata, fetches file from MinIO landing bucket
```

### End-to-End Email Ingestion (Current State)

Email ingestion is **on-demand via HTTP**, not yet driven by poll-orchestrator for production scheduling:

```
1. POST /api/email-to-ftp/email-source (register + watermark)
2. POST /api/email-to-ftp/email-source/poll-claims (manual or external cron)
     → EmailIngestionService.pollClaimEmails
     → IMAP UID scan → keyword match → PDF + transcript to MinIO
     → producer.send (claims-ingestion-trace topic in email service)
     → update last_processed_uid
```

Future: poll-orchestrator `channelType=EMAIL` should invoke email poll endpoint or embed IMAP logic.

### Dedup Key Structures

| Context | Format |
|---------|--------|
| Poll orchestrator (FTP) | `file:dedup:ftp:{orgId}:{zoneId}:{filePath}` |
| ftp-to-ftp-server (legacy) | `file:dedup:ftp:{orgId}:{bucket}:{filename}:{etag}` |
| Email attachments | `file:dedup:email:{orgId}:imap:{emailKey}:...` |

### Kafka Topic Inventory

| Topic | Partitions | Producer | Consumer | Schema |
|-------|------------|----------|----------|--------|
| `poll-jobs` | 3 | poll-orchestrator scheduler | poll-orchestrator workers | `PollJobMessage` JSON |
| `ingestion-events` | 3 | storage-core `publishEvent` | *(downstream TBD)* | `KafkaEventPayload` JSON |
| `claims-ingestion-trace` | — | email/ftp webhook services | *(legacy)* | `IngestionTraceEvent` |

---

## 11. Multi-Tenancy Model

### TPA Representation

A TPA is identified by **`orgId`** (string, min 2 chars in schemas). It appears in:

- `Ingestion_Channel_Master.organisation_id` (PK)
- KMS secret keys: `ftp:{orgId}`
- Landing paths: `{orgId}/{zoneId}/...`
- Kafka message keys: `orgId`

### Multiple Insurance Providers Under One TPA

Structure source paths as:

```
/{root}/{zoneId}/{year}/{month}/{claimFolder}/{fileName}
```

Each insurer can map to a different `zoneId` segment. One TPA (`orgId`) can link multiple zones via separate provisioning calls or multiple channel rows (current PK limitation: **one row per orgId** — multiple insurers may require multiple org IDs or future schema change).

### Credential Isolation in KMS

Each TPA user provisions a KMS `User` → creates `Service` records → stores secrets scoped to `serviceId`. `verifyVaultToken` + `ownerId` checks prevent cross-tenant secret access.

### Landing Bucket Namespacing

All tenants share the landing bucket (`MINIO_BUCKET` / `sentinel-landing-bucket`) with path prefix `{orgId}/` — logical isolation without per-tenant buckets.

### Current Limitation

- `channelType` defaults to `FTP` — email/WhatsApp channels not distinguished in orchestrator
- `organisation_id` is PK — **one ingestion channel row per org**

---

## 12. Security Architecture

### Encryption at Rest

| Data | Mechanism |
|------|-----------|
| KMS secrets | AES-256-GCM envelope (DEK + `MASTER_ROOT_KEY`) |
| `vault_token_encrypted` column | AES-256-GCM via `APP_ENCRYPTION_KEY` |
| `external_password_encrypted` column | Same local AES-256-GCM |
| MinIO objects | Server-side encryption depends on MinIO deployment config |

### Encryption in Transit

TLS expected in production for KMS (`SSL_KEY_PATH`, `SSL_CERT_PATH` in `server.ts`), IMAP (`secure: true`), and FTP (`secure: true`). POC disables strict TLS for GreenMail/self-signed certs via `ALLOW_INSECURE_IMAP_TLS`.

### Secret Isolation

No plaintext credentials in application DB. Webhook and API handlers read credentials from KMS at runtime (poll workers) or from encrypted columns decrypted in-memory only.

### `x-vault-token` Lifecycle

Provisioned once → SHA-256 hashed in KMS DB → raw key stored by client → passed on each KMS and link-bucket request → re-provision rotates hash.

### JWT Auth on Gateway

Development secret: `"omni@123"` in `nginx.conf` line 208. **Must be rotated before production.**

Concrete microservice routes bypass JWT Lua — they rely on service-level auth (`x-vault-token` on protected endpoints).

### AES-128-CBC Gateway Encryption

Development-level request/response wrapping with static key/IV `"1234567890123456"`. Not production-grade — replace with per-session keys or disable (`encryption_enabled` flag).

### `APP_ENCRYPTION_KEY`

Must be **identical** across:

- `ftp-to-ftp-server`
- `email-to-ftp-server`
- `poll-orchestrator`

32+ character string; first 32 bytes used as AES-256-GCM key.

---

## 13. Known Gaps and Future Work

| Gap | Status |
|-----|--------|
| `channel_type` DB column missing | All channels default to FTP in orchestrator |
| S3, GCP, Azure reader/writer drivers | Stubs throw "not yet implemented" |
| No Redis dedup for EMAIL in orchestrator | By design — watermark at email service |
| Audit trail service | Prisma `AuditLog` model exists; no HTTP writes |
| WhatsApp pipeline | Stub only (`WHATSAPP_INGESTION` channel type mapped) |
| Gateway JWT secret | Hardcoded `omni@123` — rotate for production |
| `poll.engine.ts` in ftp-to-ftp | Disconnected but not deleted |
| No HTTP health endpoint on poll-orchestrator | Process logs only |
| Docker deployment of ingestion services | Commented out in compose |
| Kubernetes migration | Pending |
| nginx FTP upstream port 3002 vs service default 3000 | Configuration mismatch |
| Scheduler first cycle delay | No immediate `runCycle()` on startup |
| Gateway CORS | `x-vault-token` not in allowed headers list |

---

## 14. Environment Variables Reference

### Key Vault (`key-vault/backend`)

| Variable | Required | Default | Controls |
|----------|----------|---------|----------|
| `PORT` | No | 3000 | HTTP listen port (use 8000 in dev) |
| `NODE_ENV` | No | development | HTTPS + CORS behavior |
| `DATABASE_URL` | **Yes** | — | Prisma PostgreSQL connection |
| `MASTER_ROOT_KEY` | **Yes** | — | 64-char hex envelope master key |
| `SSL_KEY_PATH` | Prod | — | TLS private key |
| `SSL_CERT_PATH` | Prod | — | TLS certificate |
| `ALLOWED_ORIGIN` | Prod | — | CORS origin |

### ftp-to-ftp-server

| Variable | Required | Example | Controls |
|----------|----------|---------|----------|
| `PORT` | No | `3000` | HTTP port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `DB_URL` | **Yes** | `postgres://...sentinel_mdm` | Sequelize |
| `REDIS_URL` | **Yes** | `redis://localhost:6380` | Dedup client |
| `KAFKA_BOOTSTRAP_SERVERS` | No | `localhost:9092` | Legacy producer |
| `KAFKA_CLIENT_ID` | No | `sentinel-core` | Kafka client name |
| `STORAGE_PROVIDER` | No | `MINIO` | storage-core writer |
| `MINIO_ENDPOINT` | No | `localhost` | MinIO host |
| `MINIO_PORT` | No | `9000` | MinIO port |
| `MINIO_USE_SSL` | No | `false` | TLS to MinIO |
| `MINIO_ACCESS_KEY` | **Yes** | `minioadmin` | Sentinel MinIO creds |
| `MINIO_SECRET_KEY` | **Yes** | `minioadmin` | Sentinel MinIO creds |
| `MINIO_BUCKET` | No | `sentinel-landing-bucket` | Landing bucket |
| `KAFKA_BROKER` | No | `localhost:9092` | storage-core producer |
| `VAULT_URL` | **Yes** | `http://localhost:8000/api/v1` | KMS API base |
| `KMS_BASE_URL` | No | `http://localhost:8000` | KMS list override |
| `APP_ENCRYPTION_KEY` | **Yes** | 32-char hex | Local column encryption |
| `POLL_INTERVAL_MS` | No | `300000` | Legacy poll engine |
| `POLL_CONCURRENCY` | No | `5` | Legacy poll engine |
| `LANDING_BUCKET` | No | `sentinel-landing-bucket` | Webhook landing |
| `INGESTION_TOPIC` | No | `claims-ingestion-trace` | Webhook Kafka topic |
| `DEDUP_TTL_SEC` | No | `86400` | Redis TTL (24h) |
| `WEBHOOK_SECRET` | No | `""` | HMAC webhook auth |
| `ENABLE_SWAGGER_UI` | No | auto | OpenAPI UI |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `LOG_PRETTY` | No | — | Pretty print logs |

### email-to-ftp-server

Same as ftp-to-ftp-server except:

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3001` | Avoid port clash |
| `POLL_*` | — | Not used (orchestrator handles scheduling) |
| `EMAIL_CLAIM_KEYWORDS` | `Claims,Claim,Health,Claim-Form` | IMAP keyword filter |
| `EMAIL_POLL_MAX_MESSAGES` | `50` | Max UIDs per poll |
| `EMAIL_CLAIM_BODY_STORE_MAX` | `262144` | Body storage limit |
| `DEFAULT_EMAIL_ZONE` | `eu-central-1` | Landing zone default |
| `IMAP_POLL_MAILBOX` | `INBOX` | Poll mailbox |
| `IMAP_PREVIEW_MAILBOX` | `INBOX` | Preview mailbox |
| `ALLOW_INSECURE_IMAP_TLS` | — | Dev GreenMail TLS |

### poll-orchestrator

| Variable | Required | Example | Controls |
|----------|----------|---------|----------|
| `DB_URL` | **Yes** | `postgres://...` | Channel query |
| `KAFKA_BROKER` | **Yes** | `localhost:9092` | Kafka client |
| `POLL_JOBS_TOPIC` | No | `poll-jobs` | Job topic name |
| `KMS_BASE_URL` | No | `http://localhost:8000` | Secret list URL |
| `VAULT_URL` | No | `http://localhost:8000/api/v1` | Vault CRUD |
| `POLL_INTERVAL_MS` | No | `300000` | Scheduler interval |
| `POLL_CONCURRENCY` | No | `10` | Worker parallelism |
| `REDIS_URL` | No | `redis://localhost:6380` | Dedup |
| `DEDUP_TTL_SEC` | No | `604800` | Dedup TTL (7d) |
| `APP_ENCRYPTION_KEY` | **Yes** | 32-char hex | Vault token decrypt |
| `STORAGE_PROVIDER` | No* | `MINIO` | Passed to storage-core |
| `MINIO_*` | No* | — | Landing writer config |

\*Required when workers execute `writeToLanding`.

### storage-core (read by embedding process)

| Variable | Required | Controls |
|----------|----------|----------|
| `STORAGE_PROVIDER` | **Yes** | Writer driver selection |
| `KAFKA_BROKER` | **Yes** | `ingestion-events` producer |
| `MINIO_ENDPOINT` | MINIO | Writer endpoint |
| `MINIO_PORT` | MINIO | Writer port |
| `MINIO_USE_SSL` | MINIO | Writer TLS |
| `MINIO_ACCESS_KEY` | MINIO | Writer credentials |
| `MINIO_SECRET_KEY` | MINIO | Writer credentials |
| `MINIO_BUCKET` | MINIO | Landing bucket name |

---

## 15. API Reference

### Key Vault

#### Provision User

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/provision \
  -H "Content-Type: application/json" \
  -d '{"keycloakId":"tpa-admin-1","email":"admin@tpa.example"}'
```

Response: `{ "message", "apiKey": "sv_live_...", "userId" }`

#### Create Service

```bash
curl -s -X POST http://localhost:8000/api/v1/services \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{"name":"FTP Channel TPA-001","description":"Primary FTP ingestion"}'
```

#### Store Secret

```bash
curl -s -X POST http://localhost:8000/api/v1/secrets \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{
    "serviceId": "SERVICE_UUID",
    "keyName": "ftp:TPA-001",
    "value": {
      "provider": "FTP",
      "host": "ftp.insurer.example",
      "port": 21,
      "user": "claims_user",
      "password": "secret",
      "secure": false,
      "bucket": "insurer-claims-bucket"
    }
  }'
```

#### List Secrets

```bash
curl -s http://localhost:8000/api/v1/secrets/SERVICE_UUID \
  -H "x-vault-token: sv_live_YOUR_KEY"
```

#### Health

```bash
curl -s http://localhost:8000/health
```

---

### ftp-to-ftp-server (port 3000)

#### Link Bucket

```bash
curl -s -X POST http://localhost:3000/api/link-bucket \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{
    "orgId": "TPA-001",
    "zone": "eu-central-1",
    "username": "minioadmin",
    "password": "minioadmin",
    "bucketName": "tpa-source-bucket",
    "kmsServiceId": "SERVICE_UUID",
    "ftpHost": "localhost",
    "ftpPort": 21,
    "provider": "FTP"
  }'
```

Response: `{ "status": "success", "message": "...", "is_onboarded": true }`

#### Initialize Today's Partition

```bash
curl -s -X POST http://localhost:3000/api/init-today \
  -H "Content-Type: application/json" \
  -d '{"orgId":"TPA-001","zone":"eu-central-1"}'
```

Response: `{ "message": "Daily partition YYYY-MM-DD is now active.", "path": "..." }`

#### Live Feed

```bash
curl -s http://localhost:3000/api/live-feed
```

#### Webhook (Legacy)

```bash
curl -s -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: HMAC_SHA256_HEX" \
  -d '{"Records":[...]}'
```

#### Health

```bash
curl -s http://localhost:3000/api/health/ready
```

---

### email-to-ftp-server (port 3001)

#### Register Email Source

```bash
curl -s -X POST http://localhost:3001/api/email-to-ftp/email-source \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{
    "email": "claims@hitpa.local",
    "serviceId": "SERVICE_UUID",
    "organisationId": "TPA-001",
    "imapHost": "localhost",
    "imapPort": 3143,
    "imapUser": "claims@hitpa.local",
    "imapPassword": "claims-pass",
    "startFromCurrentMailboxWatermark": true
  }'
```

#### Poll Claim Emails

```bash
curl -s -X POST http://localhost:3001/api/email-to-ftp/email-source/poll-claims \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{
    "email": "claims@hitpa.local",
    "serviceId": "SERVICE_UUID",
    "limit": 50,
    "resetCursor": false
  }'
```

#### Test IMAP Connection

```bash
curl -s -X POST http://localhost:3001/api/email-to-ftp/email-source/test \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{"email":"claims@hitpa.local","serviceId":"SERVICE_UUID"}'
```

#### List Email Sources

```bash
curl -s "http://localhost:3001/api/email-to-ftp/email-sources?orgId=TPA-001" \
  -H "x-vault-token: sv_live_YOUR_KEY"
```

---

### Via API Gateway (port 5000)

```bash
# FTP link-bucket through gateway (ensure ftp service listens on port 3002 or update nginx upstream)
curl -s -X POST http://localhost:5000/api/v1/service/ftp-ingestion/api/link-bucket \
  -H "Content-Type: application/json" \
  -H "x-vault-token: sv_live_YOUR_KEY" \
  -d '{ "orgId":"TPA-001", "zone":"eu-central-1", ... }'

# Key Vault through gateway
curl -s http://localhost:5000/api/v1/service/key-vault/health
```

---

### poll-orchestrator

No HTTP API. Operates as a background process:

```bash
cd poc-v0.1/poll-orchestrator && npm run dev
```

Monitor via stdout logs: `[scheduler]`, `[poll-worker]`, `[kafka]` prefixes.

---

## Appendix: Key Function Call Chains

### FTP Transfer (Poll Orchestrator)

```
index.ts:main()
  → workers/pool.ts:startWorkerPool()
    → workers/pool.ts:handlePollJob()
      → utils/crypto.ts:decryptText()
      → utils/vault-client.ts:vaultClient.listSecretsForService()
      → @sentinel/storage-core:listNewFiles()
        → reader.ts:resolveProvider() → resolveDriver()
        → drivers/reader/ftp.reader.ts:ftpReaderDriver.listNewFiles()
      → utils/dedupKey.ts:buildDedupKey()
      → redis.ts:getRedisClient().set(..., 'NX')
      → @sentinel/storage-core:readFromSource()
      → @sentinel/storage-core:writeToLanding()
        → writer.ts:buildObjectKey()
        → drivers/writer/minio.writer.ts:minioWriterDriver.write()
        → kafka-client.ts:publishEvent()
```

### Channel Registration (FTP)

```
integration.routes.ts → integration.controller.ts:IntegrationController.linkBucket()
  → integration.service.ts:IntegrationService.linkBucket()
    → utils/vault-client.ts:vaultClient.storeSecret()
    → utils/crypto.ts:encryptText()
    → repositories/ingestionChannel.repository.ts:upsert()
```

---

*This document reflects the codebase state as of POC v0.1. For migration commands, see individual service README files. For Key Vault setup, see `key-vault/backend/SETUP.md`.*
