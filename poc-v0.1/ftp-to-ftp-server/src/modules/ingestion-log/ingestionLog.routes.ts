import { FastifyInstance } from "fastify";
import { IngestionLogController } from "./ingestionLog.controller";
import {
  ingestionLogQuerySchema,
  ingestionLogResponseSchema,
  ingestionLogSummaryQuerySchema,
  ingestionLogSummaryResponseSchema,
} from "./ingestionLog.schemas";
import {
  IngestionLogListQuery,
  IngestionLogService,
  IngestionLogSummaryQuery,
} from "./ingestionLog.service";

export const registerIngestionLogRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new IngestionLogController(new IngestionLogService());

  app.get<{ Querystring: IngestionLogListQuery }>(
    "/api/ingestion-log",
    {
      schema: {
        tags: ["Ingestion log"],
        summary: "List ingestion logs",
        querystring: ingestionLogQuerySchema,
        response: { 200: ingestionLogResponseSchema },
      },
    },
    controller.list,
  );

  app.get<{ Querystring: IngestionLogSummaryQuery }>(
    "/api/ingestion-log/summary",
    {
      schema: {
        tags: ["Ingestion log"],
        summary: "Summarize ingestion logs",
        querystring: ingestionLogSummaryQuerySchema,
        response: { 200: ingestionLogSummaryResponseSchema },
      },
    },
    controller.summary,
  );
};
