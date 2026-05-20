import { EmailSourceModel } from "../../../../infra/db";
import { AppError } from "../../../../errors/appError";
import { config } from "../../../../config";
import { vaultClient } from "../../../../utils/vault-client";
import { EmailSourceRepository } from "../../../../repositories/emailSource.repository";
import { getMaxUidForMailbox } from "../integration/imap-mailbox-cursor";
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
  /** IMAP UID cursor stored at registration (max UID in mailbox when watermark used). */
  lastProcessedUid: number;
}

export interface TestEmailSourceResult {
  active: boolean;
  detail?: string;
}

export interface PreviewInboxResult {
  email: string;
  messages: PreviewMessagePayload[];
}

export interface EmailSourceImapStatus {
  active: boolean;
  detail?: string;
}

export interface EmailSourceListItem {
  email: string;
  serviceId: string;
  zoneId: string;
  isActive: boolean;
  lastProcessedUid: number;
  createdAt: string;
  updatedAt: string;
  imap: EmailSourceImapStatus | null;
}

export interface ListEmailSourcesResult {
  orgId: string;
  sources: EmailSourceListItem[];
}

export class ProvisioningService {
  constructor(private readonly emailSourceRepository: EmailSourceRepository) {}
  /**
   * Registers a new email source by:
   * 1. Probing the IMAP credentials against the mail server.
   * 2. Optionally reading the current max UID in the poll mailbox (default) so `last_processed_uid` skips existing backlog.
   * 3. Storing credentials in Key Vault (single source of truth for host/port/password).
   * 4. Persisting email, org, service id, and is_active in Postgres (no imap/vault row ids).
   *
   * On DB failure after a successful Vault write, attempts to delete the
   * orphan Vault secret to keep state consistent.
   */
  async registerEmailSource(
    input: RegisterEmailSourceInput,
    vaultToken: string,
  ): Promise<RegisterEmailSourceResult> {
    const { orgId, serviceId, password, imapHost } = input;
    const email = input.email.trim();
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

    const useMailboxWatermark = input.startFromCurrentMailboxWatermark !== false;
    let initialLastProcessedUid = 0;
    if (useMailboxWatermark) {
      try {
        initialLastProcessedUid = await getMaxUidForMailbox({
          host: imapHost,
          port: imapPort,
          user: email,
          pass: password,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(502, `Failed to read mailbox UID watermark: ${msg}`, "IMAP_MAILBOX_CURSOR_FAILED");
      }
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
        last_processed_uid: initialLastProcessedUid,
        is_active: true,
      } as never);

      return {
        email: newSource.email_address,
        orgId: newSource.organisation_id,
        lastProcessedUid: initialLastProcessedUid,
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
   * Lists registered email sources for an organisation. Optionally runs a live IMAP probe per row
   * (O(n) network calls — use sparingly).
   */
  async listEmailSourcesByOrg(
    orgId: string,
    vaultToken: string,
    options: { includeConnectionStatus: boolean },
  ): Promise<ListEmailSourcesResult> {
    const trimmedOrg = orgId.trim();
    if (!trimmedOrg) {
      throw new AppError(400, "orgId is required.", "ORG_ID_REQUIRED");
    }

    const rows = await this.emailSourceRepository.findAllByOrganisationId(trimmedOrg);
    const sources: EmailSourceListItem[] = [];

    for (const row of rows) {
      const base = {
        email: row.email_address,
        serviceId: row.vault_service_id,
        zoneId: row.zone_id,
        isActive: row.is_active,
        lastProcessedUid: row.last_processed_uid,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };

      if (!options.includeConnectionStatus) {
        sources.push({ ...base, imap: null });
        continue;
      }

      try {
        const imapResult = await this.testEmailSourceConnection(
          { email: row.email_address, serviceId: row.vault_service_id },
          vaultToken,
        );
        sources.push({
          ...base,
          imap: {
            active: imapResult.active,
            ...(imapResult.detail ? { detail: imapResult.detail } : {}),
          },
        });
      } catch (err) {
        const msg = err instanceof AppError ? err.message : String(err);
        sources.push({
          ...base,
          imap: { active: false, detail: msg },
        });
      }
    }

    return { orgId: trimmedOrg, sources };
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
