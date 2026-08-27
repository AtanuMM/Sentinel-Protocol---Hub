# WhatsApp Integration — Backend Status

> ⚠️ **TO CONTINUE THIS WORK:** Open this Claude conversation — it has the full context of everything built, tested, and decided so far:
>
> 🔗 **https://claude.ai/share/332b3235-f75a-4702-b8f4-77c71de35447**
>
> Paste that link into a new Claude chat and continue from there instead of starting from scratch.

## What This Covers

`whatsapp-to-ftp-server` is the Sentinel Protocol microservice that receives Meta WhatsApp Cloud API webhooks, deduplicates inbound messages, publishes normalized events to Kafka, and consumes those events in a media harvester worker that downloads attachments (when present), generates transcript PDFs, and writes everything to the tenant landing bucket via `@sentinel/storage-core`. It also exposes provisioning APIs for Meta Embedded Signup onboarding (connect/list/disconnect channel) and per-channel landing storage configuration. The companion frontend that triggers Embedded Signup lives in [`../../ngenclaim-mock/WHATSAPP_INTEGRATION_STATUS.md`](../../ngenclaim-mock/WHATSAPP_INTEGRATION_STATUS.md).

---

## Completed & Verified

### Meta webhook verification (GET handshake)

- **What:** Handles Meta's `hub.mode=subscribe` challenge; returns `hub.challenge` when `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`.
- **Files:** `src/modules/pipelines/whatsapp-to-ftp/webhook/webhook.controller.ts`, `webhook.service.ts` (`handleVerification`), `webhook.routes.ts` (`GET /api/v1/whatsapp/webhook`).
- **Evidence:** Verified against a public ngrok tunnel (`1dc8-122-176-164-157.ngrok-free.app` in server logs) after routes were moved under `/api/v1/`. Meta Developer Console webhook verification succeeded with the ngrok callback URL.

### HMAC signature verification (POST)

- **What:** Requires `X-Hub-Signature-256`; verifies `sha256=<hex>` HMAC of the raw body against `WHATSAPP_APP_SECRET` using timing-safe comparison. Raw body is preserved via a custom JSON parser registered before routes.
- **Files:** `src/app.ts` (raw body parser), `src/modules/pipelines/whatsapp-to-ftp/webhook/signature.ts`, `webhook.service.ts` (`handleIncomingWebhook`).
- **Evidence:** Invalid/missing signatures return 403; valid signed POSTs from Meta reach the handler and return `{ status: "EVENT_RECEIVED" }`.

### Message type handling (text, document, image)

- **What:** Builds `WhatsappRawEvent` discriminated union for `text`, `document`, and `image`. Skips `audio`, `video`, `location`, `interactive`, `sticker`, `reaction` with a debug log. Text without `text.body` is dropped silently.
- **Files:** `src/modules/pipelines/whatsapp-to-ftp/types/webhook.ts`, `webhook.service.ts` (`buildRawEvent`, `SKIPPED_MESSAGE_TYPES`).
- **Evidence:** Real inbound messages on the production test WABA number were processed through this path (see media harvester item below). TypeScript compiles cleanly (`npm run typecheck`).

### Redis-based dedup

- **What:** Before Kafka publish, claims `whatsapp:dedup:{messageId}` with `SET ... NX EX {dedupTtlSec}` (default 86400s). Duplicate deliveries are skipped. If Redis is unavailable, logs a warning and proceeds (fail-open on dedup only).
- **Files:** `webhook.service.ts` (`tryClaimMessageDedup`), `src/config/index.ts` (`dedupTtlSec`).
- **Evidence:** Observed during live webhook testing — Meta retries did not produce duplicate Kafka events for the same `wamid`.

### Kafka producer → media harvester consumer

