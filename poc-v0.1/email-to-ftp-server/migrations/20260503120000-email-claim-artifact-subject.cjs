"use strict";

/** Adds email_subject_text; keyword matching unchanged; body-only storage fix applied in app code for new rows. */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "Email_Claim_Artifact";
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(table)) {
      return;
    }

    await queryInterface.addColumn(table, "email_subject_text", {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: "",
    });
  },

  async down(queryInterface, Sequelize) {
    const table = "Email_Claim_Artifact";
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(table)) {
      return;
    }

    await queryInterface.removeColumn(table, "email_subject_text");
  },
};
