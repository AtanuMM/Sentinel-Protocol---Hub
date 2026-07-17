import { DataTypes, Model, Sequelize } from "sequelize";

export type ConfigurationStrategy = "DEDICATED" | "SHARED";

export class IngestionChannel extends Model {
  declare organisation_id: string;
  declare insurance_company_code: string;
  declare channel_type: string;
  declare configuration_strategy: ConfigurationStrategy;
  declare is_onboarded: boolean;
  declare kms_service_id: string | null;
  declare vault_token_encrypted: string | null;
  declare source_prefix: string | null;
  declare source_bucket: string | null;
  declare external_username: string | null;
  declare external_password_encrypted: string | null;
  declare region: string | null;
  declare email_address: string | null;
  declare last_processed_uid: number | null;
  declare imap_uidvalidity: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initIngestionChannelModel = (sequelize: Sequelize): typeof IngestionChannel => {
  IngestionChannel.init(
    {
      organisation_id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      insurance_company_code: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      channel_type: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      configuration_strategy: {
        type: DataTypes.ENUM("DEDICATED", "SHARED"),
        allowNull: false,
        defaultValue: "DEDICATED",
      },
      is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false },
      kms_service_id: { type: DataTypes.STRING, allowNull: true },
      vault_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
      source_prefix: { type: DataTypes.STRING, allowNull: true },
      source_bucket: { type: DataTypes.STRING, allowNull: true },
      external_username: { type: DataTypes.STRING, allowNull: true },
      external_password_encrypted: { type: DataTypes.TEXT, allowNull: true },
      region: { type: DataTypes.STRING, allowNull: true },
      email_address: { type: DataTypes.STRING, allowNull: true },
      last_processed_uid: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      imap_uidvalidity: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: "Ingestion_Channel_Master" }
  );

  return IngestionChannel;
};