- **What:** Webhook publishes JSON `WhatsappRawEvent` to topic `whatsapp-raw-events` (configurable via `WHATSAPP_RAW_EVENTS_TOPIC`). Media harvester runs in-process (`startMediaHarvester` from `server.ts`), consumer group `whatsapp-media-harvester`, `fromBeginning: false`.
- **Files:** `webhook.service.ts` (`publishRawEvent`), `src/modules/pipelines/whatsapp-to-ftp/workers/media-harvester.ts`, `src/server.ts`, `src/infra/clients.ts`.
- **Evidence:** Live text messages on test number `15556721145` produced harvester success logs (`[media-harvester] ✅ messageId=... uploaded transcript=...`).

### End-to-end ingestion on test WABA (text → S3 transcript)

- **What:** Text messages generate a transcript PDF only; document/image messages download media from Meta Graph API v20.0 then upload media + transcript.
- **Files:** `media-harvester.ts`, `transcript-gen.ts`.
- **Evidence:** Confirmed via real WhatsApp text message sent to Meta test number **15556721145** (stored as `whatsapp_channels.phone_number`). Transcript PDF landed in S3 bucket **`ngenclaims-landing-bucket-test`** (channel row `id=1`, `landing_storage_provider=S3`, `landing_region=ap-south-1`). Harvester log line confirmed upload with the expected object key prefix `TPA_TEST_001/ZONE_01/{date}/whatsapp/`.

### Storage config: MinIO-vs-S3 env misconfiguration (fixed)

- **What was wrong:** `media-harvester` originally called a single global `buildStorageWriterConfig()` driven by `STORAGE_PROVIDER` in `.env`. With `STORAGE_PROVIDER=MINIO` (the `.env.example` default), all writes went to MinIO even when the intended destination was AWS S3.
- **Fix:** Renamed global builder to `buildStorageWriterConfigFromEnv()` and added `buildStorageWriterConfigForChannel(channel)` in `src/config/index.ts`. Harvester now calls the per-channel builder. Channels without `landing_storage_provider` fall back to global env with a one-time console warning.
- **Evidence:** Audit traced the MinIO writes to env defaults; after `STORAGE_PROVIDER=S3` + AWS vars (or per-channel S3 config on the DB row), uploads reached S3.

### Phase 2: Per-channel landing storage columns + PATCH endpoint

- **What:** Migration adds nullable `landing_*` columns on `whatsapp_channels`. Credentials stored in key-vault with explicit `type: "LANDING"` (distinct from `type: "META_WHATSAPP"`). `PATCH /api/v1/whatsapp-to-ftp/whatsapp-channel/:id/landing-storage` stores credentials in vault and metadata on the row. `buildStorageWriterConfigForChannel()` refuses to fall back to global env when `landing_storage_provider` is set but no LANDING secret exists (fail-closed).
- **Files:** `migrations/20260827000001-add-whatsapp-channel-landing-storage.cjs`, `src/models/whatsapp-channel.model.ts`, `src/repositories/whatsappChannel.repository.ts`, `src/config/index.ts`, `provisioning/provisioning.service.ts` (`updateChannelLandingStorage`), `provisioning.routes.ts`, `provisioning.schemas.ts`, `scripts/test-landing-storage-config.ts`.
- **Evidence:** Migration applied; DB row `id=1` has `landing_storage_provider=S3`, `landing_bucket=ngenclaims-landing-bucket-test`. Script `npx tsx scripts/test-landing-storage-config.ts success 1` returned S3 config with redacted credentials when key-vault was running; `fail-closed 1` correctly threw *"no LANDING secret found in KMS"* against an empty service.

### Credential redaction in logs (security fix)

- **What:** `writeToLanding` in `@sentinel/storage-core` no longer logs plaintext `accessKeyId` / `secretAccessKey` / MinIO keys. Uses `redactStorageConfig()` before logging.
- **Files:** `poc-v0.1/storage-core/src/utils/redactStorageConfig.ts`, `poc-v0.1/storage-core/src/writer.ts`.
- **Evidence:** Code review + grep confirmed no raw credential fields in log statements; manual log inspection after S3 uploads showed `***REDACTED***` for key fields.

