import { DataTypes, Model, Sequelize } from "sequelize";

/**
 * Junction table for SHARED configuration_strategy channels.
 * organisation_id + insurance_company_code logically reference
 * Ingestion_Channel_Master (composite PK) — no hard FK for POC flexibility.
 */
export class IngestionChannelInsurerMap extends Model {
  declare id: string;
  declare organisation_id: string;
  declare insurance_company_code: string;
  declare readonly createdAt: Date;
}

export const initIngestionChannelInsurerMapModel = (
  sequelize: Sequelize,
): typeof IngestionChannelInsurerMap => {
  IngestionChannelInsurerMap.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      organisation_id: { type: DataTypes.STRING, allowNull: false },
      insurance_company_code: { type: DataTypes.STRING, allowNull: false },
    },
    {
      sequelize,
      tableName: "Ingestion_Channel_Insurer_Map",
      timestamps: true,
      updatedAt: false,
    },
  );

  return IngestionChannelInsurerMap;
};
