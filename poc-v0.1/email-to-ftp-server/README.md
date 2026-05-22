# Email-to-FTP ingestion microservice

Standalone Fastify app for the **Email-to-FTP** pipeline only (email source provisioning, IMAP claim polling). Same Controller → Service → Repository layout as the legacy monolith.

## Run locally

```bash
npm install
cp .env.example .env   # edit values; set `PORT=3001` when running beside FTP on 3000
npm run dev
```

Listen port comes from **`PORT` in `.env`** (see [`.env.example`](.env.example), default **3001** if unset or empty).

**Before calling email APIs:** `curl -s http://localhost:<PORT>/api/ping` must include **`"service":"email-to-ftp-server"`**. If it says **`ftp-to-ftp-server`**, that port is the **FTP** microservice — email routes will return `Route POST:... not found`. Run **`npm run dev`** from **`poc-v0.1/email-to-ftp-server`** (or set `PORT` so each service uses its own port).

## Environment

Same as the original ingestion backend: `DB_URL`, `REDIS_URL`, Kafka, MinIO, `VAULT_URL`, `APP_ENCRYPTION_KEY`, `EMAIL_*` knobs, etc. See [`src/config/index.ts`](src/config/index.ts).

Protected routes use header **`x-vault-token`** (key-vault).

## Database migrations

Identical Sequelize migrations live in `migrations/`. Run **`npm run db:migrate`** from this folder **or** from [`ftp-to-ftp-server`](../ftp-to-ftp-server)—keep migration files in sync if you edit them.

## API

- Base path: **`/api/email-to-ftp`** (unchanged from monolith)
- Swagger UI: `/documentation` (non-production by default)

**GET vs POST:** Opening `poll-claims` or `preview` in the browser sends **GET** — you now get **200** with JSON explaining how to call **POST**. The real work still happens on **POST** with `x-vault-token` and JSON body.

Health checks are **GET**: `/api/ping`, `/api/health/live`, `/api/health/ready`.

## TPA admin (`tpa-react-admin-poc`)

When this service runs on port **3001**, set **`VITE_INGESTION_EMAIL_URL=http://localhost:3001`** for the admin UI. If unset, email API calls default to `VITE_INGESTION_FTP_URL` or `http://localhost:3000` (single monolith).

## Still seeing 404?

1. **Confirm which app owns the port** (wrong app = wrong routes):

   ```bash
   curl -s http://localhost:3002/api/_sentinel
   ```

   - If you see `"service":"ftp-to-ftp-server"` → you started **ftp-to-ftp-server** on that port. Email URLs will **404**. Start **email-to-ftp-server** (or change `PORT` in each service’s `.env` so FTP and email use different ports).

2. **Confirm the process is up**:

   ```bash
   curl -s http://localhost:3002/api/ping
   ```

   Expect JSON with `"status":"online"` (or similar).

3. **`poll-claims` / `preview` must be POST**, with `Content-Type: application/json` and `x-vault-token`. Example:

   ```bash
   curl -s -w "\nHTTP %{http_code}\n" -X POST "http://localhost:3002/api/email-to-ftp/email-source/poll-claims" \
     -H "Content-Type: application/json" \
     -H "x-vault-token: YOUR_TOKEN" \
     -d '{"email":"you@example.com","serviceId":"YOUR_SERVICE_ID"}'
   ```

4. If you run **`node dist/server.js`**, run **`npm run build`** first so `dist/` matches `src/`.

5. Trailing slashes: the server runs with **`ignoreTrailingSlash: true`** so `/api/ping` and `/api/ping/` both work.
