import { Sequelize } from "sequelize";
import { config } from "../config";
import { initIngestionChannelModel } from "../models/ingestionChannel.model";

export const sequelize = new Sequelize(config.dbUrl, { logging: false });
export const IngestionChannelModel = initIngestionChannelModel(sequelize);
