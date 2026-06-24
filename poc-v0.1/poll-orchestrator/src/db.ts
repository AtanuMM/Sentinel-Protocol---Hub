import { Sequelize } from 'sequelize'
import { config } from './config'
import { initIngestionChannelModel } from './models/channel.model'
import { initEmailSourceModel } from './models/email-source.model'

export const sequelize = new Sequelize(config.dbUrl, {
  logging: false,
})

initIngestionChannelModel(sequelize)
initEmailSourceModel(sequelize)
