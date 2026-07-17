"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("whatsapp_channels")) {
      return;
    }

    await queryInterface.createTable("whatsapp_channels", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      org_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      zone_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      kms_service_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      vault_token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      waba_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone_number_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("whatsapp_channels", ["phone_number"], {
      name: "whatsapp_channels_phone_number_idx",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("whatsapp_channels");
  },
};
