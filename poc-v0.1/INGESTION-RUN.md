# Running the two ingestion microservices (avoid wrong-port 404s)

Both apps expose **`GET /api/ping`**. Only **email-to-ftp-server** exposes **`/api/email-to-ftp/*`**. If you POST an email URL to the FTP process, Fastify returns:

`{"message":"Route POST:/api/email-to-ftp/... not found",...}`

## Recommended: two terminals, two ports

**Terminal A — FTP only (webhook, link-bucket, …)**

```bash
cd poc-v0.1/ftp-to-ftp-server
export PORT=3000   # or rely on .env
npm run dev
```

Check:

```bash
curl -s http://localhost:3000/api/ping | jq .
# expect: "service": "ftp-to-ftp-server"
```

**Terminal B — Email only**

```bash
cd poc-v0.1/email-to-ftp-server
export PORT=3001   # must differ from FTP when both run locally
npm run dev
```

Check:

```bash
curl -s http://localhost:3001/api/ping | jq .
# expect: "service": "email-to-ftp-server"
```

Point **TPA admin** `VITE_INGESTION_FTP_URL` at `http://localhost:3000` and **`VITE_INGESTION_EMAIL_URL`** at `http://localhost:3001`.

## Quick mistake check

| `curl …/api/ping` shows `service` | Safe to call |
|-----------------------------------|----------------|
| `email-to-ftp-server` | `/api/email-to-ftp/...` on **that** host:port |
| `ftp-to-ftp-server` | `/api/webhook`, `/api/link-bucket`, … — **not** email paths |

## Compiled run

After `npm run build`, use `npm start` in each folder; ensure each `.env` has the intended **`PORT`**.
