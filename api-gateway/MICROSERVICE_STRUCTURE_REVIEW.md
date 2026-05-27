# Microservice Structure Review

This document reviews the current structure of `omni-keyclock-service`, highlights the main gaps, and lists what should be added next to make it production-ready and easier to maintain.

## 1. Current Structure Summary

The service is a Node.js + TypeScript Express microservice with:

- `src/app.ts` for middleware registration
- `src/server.ts` and `src/loadEnv.ts` for bootstrapping
- `src/routes/` for HTTP routing
- `src/models/` for Sequelize database access
- `src/middlewares/` for request middleware
- `src/utils/` and `src/helper/` for shared logic
- `src/validation/` for Joi validation
- `src/views/templates/` for email or HTML templates
- `src/swagger.ts` for API docs

The project already includes folders for a stronger layered design:

- `src/controllers/`
- `src/services/`
- `src/schemas/`
- `src/migrations/`

But those folders are currently empty, so the architecture is only partially implemented.

## 2. What Is Good Already

- TypeScript is enabled and the project builds successfully.
- The service has a clean boot flow: `loadEnv.ts` -> `server.ts` -> `app.ts`.
- Swagger, validation, rate limiting, and request logging are already introduced.
- Multitenant database selection using `x-db-name` has started.
- The folder naming mostly follows common backend service conventions.

## 3. Main Structural Issues Found

### High priority issues

1. Business layers are missing

- `controllers/`, `services/`, `schemas/`, and `migrations/` exist but are unused.
- Right now the service does not yet show a complete controller-service-repository style flow.
- As the service grows, logic will likely become crowded inside routes, helpers, and utils.

2. Repository hygiene is weak

- `node_modules/`, `dist/`, `coverage/`, `logs/`, and `tsconfig.tsbuildinfo` are present in the service directory.
- `.env.development` and `.env.production` are also present in the repository.
- Build output and runtime artifacts should not normally live in source control.

3. Testing is not implemented

- `npm test` fails because no test files exist.
- The service has Jest configured, but there are currently zero tests.

4. Environment and documentation mismatch

- `README.md` says Node.js `22.x or higher`.
- `package.json` requires Node.js `>=24.14.1`.
- `README.md` also has a duplicated `Installation` section.
- `build:uat` expects `.env.uat`, but that file is not present in the service root.

5. Security and deployment concerns

- Environment files are copied into `dist/` during build.
- Docker build also copies `.env.production` into the image.
- This increases the chance of leaking secrets and makes config management harder.

### Medium priority issues

1. Naming consistency problems

- The service name uses `managment` instead of `management`.
- File naming is inconsistent in places, for example `src/utils/email_sender.ts.ts`.
- There is also mixed JavaScript/TypeScript usage, such as `src/config/config.js` inside a mostly TypeScript project.

2. Swagger setup is incomplete

- Swagger references `./src/schemas/components.yaml`, but the `schemas/` folder is empty.
- This means the documentation structure is not finished.

3. Error handling flow needs cleanup

- In `src/routes/index.routes.ts`, the `404` handler is placed before `500`, `502`, `503`, and `504` handlers.
- After the `404` middleware responds, the later handlers are effectively unreachable in normal routing flow.

4. Data layer needs stronger organization

- `src/models/` currently contains only limited model setup.
- There is no repository layer, migration structure, or clear model initialization pattern for future growth.

## 4. What You Need To Add

To make this microservice structure complete, these are the main missing pieces:

### 1. Controllers

Add controllers for each route group.

Purpose:
- Keep route files thin
- Move request/response handling out of router definitions
- Standardize response patterns

Example:
- `src/controllers/health.controller.ts`
- `src/controllers/user.controller.ts`
- `src/controllers/auth.controller.ts`

### 2. Services

Add service files for business logic.

Purpose:
- Keep business rules separate from HTTP details
- Make logic reusable and testable
- Reduce coupling between routes and database code

Example:
- `src/services/user.service.ts`
- `src/services/auth.service.ts`
- `src/services/email.service.ts`

### 3. Repositories or Data Access Layer

Add a repository layer if this service will grow beyond a few queries.

Purpose:
- Centralize Sequelize queries
- Keep services cleaner
- Make multitenant DB access safer and easier to audit