### S3 object key / folder naming convention

- **What:** Object keys follow storage-core layout:
  `{orgId}/{zoneId}/{YYYY-MM-DD}/whatsapp/{HHmmss}_{phone}_{messageType}_{shortWamid}/{fileName}`
  where `shortWamid` = last 10 chars of Meta message id, `HHmmss` = UTC time from Meta `messages[].timestamp`, phone has spaces/`+` stripped.
  Transcript filename: `transcript_{shortWamid}.pdf`. Full wamid stored in object metadata key `message-id`.
- **Files:** `media-harvester.ts` (`deriveContextFolder`, `deriveTranscriptFileName`, `buildWhatsAppObjectMetadata`), `storage-core/src/writer.ts` (`buildObjectKey`).
- **Evidence:** Verified on real upload — example folder `130605_15556721145_text_k0QUVBMjMA` under prefix `TPA_TEST_001/ZONE_01/2026-08-06/whatsapp/`.

### Provisioning API (connect / list / disconnect)

- **What:** `POST /api/v1/whatsapp-to-ftp/whatsapp-channel` exchanges Embedded Signup auth code, fetches WABA + phone, calls `/{wabaId}/subscribed_apps`, stores `META_WHATSAPP` secret in vault, inserts `whatsapp_channels` row. List and soft-disconnect endpoints implemented.
- **Files:** `provisioning/provisioning.service.ts`, `provisioning.controller.ts`, `provisioning.routes.ts`, `provisioning.schemas.ts`.
- **Evidence:** Typecheck passes; route registered under `/api/v1/whatsapp-to-ftp/`. Not yet verified end-to-end from the ngenclaim-mock UI (see below).

### Health + route structure under `/api/v1`

- **What:** All service routes live under `/api/v1/` prefix in `app.ts`. Meta webhook: `/api/v1/whatsapp/webhook`. Swagger at `/documentation`.
- **Files:** `src/app.ts`, `src/modules/health/`.
- **Evidence:** ngrok health-check traffic confirmed public reachability after prefix fix.

---

## Completed But NOT Yet Verified End-to-End

### Embedded Signup connect from ngenclaim-mock → this backend

- **Built:** Full server-side connect flow in `ProvisioningService.connectWhatsappChannel`.
- **Why not proven:** Frontend posts to this API but no real client WABA has been taken through Embedded Signup → authorization code → `POST /whatsapp-channel` → success response in the integrated UI test.
- **Proof needed:** Complete Meta popup in ngenclaim-mock, observe `201` with real `phoneNumber` and `wabaId`, confirm new row in `whatsapp_channels` and `META_WHATSAPP` secret in vault.

### `subscribed_apps` on connect when Tech Provider approval is pending

- **Built:** Connect flow POSTs to `/{wabaId}/subscribed_apps` but **swallows errors** (warn-only) — see `provisioning.service.ts` lines 142–150.
- **Operational finding:** The existing production/test WABA was **not receiving webhooks** until a **manual** `POST /{wabaId}/subscribed_apps` Graph API call was made outside the normal connect path. After that, inbound messages flowed.
- **Why new Embedded Signup clients should be fine:** A successful connect (once Tech Provider permissions allow) runs the same `subscribed_apps` call automatically during `connectWhatsappChannel`. The manual fix was specific to a WABA connected before subscription was in place.
- **Proof needed:** Connect a fresh WABA via Embedded Signup and confirm webhook events arrive without manual Graph API intervention.

### Document and image media download + dual upload

- **Built:** `processMediaEvent` downloads from Meta CDN and writes media file + transcript.
- **Why not proven:** Live testing confirmed **text → transcript** on test number `15556721145`. Document/image paths are implemented and type-checked but not confirmed with a real attachment on this WABA in the current environment.
- **Proof needed:** Send a PDF document and a JPEG image to the connected number; confirm both original file and `transcript_{shortWamid}.pdf` appear in the landing bucket.

