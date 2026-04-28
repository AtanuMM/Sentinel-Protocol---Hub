import { EmailSourceModel } from "../../../../infra/db";
import { AppError } from "../../../../errors/appError";
import { vaultClient } from "../../../../utils/vault-client";
import { testImapConnection } from "../integration/imap-tester";
import type { RegisterEmailSourceInput } from "./provisioning.schemas";

export interface RegisterEmailSourceResult {
  email: string;
  orgId: string;
}

export class ProvisioningService {
  /**
   * Registers a new email source by:
   * 1. Probing the IMAP credentials against the mail server.
   * 2. Storing the password blob in the standalone Vault.
   * 3. Persisting non-sensitive metadata (+ vault secretId) in Postgres.
   *
   * On DB failure after a successful Vault write, attempts to delete the
   * orphan Vault secret to keep state consistent.
   */
  async registerEmailSource(
    input: RegisterEmailSourceInput,
    vaultToken: string,
  ): Promise<RegisterEmailSourceResult> {
    const { orgId, email, password, imapHost } = input;
    const imapPort = Number(input.imapPort) || 993;

    const connectionTest = await testImapConnection({
      host: imapHost,
      port: imapPort,
      user: email,
      pass: password,
    });

    if (!connectionTest.success) {
      throw new AppError(401, `IMAP Connection Failed: ${connectionTest.error}`, "IMAP_AUTH_FAILED");
    }

    let secretId: string;
    try {
      secretId = await vaultClient.storeSecret(
        { password, imap_host: imapHost, imap_port: imapPort },
        vaultToken,
      );
    } catch {
      throw new AppError(
        502,
        "Failed to secure credentials in Vault. Check if your Vault Token is valid.",
        "VAULT_STORE_FAILED",
      );
    }

    try {
      const newSource = await EmailSourceModel.create({
        organisation_id: orgId,
        email_address: email,
        vault_secret_id: secretId,
        imap_host: imapHost,
        imap_port: imapPort,
        is_active: true,
      } as never);

      return {
        email: newSource.email_address,
        orgId: newSource.organisation_id,
      };
    } catch (dbErr) {
      // Best-effort rollback so we don't leak orphan vault secrets.
      try {
        await vaultClient.deleteSecret(secretId, vaultToken);
      } catch {
        // Swallow rollback errors; the DB error is the primary failure.
      }
      throw new AppError(
        500,
        `Failed to save email source to the master database: ${(dbErr as Error).message}`,
        "EMAIL_SOURCE_PERSIST_FAILED",
      );
    }
  }
}
