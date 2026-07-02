import { config } from '../config'
import { publishPollJob, type PollJobChannelType, type PollJobMessage } from '../kafka'
import { IngestionChannelRepository } from '../repositories/ingestionChannel.repository'

const ingestionChannelRepository = new IngestionChannelRepository()

let intervalId: ReturnType<typeof setInterval> | undefined

async function runCycle(): Promise<void> {
  try {
    const channels = await ingestionChannelRepository.findActiveObjectStorageChannelsForPolling()
    let published = 0

    for (const channel of channels) {
      const kmsServiceId = channel.kms_service_id!
      const message: PollJobMessage = {
        credId: `${channel.organisation_id}:${kmsServiceId}`,
        orgId: channel.organisation_id,
        insuranceCompanyCode: channel.insurance_company_code,
        region: channel.region ?? 'eu-central-1',
        kmsServiceId,
        vaultToken: channel.vault_token_encrypted!,
        channelType: channel.channel_type as PollJobChannelType,
        scheduledAt: new Date().toISOString(),
      }
      await publishPollJob(message)
      published++
    }

    const emailChannels = await ingestionChannelRepository.findActiveEmailChannelsForPolling()
    let emailPublished = 0

    for (const source of emailChannels) {
      const vaultTokenEncrypted = source.vault_token_encrypted
      if (!vaultTokenEncrypted) {
        console.warn(
          `[scheduler] Email channel ${source.email_address} has no vault_token_encrypted; skipping. ` +
            'Backfill it with scripts/backfill-email-vault-token.',
        )
        continue
      }

      const message: PollJobMessage = {
        credId: `email:${source.email_address}`,
        orgId: source.organisation_id,
        insuranceCompanyCode: source.insurance_company_code,
        region: source.region ?? 'eu-central-1',
        kmsServiceId: source.kms_service_id!,
        vaultToken: vaultTokenEncrypted,
        channelType: 'EMAIL',
        scheduledAt: new Date().toISOString(),
        emailAddress: source.email_address ?? undefined,
      }
      await publishPollJob(message)
      emailPublished++
    }

    console.log(`[scheduler] Published ${published} FTP job(s) and ${emailPublished} email job(s)`)
  } catch (err) {
    console.error('[scheduler] Poll cycle failed:', err)
  }
}

export function startScheduler(): void {
  if (intervalId !== undefined) {
    return
  }
  intervalId = setInterval(() => {
    void runCycle()
  }, config.pollIntervalMs)
}

export function stopScheduler(): void {
  if (intervalId !== undefined) {
    clearInterval(intervalId)
    intervalId = undefined
  }
}