### Per-channel PATCH landing-storage in production

- **Built:** `PATCH /api/v1/whatsapp-to-ftp/whatsapp-channel/:id/landing-storage`.
- **Why not proven:** Config builder verified via script against channel `id=1`; no test of the HTTP PATCH endpoint itself with curl/UI.
- **Proof needed:** `PATCH` with S3 credentials, then send a message on that channel and confirm write uses the patched bucket/region.

### Phase 2 script re-run (current environment)

- **Note:** `scripts/test-landing-storage-config.ts` requires key-vault on `localhost:8000`. It passed during Phase 2 implementation but **fails with `ECONNREFUSED` when vault is stopped** (as of this handover write).

---

## Known Gaps / Explicitly Deferred

| Gap | Reason deferred | Risk |
|-----|-----------------|------|
| **No auth on `PATCH .../landing-storage`** | Flagged as internal admin endpoint; auth middleware not added in Phase 2 | Anyone who can reach the service can set landing credentials for any channel id |
| **`subscribed_apps` failure is warn-only** | Tech Provider approval may block subscription during early onboarding | Channel row + vault secret created but **no webhooks** until manual subscription or retry |
| **Phone number lookup is exact string match** | `findChannelByPhoneNumber` compares `metadata.display_phone_number` to DB `phone_number` with no normalization in webhook | Format mismatch (spaces, `+`) between Meta webhook and stored value silently drops messages |
| **`zoneId` used as `insuranceCompanyCode` in storage paths** | Tracked separately; not renamed in this pass | Path segment may not match insurer code semantics downstream |
| **List channels has no auth** | `GET /whatsapp-channels?orgId=` is open | Org channel metadata (phone, WABA id) leak to unauthenticated callers |
| **Audio/video/location/etc. not ingested** | Scope limited to text + document + image for claims use case | Those message types are silently skipped |
| **GCP/AZURE landing writers** | Stub providers in config switch | Setting `landing_storage_provider` to GCP/AZURE returns config stub without full write path |
| **Kafka ingestion trace topic** | storage-core publishes to ingestion topic on write; not validated for WhatsApp path | Downstream OCR/MDM may not see events if topic misconfigured |
| **Disconnect retains vault secret** | Soft-delete (`INACTIVE`) by design for audit | Credentials remain in vault after "disconnect" |

---

## Placeholder Values That Need Real Data

| Location | Current value | Must become |
|----------|---------------|-------------|
| `.env.example` line 24 | `APP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef` | Unique 32-byte hex key per deployment (required to decrypt `vault_token_encrypted` on channel rows) |
| `.env.example` line 26 | `WHATSAPP_VERIFY_TOKEN=sentinel_webhook_verify_2026` | Secret verify token matching Meta Developer Console webhook config |
| `.env.example` line 28 | `META_APP_ID=948840568153510` | Your Meta app id (may be correct for current app — confirm in Meta dashboard) |
| `.env.example` lines 12–18 | `STORAGE_PROVIDER=MINIO`, `MINIO_*`, `MINIO_BUCKET=sentinel-landing-bucket` | For S3 landing: `STORAGE_PROVIDER=S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET` — or configure per-channel via PATCH |
| `scripts/test-landing-storage-config.ts` line 35 | Hardcoded org `TPA_TEST_001` for default channel lookup | Acceptable for dev script; production ops should pass explicit `[channelId]` |
| DB `whatsapp_channels` row **id=1** | `waba_id=dummy-waba-id`, `phone_number_id=dummy-phone-number-id` | Real Meta IDs if this row is used beyond ingestion testing (phone `15556721145` is the real test number) |
| DB row **id=1** | `org_id=TPA_TEST_001`, `zone_id=ZONE_01` | Real TPA org and insurer/zone codes for production |
| DB row **id=2** | `phone_number=916293911235`, `kms_service_id=dummy-kms-service-id`, dummy WABA/phone ids | Placeholder second row — delete or replace before production |
| DB row **id=1** | `landing_bucket=ngenclaims-landing-bucket-test` | Production bucket name (e.g. `ngenclaims-landing-bucket`) when leaving test |

