import { PipelineSource } from "../utils/dedupKey";

export interface IngestionTraceEvent {
  schemaVersion: 1;
  traceId: string;
  orgId: string;
  zoneId: string;
  landingPath: string;
  originalPath: string;
  timestamp: string;
  metadata: { source: PipelineSource };
}
