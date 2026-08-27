import { WhatsappChannelModel } from "../infra/db";
import type { WhatsappChannel } from "../models/whatsapp-channel.model";

export interface UpdateLandingStorageMetadataInput {
  landing_storage_provider: string;
  landing_bucket: string;
  landing_region: string | null;
  landing_endpoint: string | null;
  landing_kms_key_name: string;
  landing_use_ssl: boolean | null;
  landing_port: number | null;
}

export async function findChannelByPhoneNumber(phoneNumber: string): Promise<WhatsappChannel | null> {
  return WhatsappChannelModel.findOne({
    where: {
      phone_number: phoneNumber,
      status: "ACTIVE",
    },
  });
}

export async function findChannelByPhoneNumberAnyStatus(phoneNumber: string): Promise<WhatsappChannel | null> {
  return WhatsappChannelModel.findOne({
    where: { phone_number: phoneNumber },
  });
}

export async function findChannelById(id: number): Promise<WhatsappChannel | null> {
  return WhatsappChannelModel.findByPk(id);
}

export async function findAllByOrgId(orgId: string): Promise<WhatsappChannel[]> {
  return WhatsappChannelModel.findAll({
    where: { org_id: orgId },
    order: [["created_at", "DESC"]],
  });
}

export async function setChannelStatus(
  phoneNumber: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<boolean> {
  const [updatedCount] = await WhatsappChannelModel.update({ status }, { where: { phone_number: phoneNumber } });
  return updatedCount > 0;
}

export async function updateLandingStorageMetadata(
  channelId: number,
  input: UpdateLandingStorageMetadataInput,
): Promise<WhatsappChannel | null> {
  const [updatedCount] = await WhatsappChannelModel.update(input, { where: { id: channelId } });
  if (updatedCount === 0) {
    return null;
  }
  return findChannelById(channelId);
}