Example:
- `src/repositories/user.repository.ts`
- `src/repositories/base.repository.ts`

### 4. Database Migrations

Add real migration files under `src/migrations/`.

Purpose:
- Track schema changes safely
- Avoid manual production DB edits
- Support repeatable deploys

Example:
- `src/migrations/20260401-create-imi-users.ts`
- `src/migrations/20260401-add-user-program-id.ts`

### 5. Request/Response Schemas

Use the `schemas/` folder for Swagger/OpenAPI components or DTO definitions.

Purpose:
- Keep API docs structured
- Reuse payload definitions across endpoints
- Align validation and documentation

Example:
- `src/schemas/user.schema.yaml`
- `src/schemas/auth.schema.yaml`
- `src/schemas/components.yaml`

### 6. Tests

Add at least these test layers:

- Unit tests for services and helpers
- Integration tests for routes
- Validation tests for Joi schemas

Suggested folders:
- `src/__tests__/unit/`
- `src/__tests__/integration/`

### 7. Config Module

Create a proper typed config layer.

Purpose:
- Read environment variables once
- Validate required env vars on startup
- Avoid repeated `dotenv.config()` calls across files

Example:
- `src/config/env.ts`
- `src/config/app.config.ts`
- `src/config/database.config.ts`

### 8. Shared Error System

Add structured error classes and one global error middleware.

Purpose:
- Remove repeated response logic
- Standardize API error format
- Make debugging easier

Example:
- `src/errors/AppError.ts`
- `src/middlewares/errorHandler.ts`

## 5. Recommended Target Structure

```text
src/
  app.ts
  server.ts
  loadEnv.ts
  config/
    env.ts
    app.config.ts
    database.config.ts
    multer.config.ts
  routes/
    index.routes.ts
    health.routes.ts
    auth.routes.ts
    user.routes.ts
  controllers/
    health.controller.ts
    auth.controller.ts
    user.controller.ts
  services/
    auth.service.ts
    user.service.ts
    email.service.ts
  repositories/
    user.repository.ts
  middlewares/
    db_connection_create.ts
    validationMiddleware.ts
    errorHandler.ts
    notFoundHandler.ts
  models/
    Connection.ts
    imi_user.ts
    index.ts
  migrations/
  validation/
    user.validation.ts
    auth.validation.ts
  schemas/
    components.yaml
    user.schema.yaml
    auth.schema.yaml
  utils/
    responseHandler.ts
    accessLogger.ts
    getConnection.ts
  helper/
    template_renderer.ts
    email_send.ts
  views/
    templates/
```

## 6. Immediate Fixes I Recommend First

If you want to improve this service step by step, do these first:

1. Add `.gitignore` coverage for:
- `node_modules/`
- `dist/`
- `coverage/`
- `logs/`
- `.env*`
- `tsconfig.tsbuildinfo`

2. Replace committed env files with:
- `.env.example`
- secret values stored outside git

3. Create at least:
- one controller
- one service
- one route module beyond `index.routes.ts`

4. Add a real global error middleware and a dedicated `notFound` handler.

5. Add at least:
- one unit test
- one integration test

6. Clean naming issues:
- rename `email_sender.ts.ts`
- standardize `management` vs `managment`
- convert `config.js` to TypeScript if it is still needed

7. Fix docs and script alignment:
- update README Node version
- remove duplicate sections
- document all startup modes correctly
- either add `.env.uat` or remove the related script

## 7. Short Architecture Guidance

For a microservice, a simple and maintainable request flow should look like this:

`Route -> Controller -> Service -> Repository/Model -> Response`

Suggested responsibility split:

- Route: endpoint path and middleware only
- Controller: request parsing and HTTP response
- Service: business rules
- Repository/Model: database operations
- Middleware: cross-cutting concerns like auth, db selection, validation, errors

That structure will make this service easier to scale when you add user management, auth, admin functions, tenant-specific features, and audit logging.

## 8. Final Assessment

The project is a reasonable starting point, but right now it is closer to an early scaffold than a fully structured microservice. The biggest gaps are not in Express setup, but in architecture completion, test coverage, repository hygiene, and configuration safety.

If you address the missing service layers, clean the repo artifacts, and formalize config and migrations, this can become a solid production-ready microservice base.
