"use strict";

/** KMS polling fields for ftp-to-ftp ingestion (see poll.engine.ts). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "Ingestion_Channel_Master";
    const desc = await queryInterface.describeTable(table);
    if (!desc.kms_service_id) {
      await queryInterface.addColumn(table, "kms_service_id", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!desc.vault_token_encrypted) {
      await queryInterface.addColumn(table, "vault_token_encrypted", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "Ingestion_Channel_Master";
    const desc = await queryInterface.describeTable(table);
    if (desc.kms_service_id) {
      await queryInterface.removeColumn(table, "kms_service_id");
    }
    if (desc.vault_token_encrypted) {
      await queryInterface.removeColumn(table, "vault_token_encrypted");
    }
  },
};
