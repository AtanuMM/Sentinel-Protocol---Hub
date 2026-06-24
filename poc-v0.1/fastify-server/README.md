# Legacy all-in-one ingestion server (deprecated for new deployments)

This package still registers **both** the FTP-to-FTP and Email-to-FTP pipelines in a single process for backward compatibility.

**Prefer the split microservices for new work and production topology:**

| Service | Path | Default port |
|---------|------|----------------|
| FTP-to-FTP | [`../ftp-to-ftp-server`](../ftp-to-ftp-server) | 3000 |
| Email-to-FTP | [`../email-to-ftp-server`](../email-to-ftp-server) | 3001 |

Fixes to shared layers (`src/config`, `src/infra`, `src/utils`, …) may need to be applied in **both** microservices and here if you continue using the monolith during transition.

**TPA admin:** for split deployment set `VITE_INGESTION_EMAIL_URL` (see `email-to-ftp-server` README); monolith needs no extra Vite env.

## Run

```bash
npm install
npm run dev
```

Same environment variables as before; see `src/config/index.ts`.
