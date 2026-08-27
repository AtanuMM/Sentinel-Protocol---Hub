# WhatsApp Integration — Frontend Status

> ⚠️ **TO CONTINUE THIS WORK:** Open this Claude conversation — it has the full context of everything built, tested, and decided so far:
>
> 🔗 **https://claude.ai/share/332b3235-f75a-4702-b8f4-77c71de35447**
>
> Paste that link into a new Claude chat and continue from there instead of starting from scratch.

## What This Covers

`ngenclaim-mock` is the NGenClaim Automation Engine UI (React 19 + Vite + Tailwind v4). The **Add Channels** page hosts the WhatsApp Embedded Signup experience: it loads Meta's JS SDK, opens the native Facebook login popup, captures the authorization code, and POSTs it to `whatsapp-to-ftp-server` to register the channel. Backend webhook ingestion, media harvest, and storage are documented in [`../poc-v0.1/whatsapp-to-ftp-server/WHATSAPP_INTEGRATION_STATUS.md`](../poc-v0.1/whatsapp-to-ftp-server/WHATSAPP_INTEGRATION_STATUS.md).

---

## Completed & Verified

### Replaced "Feature coming soon" WhatsApp modal stub

- **What:** The WhatsApp card on Add Channels previously opened a static stub (same pattern as `tpa-react-admin-poc` line ~1007). It now opens a full multi-state modal (`idle` → `connecting` → `finalizing` → `success` / `error`).
- **Files:** `src/pages/AddChannels.jsx` (WhatsApp modal section only; FTP, Email, and Vault modals untouched).
- **Evidence:** Grep confirms no `"Feature coming soon"` string remains in `ngenclaim-mock`. Modal renders intro copy, action buttons, and state-specific body/footer.

### Facebook JS SDK dynamic loader

- **What:** Injects `https://connect.facebook.net/en_US/sdk.js` on demand, sets `window.fbAsyncInit`, initializes `FB.init` with app id and SDK version `v21.0`. Singleton promise prevents double injection.
- **Files:** `src/utils/facebookSdk.js`.
- **Evidence:** SDK loads when user clicks "Connect with Facebook"; no SDK script in `index.html` (intentionally dynamic).

### Embedded Signup trigger (`FB.login`)

- **What:** Calls `FB.login` with `config_id` from env, `response_type: 'code'`, `override_default_response_type: true`, and Embedded Signup `extras` (`sessionInfoVersion: '3'`). Resolves `authResponse.code` or treats cancellation as error state.
- **Files:** `src/pages/AddChannels.jsx` (`handleConnectWhatsApp`, lines ~126–223).
- **Evidence:** **Meta consent/onboarding popup opens correctly** when env vars are set and domain requirements are met (confirmed in browser testing). User sees the real Meta WhatsApp Business signup UI, not a placeholder.

### Modal UX states

- **What:** Distinct UI for `idle`, `connecting` (spinner + "Complete signup in the Facebook popup"), `finalizing` (POST in flight), `success` (phone, WABA id, org id), and `error` (message + retry).
- **Files:** `src/pages/AddChannels.jsx`, `src/components/ui/NgModal.jsx` (shared modal shell).
- **Evidence:** Code review; popup-open state verified manually. Success state not yet seen with real connect response (see unverified section).

### JSDoc types for connect API contract

- **What:** Documents request/response shapes for the backend connect endpoint.
- **Files:** `src/types/whatsappChannel.js`.
- **Evidence:** Types referenced in `AddChannels.jsx` via `@typedef` imports in JSDoc.

### `.env.example` for WhatsApp integration

- **What:** Documents required `VITE_META_APP_ID`, `VITE_META_LOGIN_CONFIG_ID`, `VITE_WHATSAPP_INGESTION_URL`, and temporary `VITE_VAULT_TOKEN`.
- **Files:** `.env.example`.
- **Evidence:** File present; mirrors variables read in `handleConnectWhatsApp`.

---

## Completed But NOT Yet Verified End-to-End

### Authorization code → backend POST → success state

