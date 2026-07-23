"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Ingestion_Log", {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      org_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      insurance_company_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      channel_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      source_path: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      landing_path: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file_size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("SUCCESS", "FAILED"),
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ingested_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("Ingestion_Log", [
      "org_id",
      "insurance_company_code",
    ]);
    await queryInterface.addIndex("Ingestion_Log", ["org_id", "ingested_at"]);
    await queryInterface.addIndex("Ingestion_Log", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Ingestion_Log");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Ingestion_Log_status";',
    );
  },
};
