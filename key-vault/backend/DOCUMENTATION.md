This technical documentation provides a complete overview of the **Sentinel Vault API**. The system uses **Envelope Encryption (AES-256-GCM)** to secure secrets, linked to a multi-tenant architecture integrated with **Keycloak**.

1\. System Architecture Overview
--------------------------------

The Vault is designed as a secure middleware service. It decouples user identity (Keycloak) from internal data ownership using a dual-ID system.

*   **Primary Key (id):** Internal UUID for database performance and foreign key stability.
    
*   **External Key (keycloakId):** The sub claim from Keycloak, used for cross-system mapping.
    
*   **Encryption Engine:** Uses a Master Root Key to wrap unique Data Encryption Keys (DEK) for every individual secret stored.
    

2\. Authentication & Authorization
----------------------------------

### The Master API Key

Access to all protected routes requires an X-Vault-Token header.

*   **Format:** sv\_live\_...
    
*   **Storage:** The vault stores only the **SHA-256 hash** of this key.
    
*   **Scope:** A User's Master Key grants access to all Services (Projects/Channels) owned by that internal User.id.
    

3\. API Reference
-----------------

### A. Authentication & Onboarding

Used by the SaaS backend to provision new users coming from Keycloak.

| `POST` | `/api/v1/auth/provision` | Creates/Updates a user and returns a Master API Key. |

**Request Body:**

JSON

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   {    "keycloakId": "string",    "email": "string"  }   `

**Response:** 200 OK returns { "apiKey": "sv\_live\_...", "internalId": "uuid" }

### B. Service Management (Projects/Channels)

Services act as logical containers (e.g., "Production", "FTP-Channel") for secrets.

**MethodEndpointDescription**POST/api/v1/servicesCreates a new service container.GET/api/v1/servicesLists all services owned by the authenticated user.

**Headers:** x-vault-token:

### C. Secret Management

The core functionality for storing and retrieving encrypted data.

**MethodEndpointDescription**POST/api/v1/secretsEncrypts and stores/updates a secret.GET/api/v1/secrets/:serviceId**Bulk Fetch:** Decrypts and returns all secrets for a service.GET/api/v1/secrets/:serviceId/:key**Single Fetch:** Decrypts and returns one specific secret.

**Request Body (POST):**

JSON

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   {    "serviceId": "uuid",    "keyName": "STRIPE_KEY",    "value": "sk_test_..." // Can be string or JSON object  }   `

4\. Security Implementation Details
-----------------------------------

### Data at Rest

Each secret record in the Secret table contains:

1.  **encryptedBlob**: The actual secret encrypted with a unique DEK.
    
2.  **wrappedDek**: The DEK itself, encrypted with the MASTER\_ROOT\_KEY.
    
3.  **iv / authTag**: Nonces and integrity checks for the payload.
    
4.  **dekIv / dekTag**: Nonces and integrity checks for the wrapped key.
    

### Security Logic (The "Guard")

Every request undergoes a two-step validation:

1.  **Identity:** Does the X-Vault-Token hash match a known User?
    
2.  **Ownership:** Does the requested serviceId belong to the identified User.id?
    

5\. Deployment Checklist
------------------------

*   **Environment Variables:** Ensure MASTER\_ROOT\_KEY is a 64-character hex string stored in a secure environment (never in Git).
    
*   **Database:** PostgreSQL with Prisma migrations applied.
    
*   **SSL:** In production, the server is configured to require SSL certificates for HTTPS termination.
    
*   **CORS:** Configured via ALLOWED\_ORIGIN env var to restrict dashboard access.
    

6\. Error Codes
---------------

**CodeMeaningResolution**401UnauthorizedAPI Key is missing, invalid, or expired.403ForbiddenAuthenticated user is trying to access a serviceId they do not own.404Not FoundThe specific secret key or service does not exist.500Server ErrorCheck MASTER\_ROOT\_KEY length or database connectivity.

**This documentation serves as the source of truth for integrating your Frontend Dashboard and Backend Services with the Sentinel Vault.**