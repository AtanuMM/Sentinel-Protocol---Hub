import { DataTypes, Model, Sequelize } from "sequelize";

export class IngestionChannel extends Model {
  declare organisation_id: string;
  declare source_prefix: string;
  declare source_bucket: string;
  declare external_username: string;
  declare external_password_encrypted: string;
  declare region: string;
  declare is_onboarded: boolean;
  declare readonly updatedAt: Date;
}

export const initIngestionChannelModel = (sequelize: Sequelize): typeof IngestionChannel => {
  IngestionChannel.init(
    {
      organisation_id: { type: DataTypes.STRING, primaryKey: true },
      source_prefix: { type: DataTypes.STRING, allowNull: false },
      source_bucket: { type: DataTypes.STRING, allowNull: false },
      external_username: { type: DataTypes.STRING, allowNull: false },
      external_password_encrypted: { type: DataTypes.TEXT, allowNull: false },
      region: { type: DataTypes.STRING, allowNull: false },
      is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { sequelize, tableName: "Ingestion_Channel_Master" }
  );

  return IngestionChannel;
};
