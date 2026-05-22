"use strict";

/** Drops email_subject_text and email_body_text; content is stored only as email-transcript.pdf in MinIO. */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "Email_Claim_Artifact";
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(table)) {
      return;
    }

    const desc = await queryInterface.describeTable(table);
    if (desc.email_subject_text) {
      await queryInterface.removeColumn(table, "email_subject_text");
    }
    if (desc.email_body_text) {
      await queryInterface.removeColumn(table, "email_body_text");
    }
  },

  async down(queryInterface, Sequelize) {
    const table = "Email_Claim_Artifact";
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(table)) {
      return;
    }

    const desc = await queryInterface.describeTable(table);
    if (!desc.email_subject_text) {
      await queryInterface.addColumn(table, "email_subject_text", {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      });
    }
    if (!desc.email_body_text) {
      await queryInterface.addColumn(table, "email_body_text", {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      });
    }
  },
};
