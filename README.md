Project Sentinel: Data Ingress Hub README
=========================================

1\. Overview & Vision
---------------------

The **Data Ingress Hub**, codenamed **Project Sentinel**, is a high-concurrency **"Shock Absorber"** engineered for the Indian insurance market. It is specifically designed to handle the **"12:09 PM Peak"**—the sudden burst-load of midday claim synchronizations—by managing up to **2 million concurrent connections** across multiple channels.

The core architectural thesis is **Decoupled Hybrid Concurrency**: separating high-speed data receipt (I/O Management) from heavy business logic (Processing).

2\. The "Stateless Ingress" Strategy
------------------------------------

To maintain massive concurrency, the Hub's front-end operates as a **high-speed router**.

*   **The Rule:** No file resides on the application server’s local disk.
    
*   **Zero-Buffer Streaming:** Adapters use Node.js **Streams** to pipe binary data directly from the network socket to the **S3 Landing Zone**. The server never buffers the full payload in RAM, keeping the memory footprint minimal during spikes.
    
*   **Claim-Check Pattern:** The Hub saves the raw file to S3 and then drops a lightweight **JSON metadata pointer** into Kafka for downstream workers to pick up when ready.
    

3\. The "Sentinel Protocol" (Standardized Pull Model)
-----------------------------------------------------

To eliminate the technical overhead of scanning unstructured environments, the Hub mandates a **Uniform Partitioning Pattern** in source buckets.

*   **Folder Schema:** /{Organisation\_ID}/{Zone\_ID}/{YYYY-MM-DD}/.
    
*   **The Benefit:** This structure allows the **"Sentinel Harvester"** to perform **Prefix-Based Scans**, which are significantly faster than full bucket crawls.
    

4\. Omnichannel Adapter Layer
-----------------------------

Each ingestion channel has a dedicated, auto-scaling microservice to normalize disparate inputs:

*   **API Adapter:** Handles REST/gRPC; performs **Tenant Throttling** and returns 202 Accepted in <200ms.
    
*   **WhatsApp Adapter:** Integrated with Meta Webhooks to manage media download links.
    
*   **SFTP Gateway:** A managed service for legacy TPAs that is backed directly by S3.
    
*   **Email Adapter:** Automatically strips attachments and can proxy legacy SMTP data through the secure SFTP-to-S3 pipeline.
    

5\. Technology Stack
--------------------

ComponentCloud (AWS Mumbai)Local / POC AlternativePurpose**Ingress FrameworkNode.js (Fastify)Node.js (Fastify)**Non-blocking, event-driven I/O.**LanguageTypeScriptTypeScript**Type-safe claim data structures.**Compute EngineAmazon EKSK3s / MicroK8s**Orchestrates auto-scaling pods.**Message BrokerAmazon MSK (Kafka)Redpanda / Kafka**The "Shock Absorber" buffer.**Object StorageAmazon S3MinIO**The secure "Landing Zone."**Audit DatabaseAurora PostgreSQLPostgreSQL**Stores ingestion trace heartbeats.**Identity / AuthKeycloakKeycloak**OIDC-based B2B authentication.

6\. Operational Guardrails
--------------------------

*   **Durability:** Kafka replication (Factor 3) ensures no claim is lost even if a data center node fails.
    
*   **Idempotency:** The **Deduplication Worker** uses a **Redis cache** to check file hashes in **<1ms**, ignoring duplicate uploads.
    
*   **Observability:** Every claim is assigned a **Trace\_ID** for real-time distributed tracing from "Front Door" to "Master Audit Log".
    
*   **Tenant Firewall:** The **Ingestion\_Channel\_Master** table maps source bucket paths to unique Organisation\_IDs to ensure strict data isolation.
    

7\. Security & Compliance
-------------------------

*   **Data Residency:** All infrastructure is pinned to **AWS Mumbai (ap-south-1)** to comply with the **DPDP Act 2023**.
    
*   **Double Lock Encryption:** Data is encrypted via **TLS 1.3** in transit and **AES-256** at rest using **AWS KMS**.
    
*   **WORM Compliance:** The S3 Landing Zone utilizes **Object Lock** to prevent any modification or deletion of claims for **7 years**, as per IRDAI requirements.
    
*   **Handshake Security:** Mutual TLS (mTLS) and JWT with **RS256 signatures** are used for all B2B API integrations.
    

8\. Development Implementation (Local POC)
------------------------------------------

1.  **Initialize Cluster:** Deploy **MicroK8s** with NGINX Ingress \[Conversation history\].
    
2.  **Storage Setup:** Deploy **MinIO** with source and landing buckets \[Conversation history\].
    
3.  **Webhook Trigger:** Configure **MinIO Webhooks** on the source bucket to trigger a POST request to the **Sentinel Harvester** whenever a file is finalized in the mandated folder pattern.
    
4.  **Database:** Populate the **PostgreSQL** Ingestion\_Channel\_Master with TPA identifiers for path-to-tenant mapping.