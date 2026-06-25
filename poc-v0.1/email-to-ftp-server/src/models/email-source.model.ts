import { DataTypes, Model, Sequelize } from "sequelize";

export class EmailSource extends Model {
  declare organisation_id: string;
  declare email_address: string;
  declare vault_service_id: string;
  declare zone_id: string;
  declare last_processed_uid: number;
  declare imap_uidvalidity: string | null;
  declare is_active: boolean;
  declare vault_token_encrypted: string | null;
  declare readonly updatedAt: Date;
  declare readonly createdAt: Date;
}

export const initEmailSourceModel = (sequelize: Sequelize): typeof EmailSource => {
  EmailSource.init(
    {
      email_address: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      organisation_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      vault_service_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      zone_id: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "eu-central-1",
      },
      last_processed_uid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      imap_uidvalidity: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      vault_token_encrypted: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "Email_Source_Master",
      timestamps: true,
      underscored: true,
    },
  );

  return EmailSource;
};
