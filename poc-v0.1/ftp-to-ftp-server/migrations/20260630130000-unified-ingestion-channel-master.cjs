"use strict";

/** Breaking change: merges Email_Source_Master into Ingestion_Channel_Master (unified channel table). */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (tables.includes("Email_Source_Master")) {
      await queryInterface.dropTable("Email_Source_Master");
    }
    if (tables.includes("Ingestion_Channel_Master")) {
      await queryInterface.dropTable("Ingestion_Channel_Master");
    }

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Ingestion_Channel_Master_configuration_strategy";',
    );

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
      channel_type: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      configuration_strategy: {
        type: Sequelize.ENUM("DEDICATED", "SHARED"),
        allowNull: false,
        defaultValue: "DEDICATED",
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
      source_prefix: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      source_bucket: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      external_username: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      external_password_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      region: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email_address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      last_processed_uid: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      imap_uidvalidity: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Ingestion_Channel_Master");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Ingestion_Channel_Master_configuration_strategy";',
    );
  },
};
