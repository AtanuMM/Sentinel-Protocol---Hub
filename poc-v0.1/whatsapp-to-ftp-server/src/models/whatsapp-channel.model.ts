import { DataTypes, Model, Sequelize } from "sequelize";

export class WhatsappChannel extends Model {
  declare id: number;
  declare org_id: string;
  declare zone_id: string;
  declare phone_number: string;
  declare kms_service_id: string;
  declare vault_token_encrypted: string;
  declare waba_id: string;
  declare phone_number_id: string;
  declare status: string;
  declare readonly updatedAt: Date;
  declare readonly createdAt: Date;
}

export const initWhatsappChannelModel = (sequelize: Sequelize): typeof WhatsappChannel => {
  WhatsappChannel.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      org_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      zone_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      kms_service_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      vault_token_encrypted: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      waba_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone_number_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      sequelize,
      tableName: "whatsapp_channels",
      timestamps: true,
      underscored: true,
    },
  );

  return WhatsappChannel;
};
