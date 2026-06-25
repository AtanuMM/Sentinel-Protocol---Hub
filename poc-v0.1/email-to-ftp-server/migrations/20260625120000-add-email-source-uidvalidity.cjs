"use strict";

/**
 * Adds imap_uidvalidity to Email_Source_Master.
 *
 * IMAP UIDs are only meaningful within a given UIDVALIDITY (RFC 3501): when a mailbox is recreated
 * or the server can no longer guarantee UID stability, UIDVALIDITY changes. Persisting it lets the
 * poller reset last_processed_uid to 0 ONLY when the UID space actually changed, instead of guessing
 * from inbox size (which mis-fires on ordinary deletes and causes duplicate ingestion at scale).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "Email_Source_Master";
    const desc = await queryInterface.describeTable(table);
    if (!desc.imap_uidvalidity) {
      await queryInterface.addColumn(table, "imap_uidvalidity", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "Email_Source_Master";
    const desc = await queryInterface.describeTable(table);
    if (desc.imap_uidvalidity) {
      await queryInterface.removeColumn(table, "imap_uidvalidity");
    }
  },
};
