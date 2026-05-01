import { EmailSourceModel } from "../../../../infra/db";
import { AppError } from "../../../../errors/appError";
import { config } from "../../../../config";
import { vaultClient } from "../../../../utils/vault-client";
import { fetchInboxPreview, type PreviewMessagePayload } from "../integration/imap-inbox-preview";
import { resolveRegisteredImapCredentials } from "../integration/vault-imap-resolve";
import { testImapConnection } from "../integration/imap-tester";
import type {
  PreviewInboxInput,
  RegisterEmailSourceInput,
  TestEmailSourceInput,
} from "./provisioning.schemas";

export interface RegisterEmailSourceResult {
  email: string;
  orgId: string;
}

export interface TestEmailSourceResult {
  active: boolean;
  detail?: string;
}

export interface PreviewInboxResult {
  email: string;
  messages: PreviewMessagePayload[];
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
    const zoneId = (input.zoneId && input.zoneId.trim()) || config.defaultEmailZone;

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
        zone_id: zoneId,
        last_processed_uid: 0,
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

    const creds = await resolveRegisteredImapCredentials(email, serviceId, vaultToken);

    const connectionTest = await testImapConnection({
      host: creds.host,
      port: creds.port,
      user: creds.user,
      pass: creds.pass,
    });

    if (!connectionTest.success) {
      return { active: false, detail: connectionTest.error };
    }
    return { active: true };
  }

  /**
   * POC: opens INBOX read-only, returns recent messages with truncated bodies and base64 attachments (capped).
   */
  async previewInbox(input: PreviewInboxInput, vaultToken: string): Promise<PreviewInboxResult> {
    const creds = await resolveRegisteredImapCredentials(
      input.email.trim(),
      input.serviceId,
      vaultToken,
    );

    const rawLimit = input.limit ?? 10;
    const limit = Math.min(Math.max(rawLimit, 1), 25);
    const maxAttachmentBytes = input.maxAttachmentBytes ?? 262_144;

    try {
      const messages = await fetchInboxPreview(creds, {
        limit,
        maxAttachmentBytes,
        bodyPreviewMaxChars: 32_768,
        mailboxPath: process.env.IMAP_PREVIEW_MAILBOX?.trim() || "INBOX",
      });
      return { email: input.email.trim(), messages };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(502, `IMAP inbox preview failed: ${msg}`, "IMAP_PREVIEW_FAILED");
    }
  }
}
