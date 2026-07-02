import { Sequelize } from "sequelize";
import { config } from "../config";
import { initEmailClaimArtifactModel } from "../models/email-claim-artifact.model";
import { initIngestionChannelModel } from "../models/ingestionChannel.model";
import { initIngestionChannelInsurerMapModel } from "../models/ingestionChannelInsurerMap.model";
import { initEmailSourceModel } from "../models/email-source.model";

export const sequelize = new Sequelize(config.dbUrl, { logging: false });
export const IngestionChannelModel = initIngestionChannelModel(sequelize);
export const IngestionChannelInsurerMapModel = initIngestionChannelInsurerMapModel(sequelize);
export const EmailSourceModel = initEmailSourceModel(sequelize);
export const EmailClaimArtifactModel = initEmailClaimArtifactModel(sequelize);