import { DataTypes, Model, Sequelize } from "sequelize";

export class EmailClaimArtifact extends Model {
  declare id: string;
  declare organisation_id: string;
  declare zone_id: string;
  declare email_address: string;
  declare imap_uid: number;
  declare imap_mailbox: string;
  declare imap_uidvalidity: string | null;
  declare rfc_message_id: string | null;
  declare email_body_text: string;
  declare matched_keywords: string[];
  declare trace_id: string;
  declare landing_path: string;
  declare attachment_filename: string;
  declare pdf_sha256: string;
  declare readonly updatedAt: Date;
  declare readonly createdAt: Date;
}

export const initEmailClaimArtifactModel = (sequelize: Sequelize): typeof EmailClaimArtifact => {
  EmailClaimArtifact.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      organisation_id: { type: DataTypes.STRING, allowNull: false },
      zone_id: { type: DataTypes.STRING, allowNull: false },
      email_address: { type: DataTypes.STRING, allowNull: false },
      imap_uid: { type: DataTypes.INTEGER, allowNull: false },
      imap_mailbox: { type: DataTypes.STRING, allowNull: false, defaultValue: "INBOX" },
      imap_uidvalidity: { type: DataTypes.BIGINT, allowNull: true },
      rfc_message_id: { type: DataTypes.TEXT, allowNull: true },
      email_body_text: { type: DataTypes.TEXT, allowNull: false },
      matched_keywords: { type: DataTypes.JSONB, allowNull: false },
      trace_id: { type: DataTypes.UUID, allowNull: false, unique: true },
      landing_path: { type: DataTypes.STRING, allowNull: false, unique: true },
      attachment_filename: { type: DataTypes.STRING, allowNull: false },
      pdf_sha256: { type: DataTypes.STRING, allowNull: false },
    },
    {
      sequelize,
      tableName: "Email_Claim_Artifact",
      timestamps: true,
      underscored: true,
    },
  );

  return EmailClaimArtifact;
};
