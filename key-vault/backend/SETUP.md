This guide provides a step-by-step technical setup for developers to initialize the **Sentinel Vault** locally or in a staging environment.

1\. Prerequisites
-----------------

Ensure the following are installed on your machine:

*   **Node.js:** v24.x (Latest LTS)
    
*   **Database:** PostgreSQL 15+
    
*   **Package Manager:** npm (comes with Node)
    

2\. Initial Installation
------------------------

Clone your repository and install the core engine dependencies.

Bash

`# Install project dependencies  npm install  # Core libraries included:  # - fastify: Web framework  # - prisma: ORM & Migration engine  # - @prisma/client: Type-safe DB client  # - @fastify/cors: Cross-origin resource sharing   `

3\. Environment Configuration
-----------------------------

Create a .env file in the root directory. This file contains the "keys to the kingdom."

Code snippet
`# 1. Server Settings  PORT=8000  NODE_ENV="development"  # 2. Database Connection  # Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentinel_key_vault"  # 3. Security (CRITICAL)  # Must be exactly 64 hex characters (32 bytes)  # Generate one via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  MASTER_ROOT_KEY="your_64_char_hex_key_here"  # 4. Production SSL (Optional for Local)  # SSL_KEY_PATH="/path/to/server.key"  # SSL_CERT_PATH="/path/to/server.crt"   `

4\. Database Initialization & Migrations
----------------------------------------

Since we are starting fresh with the new keycloakId architecture, follow these commands to sync your PostgreSQL instance.

Bash
`# 1. Clear any old migration history and reset the DB (Warning: Deletes all data)  npx prisma migrate reset --force  # 2. Initialize the schema and create the tables  npx prisma migrate dev --name init_vault_v1  # 3. Generate the Type-Safe Prisma Client  npx prisma generate   `

5\. Development Server
----------------------

The system uses tsx to run TypeScript files directly with high performance.

Bash
`# Start the server in watch mode (auto-restarts on save)  npx tsx watch src/server.ts   `

The server should now be live at http://localhost:8000. You can verify by hitting GET /health.

6\. Directory Structure Overview
--------------------------------

A quick map for developers to find their way around the codebase:

**PathResponsibility**prisma/schema.prismaThe source of truth for the Database Schema.src/server.tsEntry point, Fastify initialization, and route registration.src/services/CryptoService.ts**The Core:** AES-256-GCM Envelope Encryption logic.src/services/SecretService.tsHigh-level DB operations (Store/Fetch/Decrypt All).src/middleware/auth.tsThe API Key Guard (X-Vault-Token validation).src/routes/API Endpoints (Auth, Services, and Secrets).

7\. Troubleshooting
-------------------

### Linting Errors (apiKeyHash not found)

If your IDE shows red squiggles on apiKeyHash after a migration:

1.  Run npx prisma generate again.
    
2.  Restart your IDE's TypeScript server (Cmd+Shift+P -> "Restart TS Server").
    

### Master Key Error

If the server crashes with a MASTER\_ROOT\_KEY error:

*   Ensure the key in .env is exactly 64 characters long.
    
*   Ensure there are no hidden spaces or quotes around the hex string.
    

### Database Connection Refused

*   Verify your PostgreSQL service is running (pg\_isready).
    
*   Ensure the DATABASE\_URL matches your local Postgres credentials.
    

8\. Common Commands Reference
-----------------------------

*   **Open DB GUI:** npx prisma studio (View your data in the browser)
    
*   **Format Schema:** npx prisma format (Cleans up your .prisma file)
    
*   **Check Types:** npx tsc --noEmit (Full project type check)