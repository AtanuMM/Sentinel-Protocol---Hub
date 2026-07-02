import axios from "axios";
import { WhatsappChannelModel } from "../../../../infra/db";
import { AppError } from "../../../../errors/appError";
import { config } from "../../../../config";
import { encryptText } from "../../../../utils/crypto";
import { vaultClient } from "../../../../utils/vault-client";
import {
  findAllByOrgId,
  findChannelByPhoneNumberAnyStatus,
  setChannelStatus,
} from "../../../../repositories/whatsappChannel.repository";
import type {
  ConnectWhatsappChannelInput,
  DisconnectWhatsappChannelInput,
} from "./provisioning.schemas";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

function metaErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as { error?: { message?: string }; message?: string };
    if (typeof data.error?.message === "string") return data.error.message;
    if (typeof data.message === "string") return data.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export interface WhatsappChannelListItem {
  phoneNumber: string;
  wabaId: string;
  phoneNumberId: string;
  zoneId: string;
  status: string;
  createdAt: string;
}

export class ProvisioningService {
  async connectWhatsappChannel(
    input: ConnectWhatsappChannelInput,
    vaultToken: string,
  ): Promise<{ phoneNumber: string; orgId: string; wabaId: string }> {
    const { orgId, serviceId, zoneId, authorizationCode } = input;

    let accessToken: string;
    try {
      const tokenResponse = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
        params: {
          client_id: config.metaAppId,
          client_secret: config.whatsappAppSecret,
          code: authorizationCode,
        },
      });
      accessToken = tokenResponse.data?.access_token as string;
      if (!accessToken) {
        throw new AppError(502, "Meta token exchange failed: no access_token in response", "META_TOKEN_EXCHANGE_FAILED");
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(502, `Meta token exchange failed: ${metaErrorMessage(err)}`, "META_TOKEN_EXCHANGE_FAILED");
    }

    let wabaId: string;
    let phoneNumberId: string;
    let phoneNumber: string;
    try {
      const accountsResponse = await axios.get(`${META_GRAPH_BASE}/me/whatsapp_business_accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const waba = accountsResponse.data?.data?.[0] as { id?: string } | undefined;
      if (!waba?.id) {
        throw new AppError(502, "Meta accounts fetch failed: no WABA found", "META_WABA_NOT_FOUND");
      }
      wabaId = waba.id;

      const phonesResponse = await axios.get(`${META_GRAPH_BASE}/${wabaId}/phone_numbers`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const phone = phonesResponse.data?.data?.[0] as
        | { id?: string; display_phone_number?: string }
        | undefined;
      if (!phone?.id || !phone?.display_phone_number) {
        throw new AppError(502, "Meta phone numbers fetch failed: no phone number found", "META_PHONE_NOT_FOUND");
      }
      phoneNumberId = phone.id;
      phoneNumber = phone.display_phone_number;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(502, `Meta WABA/phone fetch failed: ${metaErrorMessage(err)}`, "META_ACCOUNTS_FETCH_FAILED");
    }

    try {
      await axios.post(`${META_GRAPH_BASE}/${wabaId}/subscribed_apps`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.warn(
        `[whatsapp-provisioning] subscribed_apps failed for wabaId=${wabaId} (Tech Provider approval may be pending): ${metaErrorMessage(err)}`,
      );
    }

    const vaultKeyName = `whatsapp:${phoneNumber}`;
    let secretId: string;
    try {
      secretId = await vaultClient.storeSecret(
        {
          serviceId,
          keyName: vaultKeyName,
          value: {
            provider: "WHATSAPP",
            phone_number: phoneNumber,
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            access_token: accessToken,
          },
        },
        vaultToken,
      );
    } catch (vaultErr) {
      const msg = vaultErr instanceof Error ? vaultErr.message : String(vaultErr);
      throw new AppError(502, `Failed to store WhatsApp credentials in Vault: ${msg}`, "VAULT_STORE_FAILED");
    }

    try {
      await WhatsappChannelModel.create({
        org_id: orgId,
        zone_id: zoneId,
        phone_number: phoneNumber,
        kms_service_id: serviceId,
        vault_token_encrypted: encryptText(vaultToken),
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        status: "ACTIVE",
      } as never);

      return { phoneNumber, orgId, wabaId };
    } catch (dbErr) {
      try {
        await vaultClient.deleteSecret(secretId, vaultToken);
      } catch {
        // Swallow rollback errors; the DB error is the primary failure.
      }

      const err = dbErr as Error & { name?: string; errors?: Array<{ path?: string }> };
      if (
        err.name === "SequelizeUniqueConstraintError" &&
        Array.isArray(err.errors) &&
        err.errors.some((e) => e.path === "phone_number")
      ) {
        throw new AppError(409, `WhatsApp number ${phoneNumber} is already connected.`, "WHATSAPP_CHANNEL_ALREADY_EXISTS");
      }
      throw new AppError(
        500,
        `Failed to save WhatsApp channel: ${(dbErr as Error).message}`,
        "WHATSAPP_CHANNEL_PERSIST_FAILED",
      );
    }
  }

  async listWhatsappChannels(orgId: string): Promise<{ orgId: string; channels: WhatsappChannelListItem[] }> {
    const trimmedOrg = orgId.trim();
    if (!trimmedOrg) {
      throw new AppError(400, "orgId is required.", "ORG_ID_REQUIRED");
    }

    const rows = await findAllByOrgId(trimmedOrg);
    const channels: WhatsappChannelListItem[] = rows.map((row) => ({
      phoneNumber: row.phone_number,
      wabaId: row.waba_id,
      phoneNumberId: row.phone_number_id,
      zoneId: row.zone_id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return { orgId: trimmedOrg, channels };
  }

  async disconnectWhatsappChannel(
    input: DisconnectWhatsappChannelInput,
    _vaultToken: string,
  ): Promise<void> {
    const phoneNumber = input.phoneNumber.trim();
    if (!phoneNumber) {
      throw new AppError(400, "phoneNumber is required.", "PHONE_NUMBER_REQUIRED");
    }

    const row = await findChannelByPhoneNumberAnyStatus(phoneNumber);
    if (!row) {
      throw new AppError(404, `WhatsApp channel ${phoneNumber} not found.`, "WHATSAPP_CHANNEL_NOT_FOUND");
    }

    if (row.status === "INACTIVE") {
      return;
    }

    const updated = await setChannelStatus(phoneNumber, "INACTIVE");
    if (!updated) {
      throw new AppError(404, `WhatsApp channel ${phoneNumber} not found.`, "WHATSAPP_CHANNEL_NOT_FOUND");
    }
  }
}
