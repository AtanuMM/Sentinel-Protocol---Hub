"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Ingestion_Channel_Master"
      ADD COLUMN IF NOT EXISTS "external_password_encrypted" TEXT;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Ingestion_Channel_Master"
      SET "external_password_encrypted" = COALESCE("external_password_encrypted", "external_password")
      WHERE "external_password_encrypted" IS NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Ingestion_Channel_Master'
        AND column_name = 'external_password'
      );
    `);

    await queryInterface.changeColumn("Ingestion_Channel_Master", "external_password_encrypted", {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: "",
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Ingestion_Channel_Master"
      DROP COLUMN IF EXISTS "external_password_encrypted";
    `);
  },
};
