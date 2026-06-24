"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Email_Source_Master")) {
      return;
    }

    await queryInterface.createTable("Email_Source_Master", {
      email_address: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      organisation_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      vault_secret_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      imap_host: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      imap_port: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 993,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("Email_Source_Master", ["organisation_id"], {
      name: "email_source_master_org_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Email_Source_Master");
  },
};
