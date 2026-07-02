"use strict";

/** Breaking change: drops and recreates Ingestion_Channel_Master with composite PK; adds Ingestion_Channel_Insurer_Map. */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Ingestion_Channel_Insurer_Map")) {
      await queryInterface.dropTable("Ingestion_Channel_Insurer_Map");
    }
    if (tables.includes("Ingestion_Channel_Master")) {
      await queryInterface.dropTable("Ingestion_Channel_Master");
    }

    await queryInterface.createTable("Ingestion_Channel_Master", {
      organisation_id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      insurance_company_code: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      configuration_strategy: {
        type: Sequelize.ENUM("DEDICATED", "SHARED"),
        allowNull: false,
        defaultValue: "DEDICATED",
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
      kms_service_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      vault_token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.createTable("Ingestion_Channel_Insurer_Map", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      organisation_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      insurance_company_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex(
      "Ingestion_Channel_Insurer_Map",
      ["organisation_id", "insurance_company_code"],
      {
        unique: true,
        name: "ingestion_channel_insurer_map_org_insurer_uq",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Ingestion_Channel_Insurer_Map");
    await queryInterface.dropTable("Ingestion_Channel_Master");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Ingestion_Channel_Master_configuration_strategy";',
    );
  },
};
