"use strict";

/** Adds zone + IMAP poll cursor to email sources; creates claim artifact rows linking PDF landing objects to email bodies. */

module.exports = {
  async up(queryInterface, Sequelize) {
    const sourceTable = "Email_Source_Master";
    const tables = await queryInterface.showAllTables();
    if (tables.includes(sourceTable)) {
      await queryInterface.addColumn(sourceTable, "zone_id", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "eu-central-1",
      });
      await queryInterface.addColumn(sourceTable, "last_processed_uid", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!tables.includes("Email_Claim_Artifact")) {
      await queryInterface.createTable("Email_Claim_Artifact", {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
        },
        organisation_id: { type: Sequelize.STRING, allowNull: false },
        zone_id: { type: Sequelize.STRING, allowNull: false },
        email_address: { type: Sequelize.STRING, allowNull: false },
        imap_uid: { type: Sequelize.INTEGER, allowNull: false },
        imap_mailbox: { type: Sequelize.STRING, allowNull: false, defaultValue: "INBOX" },
        imap_uidvalidity: { type: Sequelize.BIGINT, allowNull: true },
        rfc_message_id: { type: Sequelize.TEXT, allowNull: true },
        email_body_text: { type: Sequelize.TEXT, allowNull: false },
        matched_keywords: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        trace_id: { type: Sequelize.UUID, allowNull: false, unique: true },
        landing_path: { type: Sequelize.STRING, allowNull: false, unique: true },
        attachment_filename: { type: Sequelize.STRING, allowNull: false },
        pdf_sha256: { type: Sequelize.STRING, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("Email_Claim_Artifact", ["email_address", "imap_uid"], {
        name: "email_claim_artifact_email_uid_idx",
      });
      await queryInterface.addIndex("Email_Claim_Artifact", ["organisation_id"], {
        name: "email_claim_artifact_org_idx",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Email_Claim_Artifact")) {
      await queryInterface.dropTable("Email_Claim_Artifact");
    }
    const sourceTable = "Email_Source_Master";
    if (tables.includes(sourceTable)) {
      await queryInterface.removeColumn(sourceTable, "last_processed_uid");
      await queryInterface.removeColumn(sourceTable, "zone_id");
    }
  },
};
