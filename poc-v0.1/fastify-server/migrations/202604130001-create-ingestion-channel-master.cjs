"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Ingestion_Channel_Master")) {
      return;
    }

    await queryInterface.createTable("Ingestion_Channel_Master", {
      organisation_id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      source_prefix: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      source_bucket: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      external_username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      external_password_encrypted: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      region: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      is_onboarded: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Ingestion_Channel_Master");
  },
};
