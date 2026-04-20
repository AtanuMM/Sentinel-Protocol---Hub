Sentinel Harvester: Ingestion Pipeline Documentation (v0.2)
===========================================================

1\. System Overview
-------------------

The Sentinel Harvester is a high-speed, event-driven ingestion service built on **Fastify (Node.js/TypeScript)** using an **MVC Architecture**. It is designed to act as a "Gatekeeper" for incoming TPA (Third Party Administrator) claims, ensuring that only unique files enter the downstream processing pipeline.

### Core Stack

*   **Storage:** MinIO (S3-compatible) with Webhook Event Notifications.
    
*   **Cache:** Redis (Key-value store) for Idempotency/Deduplication.
    
*   **Message Broker:** Apache Kafka (Event stream) for downstream signaling.
    
*   **Visibility:** Redis Insight (Port 8001) & Kafka UI (Port 8080).
    

2\. Infrastructure Architecture
-------------------------------

The system operates within a shared Docker network (sentinel-network), allowing services to communicate via internal hostnames.

**ServiceInternal HostExternal PortRoleMinIO**minio9001 (UI)Source & Landing buckets for raw PDFs.**Redis**redis6380Deduplication storage (Idempotency).**Kafka**kafka9092Distributes "Trace Signals" to downstream pods.**DB**db5432Stores TPA configuration and master trace metadata.

3\. The Idempotency Strategy (The Gatekeeper)
---------------------------------------------

To prevent duplicate processing of the same file (even if renamed), the system uses a **Deduplication Logic** based on the file’s **ETag** (content hash).

### How it works:

1.  **Event Arrival:** MinIO sends a POST request to /ingest when a .pdf is uploaded to NI-001/.
    
2.  file:dedup:{orgId}:{bucket}:{filename}
    
3.  **The NX Check:** We perform a SET key value NX EX 86400 in Redis.
    
    *   **NX:** Only set the key if it _does not_ exist.
        
    *   **EX 86400:** Set a 24-hour expiration (TTL).
        
4.  **Result:** \* If Redis returns OK: Proceed with processing.
    
    *   If Redis returns null: Silently drop the request.
        

4\. Operation Flow & Verification
---------------------------------

### Step 1: File Ingestion (MinIO)

Files arrive in the tpa-source-bucket. A webhook is configured to fire only for the NI-001/ prefix and .pdf suffix.

### Step 2: Verification (Redis Insight)

Open http://localhost:8001. You will see the deduplication keys in a tree structure.

*   **Key:** Contains the path to the file.
    
*   **Value:** The ETag (unique hash).
    
*   **TTL:** Indicates when the system will "forget" this file and allow it to be processed again (standard: 24h).
    

### Step 3: Signaling (Kafka UI)

Open http://localhost:8080.

*   Navigate to **Topics** -> claims-ingestion-trace.
    
*   Check **Messages**. Each unique file results in one JSON message containing the traceId and the landingPath.
    
*   **Downstream Impact:** Other services (OCR, Validation) listen to this topic to start their work.
    

5\. Developer "Cheat Sheet" for Handoff
---------------------------------------

### Common Commands

*   **Restart Infrastructure:** docker compose up -d
    
*   2\. Delete the key folder file:dedup.3. Re-upload the file to MinIO to trigger a new ingestion.
    
*   **Debug Logs:** docker logs -f sentinel-harvester
    

### Troubleshooting "Connection Refused"

*   If **Redis Insight** shows a blank screen, ensure the Docker mapping is 8001:5540.
    
*   If **Kafka UI** shows "Offline," check that the CLUSTER\_ID in docker-compose.yml matches the broker.
    

6\. Business Logic Rules
------------------------

1.  **Silent Failures:** If a duplicate file is uploaded, the system returns a 200 OK but performs no action. This is to ensure the TPA experience is not interrupted while protecting our resources.
    
2.  **File Movement:** Files are streamed directly from tpa-source-bucket to sentinel-landing-bucket. They are never stored permanently on the Harvester's local disk.
    
3.  **Traceability:** Every unique file must have a corresponding entry in the PostgreSQL traces table and a message in the Kafka claims-ingestion-trace topic.