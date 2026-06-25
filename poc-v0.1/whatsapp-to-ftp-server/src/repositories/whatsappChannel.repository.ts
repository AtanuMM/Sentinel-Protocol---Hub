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