---

## Proposed Next Steps

### As soon as a real client WABA is available

1. Run Embedded Signup from ngenclaim-mock with real `VITE_*` env vars and real vault token/service id — confirm `201` connect response.
2. Confirm `subscribed_apps` succeeded (no warn in server logs) and send a test text — webhook → Kafka → harvester → S3 without manual Graph API calls.
3. Send document + image attachments; verify media file and transcript in landing bucket with expected key layout.
4. Confirm duplicate webhook delivery is suppressed (Redis dedup) and `message-id` metadata on S3 object matches full wamid.
5. Register production webhook URL (HTTPS, not ngrok) in Meta app settings.

### Can be done anytime, no WABA needed

1. Add auth to `PATCH /whatsapp-channel/:id/landing-storage` (vault token or internal service token).
2. Add auth to `GET /whatsapp-channels` (at minimum org-scoped vault token validation).
3. Normalize phone number on webhook lookup (strip spaces/`+` before DB query) and on connect (store canonical form).
4. Make `subscribed_apps` failure surface as a connect warning in API response (or hard-fail when subscription is required).
5. Wire ngenclaim-mock vault provisioning (`POST /api/v1/auth/provision`) instead of `VITE_VAULT_TOKEN` — follow `poc-v0.1/tpa-react-admin-poc/src/App.jsx` pattern.
6. Replace hardcoded `orgId` / `serviceId` / `zoneId` in frontend with session/org context.
7. Add integration test or Vitest coverage for `buildStorageWriterConfigForChannel` fail-closed behavior (mock vault).
8. Update OpenAPI description on POST webhook route (currently mentions "document messages" only — code handles text/image too).

---

## Key Files Reference

| File | Responsibility |
|------|----------------|
| `src/app.ts` | Fastify bootstrap, raw body parser for HMAC, `/api/v1` route prefix |
| `src/server.ts` | Starts HTTP server, Redis/Kafka/DB checks, launches media harvester |
| `src/config/index.ts` | Env config, `buildStorageWriterConfigFromEnv()`, `buildStorageWriterConfigForChannel()` |
| `src/modules/pipelines/whatsapp-to-ftp/webhook/webhook.routes.ts` | Registers GET/POST `/whatsapp/webhook` |
| `src/modules/pipelines/whatsapp-to-ftp/webhook/webhook.service.ts` | Verification, signature check, dedup, Kafka publish, message typing |
| `src/modules/pipelines/whatsapp-to-ftp/webhook/signature.ts` | `X-Hub-Signature-256` HMAC verification |
| `src/modules/pipelines/whatsapp-to-ftp/workers/media-harvester.ts` | Kafka consumer, Meta media download, S3/MinIO writes, path naming |
| `src/modules/pipelines/whatsapp-to-ftp/workers/transcript-gen.ts` | PDF transcript generation (pdfkit) |
| `src/modules/pipelines/whatsapp-to-ftp/provisioning/provisioning.service.ts` | Embedded Signup connect, list, disconnect, landing storage PATCH |
| `src/modules/pipelines/whatsapp-to-ftp/provisioning/provisioning.routes.ts` | Provisioning route registration |
| `src/repositories/whatsappChannel.repository.ts` | DB access for channel rows |
| `src/models/whatsapp-channel.model.ts` | Sequelize model incl. landing metadata columns |
| `migrations/20260827000001-add-whatsapp-channel-landing-storage.cjs` | Landing storage column migration |
| `scripts/test-landing-storage-config.ts` | Manual verify per-channel storage config builder |
| `poc-v0.1/storage-core/src/writer.ts` | `writeToLanding`, object key layout, redacted logging |
| `poc-v0.1/storage-core/src/utils/redactStorageConfig.ts` | Credential redaction helper |
