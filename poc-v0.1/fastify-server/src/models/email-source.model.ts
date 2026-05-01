import { DataTypes, Model, Sequelize } from "sequelize";

export class EmailSource extends Model {
  declare organisation_id: string;
  declare email_address: string;
  declare vault_service_id: string;
  declare is_active: boolean;
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
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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
