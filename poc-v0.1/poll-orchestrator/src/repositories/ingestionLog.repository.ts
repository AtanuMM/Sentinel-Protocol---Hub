import { sequelize } from '../db'
import { initIngestionLogModel, type IngestionLogStatus } from '../models/ingestionLog.model'

interface CreateIngestionLogData {
  org_id: string
  insurance_company_code: string
  channel_type: string
  source_path: string
  landing_path: string
  file_name: string
  file_size_bytes: number
  status: IngestionLogStatus
  error_message?: string
  ingested_at: Date
}

const IngestionLogModel = initIngestionLogModel(sequelize)

export class IngestionLogRepository {
  async createLog(data: CreateIngestionLogData): Promise<void> {
    await IngestionLogModel.create(data)
  }
}
