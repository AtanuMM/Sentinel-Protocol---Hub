import { DataTypes, Model, Sequelize } from "sequelize";

export class EmailSource extends Model {
  declare organisation_id: string; // Linking to the TPA
  declare email_address: string;    // The monitored inbox
  declare vault_secret_id: string;  // The ID for the standalone Vault
  declare imap_host: string;
  declare imap_port: number;
  declare is_active: boolean;
  declare readonly updatedAt: Date;
  declare readonly createdAt: Date;
}

export const initEmailSourceModel = (sequelize: Sequelize): typeof EmailSource => {
  EmailSource.init(
    {
      // Primary Key usually needs to be unique per inbox
      email_address: { 
        type: DataTypes.STRING, 
        primaryKey: true 
      },
      organisation_id: { 
        type: DataTypes.STRING, 
        allowNull: false 
      },
      vault_secret_id: { 
        type: DataTypes.STRING, 
        allowNull: false 
      },
      imap_host: { 
        type: DataTypes.STRING, 
        allowNull: false 
      },
      imap_port: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 993
      },
      is_active: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
      },
    },
    { 
      sequelize, 
      tableName: "Email_Source_Master",
      timestamps: true,
      underscored: true // This ensures Sequelize looks for created_at/updated_at
    }
  );

  return EmailSource;
};