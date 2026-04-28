import { Sequelize } from "sequelize";
import { config } from "../config";
import { initIngestionChannelModel } from "../models/ingestionChannel.model";
import { initEmailSourceModel } from "../models/email-source.model";

export const sequelize = new Sequelize(config.dbUrl, { logging: false });
export const IngestionChannelModel = initIngestionChannelModel(sequelize);
export const EmailSourceModel = initEmailSourceModel(sequelize);