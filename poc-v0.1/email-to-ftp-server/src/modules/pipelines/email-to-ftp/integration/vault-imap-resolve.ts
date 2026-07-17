import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { AppError } from "../../../../errors/appError";
import { vaultClient, type VaultSecretListItem } from "../../../../utils/vault-client";

export function pickImapSecretForEmail(
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

export interface ResolvedImapCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

const channelRepository = new IngestionChannelRepository();

/**
 * Loads registered EMAIL channel row + Vault secret (value.email match) and returns IMAP login parameters.
 */
export async function resolveRegisteredImapCredentials(
  email: string,
  serviceId: string,
  vaultToken: string,
): Promise<ResolvedImapCredentials> {
  const row = await channelRepository.findByEmailAndServiceId(email, serviceId);
  if (!row) {
    throw new AppError(404, "Email channel not found in master database.", "EMAIL_SOURCE_NOT_FOUND");
  }

  if (row.kms_service_id !== serviceId) {
    throw new AppError(
      403,
      "serviceId does not match the registered email channel.",
      "SERVICE_ID_MISMATCH",
    );
  }

  let items: VaultSecretListItem[];
  try {
    items = await vaultClient.listSecretsForService(row.kms_service_id!, vaultToken);
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
    typeof vaultValue.email === "string" && vaultValue.email.length > 0 ? vaultValue.email : email;

  return {
    host: imapHost,
    port: imapPort,
    user: loginUser,
    pass: password,
  };
}
