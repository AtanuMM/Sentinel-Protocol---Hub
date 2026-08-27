"use strict";

/** Per-channel Sentinel landing storage metadata (credentials live in KMS with type LANDING). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "whatsapp_channels";
    const desc = await queryInterface.describeTable(table);

    if (!desc.landing_storage_provider) {
      await queryInterface.addColumn(table, "landing_storage_provider", {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    if (!desc.landing_bucket) {
      await queryInterface.addColumn(table, "landing_bucket", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!desc.landing_region) {
      await queryInterface.addColumn(table, "landing_region", {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }
    if (!desc.landing_endpoint) {
      await queryInterface.addColumn(table, "landing_endpoint", {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }
    if (!desc.landing_kms_key_name) {
      await queryInterface.addColumn(table, "landing_kms_key_name", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!desc.landing_use_ssl) {
      await queryInterface.addColumn(table, "landing_use_ssl", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      });
    }
    if (!desc.landing_port) {
      await queryInterface.addColumn(table, "landing_port", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "whatsapp_channels";
    const desc = await queryInterface.describeTable(table);
    if (desc.landing_port) await queryInterface.removeColumn(table, "landing_port");
    if (desc.landing_use_ssl) await queryInterface.removeColumn(table, "landing_use_ssl");
    if (desc.landing_kms_key_name) await queryInterface.removeColumn(table, "landing_kms_key_name");
    if (desc.landing_endpoint) await queryInterface.removeColumn(table, "landing_endpoint");
    if (desc.landing_region) await queryInterface.removeColumn(table, "landing_region");
    if (desc.landing_bucket) await queryInterface.removeColumn(table, "landing_bucket");
    if (desc.landing_storage_provider) {
      await queryInterface.removeColumn(table, "landing_storage_provider");
    }
  },
};
