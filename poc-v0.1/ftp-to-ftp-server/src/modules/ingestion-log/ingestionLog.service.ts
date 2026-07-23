import { QueryTypes } from "sequelize";
import { AppError } from "../../errors/appError";
import { sequelize } from "../../infra/db";

export type IngestionLogStatus = "SUCCESS" | "FAILED";

export interface IngestionLogListQuery {
  orgId: string;
  insuranceCompanyCode?: string;
  status?: IngestionLogStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface IngestionLogSummaryQuery {
  orgId: string;
  from?: string;
  to?: string;
}

interface IngestionLogRow {
  id: string;
  org_id: string;
  insurance_company_code: string;
  channel_type: string;
  source_path: string;
  landing_path: string;
  file_name: string;
  file_size_bytes: string;
  status: IngestionLogStatus;
  error_message: string | null;
  ingested_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface DateRange {
  orgId: string;
  from?: string;
  to?: string;
}

interface QueryParts {
  clauses: string[];
  replacements: Record<string, string | number>;
}

function validateDateRange(query: DateRange): void {
  const fromTime = query.from ? Date.parse(query.from) : undefined;
  const toTime = query.to ? Date.parse(query.to) : undefined;

  if (fromTime !== undefined && Number.isNaN(fromTime)) {
    throw new AppError(400, "from must be a valid ISO date", "INVALID_DATE_RANGE");
  }
  if (toTime !== undefined && Number.isNaN(toTime)) {
    throw new AppError(400, "to must be a valid ISO date", "INVALID_DATE_RANGE");
  }
  if (fromTime !== undefined && toTime !== undefined && fromTime > toTime) {
    throw new AppError(400, "from must be earlier than or equal to to", "INVALID_DATE_RANGE");
  }
}

function buildDateRangeQuery(query: DateRange): QueryParts {
  const clauses = ['org_id = :orgId'];
  const replacements: Record<string, string | number> = { orgId: query.orgId };

  if (query.from) {
    clauses.push("ingested_at >= :from");
    replacements.from = query.from;
  }
  if (query.to) {
    clauses.push("ingested_at <= :to");
    replacements.to = query.to;
  }

  return { clauses, replacements };
}

class IngestionLogRepository {
  async findAndCount(query: IngestionLogListQuery): Promise<{
    rows: IngestionLogRow[];
    total: number;
  }> {
    const { clauses, replacements } = buildDateRangeQuery(query);

    if (query.insuranceCompanyCode) {
      clauses.push("insurance_company_code = :insuranceCompanyCode");
      replacements.insuranceCompanyCode = query.insuranceCompanyCode;
    }
    if (query.status) {
      clauses.push("status = :status");
      replacements.status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    replacements.limit = limit;
    replacements.offset = (page - 1) * limit;
    const whereClause = clauses.join(" AND ");

    const [rows, countRows] = await Promise.all([
      sequelize.query<IngestionLogRow>(
        `SELECT * FROM "Ingestion_Log"
         WHERE ${whereClause}
         ORDER BY ingested_at DESC, id DESC
         LIMIT :limit OFFSET :offset`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM "Ingestion_Log"
         WHERE ${whereClause}`,
        { replacements, type: QueryTypes.SELECT },
      ),
    ]);

    return { rows, total: countRows[0]?.total ?? 0 };
  }

  async summarize(query: IngestionLogSummaryQuery): Promise<{
    totalFiles: number;
    totalSuccess: number;
    totalFailed: number;
    byChannel: Array<{ channel_type: string; count: number }>;
  }> {
    const { clauses, replacements } = buildDateRangeQuery(query);
    const whereClause = clauses.join(" AND ");

    const [totals, byChannel] = await Promise.all([
      sequelize.query<{
        totalFiles: number;
        totalSuccess: number;
        totalFailed: number;
      }>(
        `SELECT
           COUNT(*)::int AS "totalFiles",
           COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS "totalSuccess",
           COUNT(*) FILTER (WHERE status = 'FAILED')::int AS "totalFailed"
         FROM "Ingestion_Log"
         WHERE ${whereClause}`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<{ channel_type: string; count: number }>(
        `SELECT channel_type, COUNT(*)::int AS count
         FROM "Ingestion_Log"
         WHERE ${whereClause}
         GROUP BY channel_type
         ORDER BY channel_type`,
        { replacements, type: QueryTypes.SELECT },
      ),
    ]);

    return {
      totalFiles: totals[0]?.totalFiles ?? 0,
      totalSuccess: totals[0]?.totalSuccess ?? 0,
      totalFailed: totals[0]?.totalFailed ?? 0,
      byChannel,
    };
  }
}

export class IngestionLogService {
  constructor(private readonly repository = new IngestionLogRepository()) {}

  async list(query: IngestionLogListQuery) {
    validateDateRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.repository.findAndCount({ ...query, page, limit });

    return {
      success: true,
      total: result.total,
      page,
      limit,
      data: result.rows,
    };
  }

  async summary(query: IngestionLogSummaryQuery) {
    validateDateRange(query);
    const result = await this.repository.summarize(query);
    return {
      success: true,
      orgId: query.orgId,
      ...result,
    };
  }
}
