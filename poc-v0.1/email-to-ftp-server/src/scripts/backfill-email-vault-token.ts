/**
 * One-off backfill: encrypt a plaintext KMS vault token and store it on an existing
 * Email_Source_Master row's `vault_token_encrypted` column (added in migration
 * 20260617120000-add-email-source-vault-token).
 *
 * Use this for email sources registered before `vault_token_encrypted` existed, so the headless
 * poll-orchestrator can authenticate to KMS for email polling.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-email-vault-token.ts <email_address> <plaintext_vault_token>
 *
 * No secrets are hardcoded — the token is read from argv, encrypted with the shared encryptText
 * (same scheme as registration / FTP), and only ever printed masked.
 */
import { EmailSourceModel, sequelize } from "../infra/db";
import { encryptText } from "../utils/crypto";

function maskToken(token: string): string {
  if (token.length <= 4) {
    return "*".repeat(token.length);
  }
  return `${token.slice(0, 2)}***${token.slice(-2)}`;
}

async function main(): Promise<void> {
  const [, , emailArg, tokenArg] = process.argv;
  const email = emailArg?.trim();
  const token = tokenArg;

  if (!email || !token) {
    console.error(
      "Usage: tsx src/scripts/backfill-email-vault-token.ts <email_address> <plaintext_vault_token>",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const encrypted = encryptText(token);
    const [affected] = await EmailSourceModel.update(
      { vault_token_encrypted: encrypted },
      { where: { email_address: email } },
    );

    if (affected === 0) {
      console.error(
        `No Email_Source_Master row found for email_address="${email}". Nothing updated.`,
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `Updated vault_token_encrypted for ${email} (rows affected: ${affected}, token: ${maskToken(token)}).`,
    );
  } catch (err) {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

void main();
