"use strict";

/**
 * Adds vault_token_encrypted to Email_Source_Master so the headless poll-orchestrator can
 * authenticate to KMS for email polling without an inbound x-vault-token request header.
 * Mirrors Ingestion_Channel_Master.vault_token_encrypted exactly (TEXT, nullable).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "Email_Source_Master";
    const desc = await queryInterface.describeTable(table);
    if (!desc.vault_token_encrypted) {
      await queryInterface.addColumn(table, "vault_token_encrypted", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "Email_Source_Master";
    const desc = await queryInterface.describeTable(table);
    if (desc.vault_token_encrypted) {
      await queryInterface.removeColumn(table, "vault_token_encrypted");
    }
  },
};
