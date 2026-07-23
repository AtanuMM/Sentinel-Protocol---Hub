"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "Ingestion_Channel_Master",
      "service_running_status",
      {
        type: Sequelize.STRING,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "Ingestion_Channel_Master",
      "service_running_status",
    );
  },
};