- **Built:** After popup returns a code, frontend POSTs to `{VITE_WHATSAPP_INGESTION_URL}/api/v1/whatsapp-to-ftp/whatsapp-channel` with JSON body `{ orgId, serviceId, zoneId, authorizationCode }` and header `x-vault-token`.
- **Why not proven:** Popup and Meta consent screen work, but **no test completed the full flow** — user has not finished Embedded Signup through to backend `201` and frontend `success` state with real `phoneNumber` / `wabaId`.
- **Proof needed:** Complete signup in popup, observe `finalizing` → green success banner with real phone and WABA id, confirm row in backend `whatsapp_channels`.

### Vault token validity against real KMS service

- **Built:** Sends `import.meta.env.VITE_VAULT_TOKEN` as `x-vault-token`.
- **Why not proven:** Token is a dev placeholder in `.env`; connect POST not verified with a vault token tied to a real `serviceId` that owns the WABA secrets.
- **Proof needed:** Provision vault via key-vault, use returned `sv_live_...` token, complete connect without `502 VAULT_STORE_FAILED`.

### Local dev without ngrok + HTTPS

- **Built:** Comments in `AddChannels.jsx` note Meta domain allowlisting requirements.
- **Why not proven on plain `localhost`:** Meta JS SDK for Embedded Signup requires **HTTPS** and **domain allowlisting**; `localhost:5173` cannot be allowlisted with a port in Meta's "Allowed Domains for the JS SDK" in the way ngrok HTTPS URLs can.
- **Workaround verified in codebase (not necessarily re-tested today):** `vite.config.js` enables `@vitejs/plugin-basic-ssl` (`server.https: true`) and `allowedHosts: ['.ngrok-free.app']` so the app can be served over HTTPS behind an ngrok tunnel whose host is allowlisted in Meta app settings.
- **Proof needed:** Run `ngrok http 5173`, allowlist `*.ngrok-free.app` (or exact host) in Meta → Facebook Login for Business → Settings, open app via ngrok HTTPS URL, complete connect.

---

## Known Gaps / Explicitly Deferred

| Gap | Reason deferred | Risk |
|-----|-----------------|------|
| **`VITE_VAULT_TOKEN` hardcoded in env** | Fastest path to test backend connect; `.env.example` explicitly marks as TEMPORARY | Token leakage via frontend bundle/env; no per-user vault isolation |
| **Vault provisioning modal is still a stub** | `onVaultSubmit` only `console.log`s — not wired to `POST /api/v1/auth/provision` | Users cannot generate vault keys from this UI (unlike `tpa-react-admin-poc`) |
| **Hardcoded `orgId`, `serviceId`, `zoneId` in POST body** | Placeholders until org/session model exists | Every connect attempt uses wrong tenant context |
| **No WhatsApp channel list in UI** | Backend `GET /whatsapp-channels` exists; frontend not wired | Users cannot see connected numbers after signup |
| **No CORS/proxy config for backend** | Direct `fetch` to `VITE_WHATSAPP_INGESTION_URL`; relies on backend `cors: origin: "*"` | Production will need explicit origin allowlist |
| **Vault modal on same page unrelated to WhatsApp** | Scope constraint during WhatsApp work | "Generate Vault Key" button still non-functional for WhatsApp path |

---

## Placeholder Values That Need Real Data

