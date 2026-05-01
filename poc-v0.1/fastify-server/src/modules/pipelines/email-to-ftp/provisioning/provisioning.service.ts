import { EmailSourceModel } from "../../../../infra/db";
import { AppError } from "../../../../errors/appError";
import { vaultClient, type VaultSecretListItem } from "../../../../utils/vault-client";
import { testImapConnection } from "../integration/imap-tester";
import type { RegisterEmailSourceInput, TestEmailSourceInput } from "./provisioning.schemas";

export interface RegisterEmailSourceResult {
  email: string;
  orgId: string;
}

export interface TestEmailSourceResult {
  active: boolean;
  detail?: string;
}

function pickImapSecretForEmail(
  items: VaultSecretListItem[],
  email: string,
): VaultSecretListItem | undefined {
  const matches = items.filter((item) => {
    const v = item.value;
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return false;
    }
    const rec = v as Record<string, unknown>;
    return typeof rec.email === "string" && rec.email === email;
  });
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length === 1) {
    return matches[0];
  }
    const scored = matches.map((m) => ({
      item: m,
      t: (() => {
        const x = new Date(String(m.updatedAt)).getTime();
        return Number.isFinite(x) ? x : 0;
      })(),
    }));
  scored.sort((a, b) => b.t - a.t);
  return scored[0].item;
}

export class ProvisioningService {
  /**
   * Registers a new email source by:
   * 1. Probing the IMAP credentials against the mail server.
   * 2. Storing credentials in Key Vault (single source of truth for host/port/password).
   * 3. Persisting email, org, service id, and is_active in Postgres (no imap/vault row ids).
   *
   * On DB failure after a successful Vault write, attempts to delete the
   * orphan Vault secret to keep state consistent.
   */
  async registerEmailSource(
    input: RegisterEmailSourceInput,
    vaultToken: string,
  ): Promise<RegisterEmailSourceResult> {
    const { orgId, serviceId, email, password, imapHost } = input;
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

    const vaultKeyName = `imap:${email}`;
    let secretId: string;
    try {
      secretId = await vaultClient.storeSecret(
        {
          serviceId,
          keyName: vaultKeyName,
          value: {
            email,
            password,
            imap_host: imapHost,
            imap_port: imapPort,
          },
        },
        vaultToken,
      );
    } catch (vaultErr) {
      const msg = vaultErr instanceof Error ? vaultErr.message : String(vaultErr);
      throw new AppError(
        502,
        `Failed to secure credentials in Vault: ${msg}`,
        "VAULT_STORE_FAILED",
      );
    }

    try {
      const newSource = await EmailSourceModel.create({
        organisation_id: orgId,
        email_address: email,
        vault_service_id: serviceId,
        is_active: true,
      } as never);

      return {
        email: newSource.email_address,
        orgId: newSource.organisation_id,
      };
    } catch (dbErr) {
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

  /**
   * Lists Vault secrets for the row's service id and probes IMAP using the entry where value.email matches.
   */
  async testEmailSourceConnection(
    input: TestEmailSourceInput,
    vaultToken: string,
  ): Promise<TestEmailSourceResult> {
    const { email, serviceId } = input;
    const row = await EmailSourceModel.findByPk(email);
    if (!row) {
      throw new AppError(404, "Email source not found in master database.", "EMAIL_SOURCE_NOT_FOUND");
    }

    if (row.vault_service_id !== serviceId) {
      throw new AppError(
        403,
        "serviceId does not match the registered email source.",
        "SERVICE_ID_MISMATCH",
      );
    }

    let items: VaultSecretListItem[];
    try {
      items = await vaultClient.listSecretsForService(row.vault_service_id, vaultToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(502, `Failed to read credentials from Vault: ${msg}`, "VAULT_FETCH_FAILED");
    }

    const picked = pickImapSecretForEmail(items, email);
    if (!picked || typeof picked.value !== "object" || picked.value === null || Array.isArray(picked.value)) {
      throw new AppError(
        404,
        "No Vault secret found for this email (value.email match).",
        "SECRET_NOT_FOUND_FOR_EMAIL",
      );
    }

    const vaultValue = picked.value as Record<string, unknown>;

    const password = vaultValue.password;
    if (typeof password !== "string" || password.length === 0) {
      throw new AppError(500, "Stored secret is missing password.", "VAULT_SECRET_INVALID");
    }

    const imapHost = typeof vaultValue.imap_host === "string" ? vaultValue.imap_host : "";
    if (!imapHost) {
      throw new AppError(500, "Stored secret is missing imap_host.", "VAULT_SECRET_INVALID");
    }

    const imapPort = Number(vaultValue.imap_port) || 993;
    const loginUser =
      typeof vaultValue.email === "string" && vaultValue.email.length > 0
        ? vaultValue.email
        : email;

    const connectionTest = await testImapConnection({
      host: imapHost,
      port: imapPort,
      user: loginUser,
      pass: password,
    });

    if (!connectionTest.success) {
      return { active: false, detail: connectionTest.error };
    }
    return { active: true };
  }
}
