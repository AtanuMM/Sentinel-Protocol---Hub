Sentinel Protocol: Phase 1 Documentation & Roadmap
==================================================

1\. Executive Summary: The Phase 1 Pivot
----------------------------------------

Originally, the POC began on **MicroK8s** to simulate a production-grade orchestration environment. However, due to hardware resource constraints (ThinkPad L480) and the overhead of managing Persistent Volume Claims (PVCs) and Helm timeouts, we pivoted to **Docker Compose**.

**The Result:** A lightweight, high-speed development environment that maintains 100% architectural parity with the final Cloud Kubernetes target.

2\. Infrastructure Comparison (The Roadmap)
-------------------------------------------

**ComponentCurrent (Docker POC)Intermediate (MicroK8s)Production (AWS EKS)Orchestration**Docker ComposeMicroK8s (Single Node)Amazon EKS (Multi-AZ)**Ingress**Port Mapping (Direct)NGINX Ingress ControllerAWS Network Load Balancer (NLB)**Storage (S3)**MinIO ContainerMinIO (Helm Chart)Amazon S3 + Object Lock**Event Stream**Kafka (KRaft Mode)Kafka (KRaft/Helm)Amazon MSK (Serverless)**Database**Postgres 15 ImagePostgres (Operator-based)Amazon Aurora (PostgreSQL)**Secrets**.env / Docker SecretsK8s SecretsAWS Secrets Manager / KMS

3\. The "Sentinel" Ingress Plan (Phases 1-5)
--------------------------------------------

### **Phase 1: Foundation (COMPLETED)**

*   **Infrastructure:** Deployed MinIO (S3), Kafka (KRaft), Redis (Cache), and Postgres (Registry).
    
*   **Visuals:** Integrated Kafka-UI and MinIO Console for real-time monitoring.
    
*   **Identity:** Defined Ingestion\_Channel\_Master for path-to-tenant mapping.
    

### **Phase 2: The Handshake & Zero-Buffer Stream (NEXT)**

*   **Logic:** Implement the Node.js Harvester.
    
*   **Mechanism:** MinIO Webhook $\\rightarrow$ Harvester $\\rightarrow$ Stream to Landing Zone.
    
*   **Performance:** Achieve 0% disk usage on the app tier via Node Streams.
    

### **Phase 3: Persistence & The "Double Lock"**

*   **Security:** AES-256 encryption during the stream.
    
*   **Compliance:** Enable WORM (Write Once Read Many) on landing buckets for 7-year retention.
    

### **Phase 4: The Shock Absorber**

*   **Queuing:** Produce metadata pointers to Kafka topics with high partition counts to handle "12:09 PM" spikes.
    

### **Phase 5: Perimeter & Identity Firewall**

*   **Security:** Enforce Row-Level Security (RLS) in Postgres and JWT validation for TPA identity.
    

4\. Documentation Log (PHASE\_1\_LOG.md)
----------------------------------------
# Phase 1 Log: Infrastructure Foundation
**Date:** 2026-03-13
**Status:** COMPLETE

## Actions Taken
1. **Environment Pivot:** Moved from MicroK8s to Docker Compose to reduce RAM overhead (797MB vs 3GB+).
2. **Kafka Modernization:** Implemented Kafka in **KRaft mode**, removing the need for Zookeeper and aligning with Kafka 4.0 standards.
3. **Conflict Resolution:** Re-mapped Redis to port `6380` to avoid local host service conflicts.
4. **S3 Simulation:** Provisioned MinIO with separate buckets for `source-sim` and `landing-zone`.

## Technical Specs
- **Network:** `poc-v01` internal bridge.
- **Database:** PostgreSQL 15 (sentinel_mdm).
- **Cache:** Redis Alpine (Deduplication store).
- **UI Access:** - Kafka-UI: http://localhost:8080
  - MinIO: http://localhost:9001

## Transition Notes for K8s
To move back to Kubernetes (MicroK8s/EKS), the following changes are required:
- Convert `docker-compose.yml` to Kubernetes Manifests (Deployments/Services).
- Replace Docker volumes with `PersistentVolumeClaims`.
- Implement `Ingress` resources for UI access.