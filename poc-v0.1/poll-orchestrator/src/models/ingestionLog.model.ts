import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export type IngestionLogStatus = 'SUCCESS' | 'FAILED'

export class IngestionLog extends Model<
  InferAttributes<IngestionLog>,
  InferCreationAttributes<IngestionLog>
> {
  declare id: CreationOptional<number>
  declare org_id: string
  declare insurance_company_code: string
  declare channel_type: string
  declare source_path: string
  declare landing_path: string
  declare file_name: string
  declare file_size_bytes: number
  declare status: IngestionLogStatus
  declare error_message: CreationOptional<string | null>
  declare ingested_at: Date
  declare readonly createdAt: CreationOptional<Date>
  declare readonly updatedAt: CreationOptional<Date>
}

export const initIngestionLogModel = (sequelize: Sequelize): typeof IngestionLog => {
  IngestionLog.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      org_id: { type: DataTypes.STRING, allowNull: false },
      insurance_company_code: { type: DataTypes.STRING, allowNull: false },
      channel_type: { type: DataTypes.STRING, allowNull: false },
      source_path: { type: DataTypes.TEXT, allowNull: false },
      landing_path: { type: DataTypes.TEXT, allowNull: false },
      file_name: { type: DataTypes.STRING, allowNull: false },
      file_size_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM('SUCCESS', 'FAILED'), allowNull: false },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      ingested_at: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, tableName: 'Ingestion_Log' }
  )

  return IngestionLog
}
