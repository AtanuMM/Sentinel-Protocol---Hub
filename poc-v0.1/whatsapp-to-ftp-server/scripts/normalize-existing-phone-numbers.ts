/**
 * One-off backfill: store digits-only phone_number in whatsapp_channels.
 *
 * Usage: npx tsx scripts/normalize-existing-phone-numbers.ts
 */
import dotenv from "dotenv";
import { sequelize, WhatsappChannelModel } from "../src/infra/db";
import { normalizePhoneNumber } from "../src/utils/phoneNumber";

dotenv.config();

async function main(): Promise<void> {
  await sequelize.authenticate();

  const rows = await WhatsappChannelModel.findAll({ order: [["id", "ASC"]] });
  const normalizedById = new Map<number, string>();
  for (const row of rows) {
    normalizedById.set(row.id, normalizePhoneNumber(row.phone_number));
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const current = row.phone_number;
    const normalized = normalizedById.get(row.id)!;

    if (normalized === current) {
      continue;
    }

    if (!normalized) {
      console.error(
        `[skip] id=${row.id}: normalized value is empty (stored=${JSON.stringify(current)})`,
      );
      skipped++;
      continue;
    }

    const collision = rows.find(
      (other) => other.id !== row.id && normalizedById.get(other.id) === normalized,
    );
    if (collision) {
      console.error(
        `[collision] id=${row.id} would normalize to ${JSON.stringify(normalized)} ` +
          `but id=${collision.id} already maps to the same digits (stored=${JSON.stringify(collision.phone_number)}); skipping`,
      );
      skipped++;
      continue;
    }

    const existingWithTarget = rows.find(
      (other) => other.id !== row.id && other.phone_number === normalized,
    );
    if (existingWithTarget) {
      console.error(
        `[collision] id=${row.id} target ${JSON.stringify(normalized)} already stored on id=${existingWithTarget.id}; skipping`,
      );
      skipped++;
      continue;
    }

    try {
      await WhatsappChannelModel.update(
        { phone_number: normalized },
        { where: { id: row.id, phone_number: current } },
      );
      console.log(`[updated] id=${row.id}: ${JSON.stringify(current)} -> ${JSON.stringify(normalized)}`);
      updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[error] id=${row.id}: failed to update ${JSON.stringify(current)} -> ${JSON.stringify(normalized)}: ${message}`,
      );
      skipped++;
    }
  }

  console.log(`Done. updated=${updated} skipped=${skipped} total=${rows.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