| Location | Current value | Must become |
|----------|---------------|-------------|
| `src/pages/AddChannels.jsx` line 18–20 | `ORG_LABEL = 'ORG: NI-001'` → `ORG_ID = 'NI-001'` | Logged-in user's organisation id from auth/session |
| `src/pages/AddChannels.jsx` line 22 | `WHATSAPP_KMS_SERVICE_ID = '00000000-0000-0000-0000-000000000000'` | Real key-vault service UUID from provisioning (create service + store secrets under it) |
| `src/pages/AddChannels.jsx` line 24 | `WHATSAPP_ZONE_ID = 'eu-central-1'` | Real deployment zone / insurer company code used in landing path (`zoneId` in backend — maps to `insuranceCompanyCode` in storage-core) |
| `.env.example` / local `.env` | `VITE_META_APP_ID=` (empty in example) | Meta app id from Developer Console |
| `.env.example` / local `.env` | `VITE_META_LOGIN_CONFIG_ID=` (empty) | Facebook Login for Business configuration id for Embedded Signup |
| `.env.example` line 3 | `VITE_WHATSAPP_INGESTION_URL=http://localhost:3002` | Production/staging URL of `whatsapp-to-ftp-server` (HTTPS in prod) |
| `.env.example` lines 4–5 | `VITE_VAULT_TOKEN=` with comment "TEMPORARY" | Token from `POST http://localhost:8000/api/v1/auth/provision` (see `tpa-react-admin-poc/src/App.jsx` `submitVaultProvision`) stored in app state/localStorage — **not** baked into Vite env |
| `vite.config.js` lines 12–14 | `allowedHosts: ['.ngrok-free.app']` | Update when using a stable staging domain (e.g. `claims-staging.example.com`) |

### POST body sent today (all placeholders)

When connect runs, the payload is:

```json
{
  "orgId": "NI-001",
  "serviceId": "00000000-0000-0000-0000-000000000000",
  "zoneId": "eu-central-1",
  "authorizationCode": "<from FB.login popup>"
}
```

Source: `src/pages/AddChannels.jsx` lines 182–187. All three identifiers must become dynamic before any production client onboarding.

---

## Proposed Next Steps

### As soon as a real client WABA is available

1. Set real `VITE_META_APP_ID`, `VITE_META_LOGIN_CONFIG_ID`, vault token, and backend URL in `.env`.
2. Serve app over HTTPS via ngrok (or staging host) with domain allowlisted in Meta app settings.
3. Click **Add WhatsApp Source** → **Connect with Facebook** → complete Embedded Signup in popup.
4. Confirm frontend reaches **success** state with real phone/WABA; verify backend `whatsapp_channels` row and vault secret.
5. Send a WhatsApp message to the connected number; confirm ingestion on backend (see backend status doc).

### Can be done anytime, no WABA needed

1. Wire **Generate Vault Key** modal to `POST /api/v1/auth/provision` following `poc-v0.1/tpa-react-admin-poc/src/App.jsx` (`submitVaultProvision`, lines ~121–148) — store `apiKey` in `localStorage` and use it instead of `VITE_VAULT_TOKEN`.
2. Replace `WHATSAPP_KMS_SERVICE_ID` placeholder with service id returned from vault provisioning (or a dedicated "create KMS service" step).
3. Derive `ORG_ID` and `WHATSAPP_ZONE_ID` from login session / org settings instead of constants.
4. Add error handling for backend `409 WHATSAPP_CHANNEL_ALREADY_EXISTS` and Meta-specific error messages in the modal.
5. Optional: list connected WhatsApp channels via `GET /api/v1/whatsapp-to-ftp/whatsapp-channels?orgId=` on the Add Channels page.
6. Document local dev runbook in project README: ngrok + Vite HTTPS + Meta allowlist steps (keep `.env` out of git).

---

## Key Files Reference

| File | Responsibility |
|------|----------------|
| `src/pages/AddChannels.jsx` | WhatsApp modal, `handleConnectWhatsApp`, placeholder org/service/zone constants, env reads |
| `src/utils/facebookSdk.js` | Meta JS SDK injection and `FB.init` |
| `src/types/whatsappChannel.js` | JSDoc types for connect request/response |
| `src/components/ui/NgModal.jsx` | Shared modal layout (title, footer, close) |
| `src/components/ui/NgChannelCard.jsx` | "Add WhatsApp" channel card entry point |
| `vite.config.js` | HTTPS dev server (`basicSsl`), ngrok `allowedHosts` |
| `.env.example` | Required `VITE_*` variables and vault token warning |
| `poc-v0.1/tpa-react-admin-poc/src/App.jsx` | Reference implementation for vault provisioning (`submitVaultProvision`) |
