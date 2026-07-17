import { Sequelize } from "sequelize";
import { config } from "../config";
import { initWhatsappChannelModel } from "../models/whatsapp-channel.model";

export const sequelize = new Sequelize(config.dbUrl, { logging: false });
export const WhatsappChannelModel = initWhatsappChannelModel(sequelize);
