import { DataTypes, Model, Op, Sequelize } from 'sequelize'

export class IngestionChannel extends Model {
  declare organisation_id: string
  declare kms_service_id: string | null
  declare vault_token_encrypted: string | null
  declare is_onboarded: boolean
  declare source_bucket: string
  declare region: string

  static async findActiveForPolling(): Promise<IngestionChannel[]> {
    return IngestionChannel.findAll({
      where: {
        is_onboarded: true,
        kms_service_id: { [Op.ne]: null },
        vault_token_encrypted: { [Op.ne]: null },
      },
    })
  }
}

export const initIngestionChannelModel = (sequelize: Sequelize): typeof IngestionChannel => {
  IngestionChannel.init(
    {
      organisation_id: { type: DataTypes.STRING, primaryKey: true },
      kms_service_id: { type: DataTypes.STRING, allowNull: true },
      vault_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
      is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false },
      source_bucket: { type: DataTypes.STRING, allowNull: false },
      region: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, tableName: 'Ingestion_Channel_Master', timestamps: false }
  )

  return IngestionChannel
}
