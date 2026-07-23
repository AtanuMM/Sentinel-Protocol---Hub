import { Op } from 'sequelize'
import { IngestionChannelModel } from '../db'
import type { IngestionChannel } from '../models/ingestionChannel.model'

interface EmailCursorUpdates {
  last_processed_uid?: number
  imap_uidvalidity?: string
}

export class IngestionChannelRepository {
  async findByOrgIdInsurerAndChannel(
    orgId: string,
    insuranceCompanyCode: string,
    channelType: string,
  ): Promise<IngestionChannel | null> {
    return IngestionChannelModel.findOne({
      where: {
        organisation_id: orgId,
        insurance_company_code: insuranceCompanyCode,
        channel_type: channelType,
      },
    })
  }

  async updateEmailCursor(
    orgId: string,
    insuranceCompanyCode: string,
    updates: EmailCursorUpdates,
  ): Promise<void> {
    await IngestionChannelModel.update(updates, {
      where: {
        organisation_id: orgId,
        insurance_company_code: insuranceCompanyCode,
        channel_type: 'EMAIL',
      },
    })
  }

  /** EMAIL channels eligible for polling (replaces EmailSource.findActiveForPolling). */
  async findActiveEmailChannelsForPolling(): Promise<IngestionChannel[]> {
    const rows = await IngestionChannelModel.findAll({
      where: {
        channel_type: 'EMAIL',
        is_onboarded: true,
        [Op.or]: [
          { service_running_status: 'LIVE' },
          { service_running_status: null },
        ],
      },
    })
    return rows.filter(
      (c) => Boolean(c.kms_service_id?.trim()) && Boolean(c.vault_token_encrypted?.trim()),
    )
  }

  /** Non-EMAIL object-storage channels eligible for polling (FTP, S3, SFTP, etc.). */
  async findActiveObjectStorageChannelsForPolling(): Promise<IngestionChannel[]> {
    const rows = await IngestionChannelModel.findAll({
      where: {
        is_onboarded: true,
        channel_type: { [Op.ne]: 'EMAIL' },
        [Op.or]: [
          { service_running_status: 'LIVE' },
          { service_running_status: null },
        ],
      },
    })
    return rows.filter(
      (c) => Boolean(c.kms_service_id?.trim()) && Boolean(c.vault_token_encrypted?.trim()),
    )
  }
}
