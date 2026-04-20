Changelog-Style Migration Report (poc-v0.1/fastify-server)
----------------------------------------------------------

### Added

*   **TypeScript runtime and build pipeline**
    
    *   tsx dev server, tsc build/typecheck, vitest tests, TypeScript ESLint stack.
        
    *   Scripts in poc-v0.1/fastify-server/package.json: dev, build, start, db:migrate, typecheck, lint, test.
        
*   **Project configs**
    
    *   poc-v0.1/fastify-server/tsconfig.json
        
    *   poc-v0.1/fastify-server/eslint.config.js
        
    *   poc-v0.1/fastify-server/vitest.config.ts
        
*   **App bootstrap split**
    
    *   poc-v0.1/fastify-server/src/app.ts (plugin/route registration)
        
    *   poc-v0.1/fastify-server/src/server.ts (startup, dependency checks, shutdown)
        
*   **MVC-style module structure**
    
    *   src/modules/health/\*
        
    *   src/modules/integration/\*
        
    *   src/modules/provisioning/\*
        
    *   src/modules/feed/\*
        
    *   src/modules/ingestion/\*
        
*   **Infrastructure + persistence layers**
    
    *   src/infra/clients.ts (MinIO, Redis, Kafka producer)
        
    *   src/infra/db.ts (Sequelize)
        
    *   src/models/ingestionChannel.model.ts
        
    *   src/repositories/ingestionChannel.repository.ts
        
*   **Cross-cutting concerns**
    
    *   src/errors/appError.ts
        
    *   src/plugins/error-handler.ts
        
    *   src/middleware/webhookAuth.ts
        
    *   src/utils/crypto.ts (AES-GCM + HMAC)
        
    *   src/types/webhook.ts
        
*   **Database migration framework**
    
    *   .sequelizerc
        
    *   config/sequelize.cjs
        
    *   migrations/202604130001-create-ingestion-channel-master.cjs
        
    *   migrations/202604140001-add-encrypted-password-column.cjs
        
*   **Tests**
    
    *   tests/health.test.ts
        
    *   tests/crypto.test.ts
        
    *   tests/webhookAuth.test.ts
        

### Changed

*   **Entrypoint behavior**
    
    *   poc-v0.1/fastify-server/index.js changed from full server logic to legacy shim requiring dist/server.js.
        
*   **Route registration model**
    
    *   Moved from inline declarations to modular route registrars in src/modules/\*/\*.routes.ts.
        
*   **API surface enhancements**
    
    *   Added health endpoints:
        
        *   GET /api/health/live
            
        *   GET /api/health/ready
            
    *   Added explicit onboarding endpoint:
        
        *   POST /api/onboard-org
            
*   **Security posture**
    
    *   Credential persistence now targets encrypted storage (external\_password\_encrypted).
        
    *   Webhook route has optional HMAC signature verification via header.
        
*   **Operational lifecycle**
    
    *   Startup now validates dependencies before listening.
        
    *   Graceful shutdown closes Kafka, Redis, DB, Fastify.
        
*   **Feed query behavior**
    
    *   live-feed query now selects explicit non-sensitive columns only.
        

### Fixed

*   **/api/live-feed 500 (schema drift)**
    
    *   Cause: model queried external\_password\_encrypted but DB schema lacked it.
        
    *   Fix:
        
        *   migration to add/backfill encrypted column
            
        *   explicit feed projection to avoid credential column reads.
            
*   **/api/init-today 500 (Invalid encrypted payload format)**
    
    *   Cause: legacy rows had non-encrypted values in encrypted field.
        
    *   Fix:
        
        *   provisioning compatibility path detects legacy format, uses value for current run, and auto-upgrades row to encrypted format via repository update.
            

### Breaking / Behavioral Notes

*   **Runtime expectations changed**
    
    *   Backend now expects TypeScript build/run flow (tsx/tsc) rather than single-file JS editing.
        
*   **Schema management changed**
    
    *   Migrations are the source of truth; runtime sequelize.sync({ alter: true }) pattern is removed.
        
*   **Credential column contract changed**
    
    *   Code expects external\_password\_encrypted; legacy plaintext path is only compatibility logic, not target state.
        

### Risks / Known Gaps

*   **Encryption key management**
    
    *   Current key source is environment-based; production hardening should include secure secret lifecycle/rotation policy.
        
*   **Webhook auth enforcement depends on config**
    
    *   If WEBHOOK\_SECRET is unset, signature verification bypasses by design.
        
*   **Data migration hygiene**
    
    *   Legacy-compatible logic exists; a one-time full DB cleanup task is still recommended to normalize all rows.
        

### Compatibility Notes

*   Existing frontend flow remains supported.
    
*   Frontend action mapping updated to use explicit onboarding route in tpa-react-admin-poc/src/App.jsx.
    
*   Legacy index.js retained as shim for compatibility with older invocation habits.
    

### Recommended Next Steps

1.  Add integration tests for link-bucket, init-today, and webhook end-to-end with mocked infra.
    
2.  Add startup schema assertions to fail fast on migration drift.
    
3.  Add stronger config validation (NODE\_ENV-specific required vars, min lengths).
    
4.  Implement encryption-key rotation strategy and re-encryption tooling.
    
5.  Add CI pipeline gates for typecheck, lint, test, and migration checks.