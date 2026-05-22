"use strict";

/** Drops redundant Vault/imap columns; credentials live only in Key Vault. POC: truncates existing rows (incompatible schema). */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "Email_Source_Master";
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(tableName)) {
      return;
    }

    await queryInterface.sequelize.query(`TRUNCATE TABLE "${tableName}"`);

    await queryInterface.removeColumn(tableName, "vault_secret_id");
    await queryInterface.removeColumn(tableName, "imap_host");
    await queryInterface.removeColumn(tableName, "imap_port");

    await queryInterface.addColumn(tableName, "vault_service_id", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.addIndex(tableName, ["vault_service_id"], {
      name: "email_source_master_vault_service_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    const tableName = "Email_Source_Master";
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(tableName)) {
      return;
    }

    await queryInterface.removeIndex(tableName, "email_source_master_vault_service_idx");

    await queryInterface.removeColumn(tableName, "vault_service_id");

    await queryInterface.addColumn(tableName, "vault_secret_id", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn(tableName, "imap_host", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn(tableName, "imap_port", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 993,
    });
  },
};
