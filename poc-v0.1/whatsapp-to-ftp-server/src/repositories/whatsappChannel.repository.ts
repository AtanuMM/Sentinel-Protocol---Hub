import { WhatsappChannelModel } from "../infra/db";
import type { WhatsappChannel } from "../models/whatsapp-channel.model";

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
