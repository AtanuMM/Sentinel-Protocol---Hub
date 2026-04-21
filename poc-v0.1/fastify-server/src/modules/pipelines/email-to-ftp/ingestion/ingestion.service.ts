// Coming soon: Email-to-FTP ingestion service.
//
// When implemented, this service must follow the shared contract used by every
// ingestion pipeline:
//
//   - Redis dedup key: buildDedupKey("email", orgId, bucket, filename, etag)
//       from "../../../../utils/dedupKey" using NX + 24h TTL.
//   - Kafka payload : IngestionTraceEvent with metadata.source = "email"
//       from "../../../../types/ingestionEvent", produced to
//       config.ingestionTopic (claims-ingestion-trace) via the shared producer
//       in "../../../../infra/clients".
export class IngestionService {}
