import { DataTypes, Model, Sequelize } from 'sequelize'

/**
 * Mirrors email-to-ftp-server/src/models/email-source.model.ts (same table, columns, underscored).
 *
 * Unlike channel.model.ts (read-only), this model needs WRITE access: the orchestrator advances
 * `last_processed_uid` after each poll. The cursor write is performed via the static
 * `EmailSource.update(...)` call in workers/pool.ts (no instance helper) so the update is a single
 * targeted statement scoped by `email_address`.
 */
export class EmailSource extends Model {
  declare organisation_id: string
  declare email_address: string
  declare vault_service_id: string
  declare zone_id: string
  declare last_processed_uid: number
  declare imap_uidvalidity: string | null
  declare is_active: boolean
  declare vault_token_encrypted: string | null
  declare readonly updatedAt: Date
  declare readonly createdAt: Date

  static async findActiveForPolling(): Promise<EmailSource[]> {
    return EmailSource.findAll({ where: { is_active: true } })
  }
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
        defaultValue: 'eu-central-1',
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
      tableName: 'Email_Source_Master',
      timestamps: true,
      underscored: true,
    },
  )

  return EmailSource
}
