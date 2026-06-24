Changelog: Pipeline Structure Segregation (FTP-to-FTP)
------------------------------------------------------

### Scope

Structural refactor only. No API contract, business logic, schema, infra behavior, or runtime flow changes.

### Added

*   poc-v0.1/fastify-server/src/modules/pipelines/ftp-to-ftp/index.ts
    
    *   New pipeline barrel: registerFtpToFtpPipeline.
        
*   poc-v0.1/fastify-server/src/modules/pipelines/ftp-to-ftp/README.md
    
    *   Documents pipeline boundary, owned endpoints, shared vs local code, and Phase-2 placement pattern.
        
*   poc-v0.1/fastify-server/src/modules/pipelines/ftp-to-ftp/types/
    
    *   New local type namespace for pipeline-specific event payloads.
        

### Moved

*   src/modules/integration/\* -> src/modules/pipelines/ftp-to-ftp/integration/\*
    
*   src/modules/provisioning/\* -> src/modules/pipelines/ftp-to-ftp/provisioning/\*
    
*   src/modules/feed/\* -> src/modules/pipelines/ftp-to-ftp/feed/\*
    
*   src/modules/ingestion/\* -> src/modules/pipelines/ftp-to-ftp/ingestion/\*
    
*   src/types/webhook.ts -> src/modules/pipelines/ftp-to-ftp/types/webhook.ts
    

### Changed

*   poc-v0.1/fastify-server/src/app.ts
    
    *   Replaced four direct module registrations with one pipeline registration:
        
        *   Kept: registerHealthRoutes
            
        *   Added: registerFtpToFtpPipeline
            
*   Updated relative imports in moved files to match new depth:
    
    *   Shared imports moved from ../../... to ../../../../...
        
    *   Webhook type import updated to local pipeline path (../types/webhook where applicable)
        

### Unchanged (Explicit)

*   Endpoint paths and methods:
    
    *   /api/link-bucket
        
    *   /api/onboard-org
        
    *   /api/init-today
        
    *   /api/live-feed
        
    *   /api/webhook
        
*   Request/response schemas and controller/service behavior.
    
*   Shared layers: config, infra, repositories, models, middleware, utils, plugins, errors, server.ts.
    
*   Migrations, DB schema, Kafka topics, MinIO configuration, frontend behavior.
    

### Validation

*   npm run typecheck passed
    
*   npm run lint passed
    
*   npm test passed