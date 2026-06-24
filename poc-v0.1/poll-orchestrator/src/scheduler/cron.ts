import { config } from '../config'
import { publishPollJob, type PollJobMessage } from '../kafka'
import { IngestionChannel } from '../models/channel.model'
import { EmailSource } from '../models/email-source.model'

let intervalId: ReturnType<typeof setInterval> | undefined

function detectChannelType(_kmsServiceId: string): PollJobMessage['channelType'] {
  // Future: read from a dedicated channel_type column once migrated.
  return 'FTP'
}

async function runCycle(): Promise<void> {
  try {
    const channels = await IngestionChannel.findActiveForPolling()
    let published = 0

    for (const channel of channels) {
      const kmsServiceId = channel.kms_service_id!
      const message: PollJobMessage = {
        credId: `${channel.organisation_id}:${kmsServiceId}`,
        orgId: channel.organisation_id,
        zoneId: channel.region,
        kmsServiceId,
        vaultToken: channel.vault_token_encrypted!,
        channelType: detectChannelType(kmsServiceId),
        scheduledAt: new Date().toISOString(),
      }
      await publishPollJob(message)
      published++
    }

    const emailSources = await EmailSource.findActiveForPolling()
    let emailPublished = 0

    for (const source of emailSources) {
      // Carry the encrypted token, exactly like the FTP branch above (channel.vault_token_encrypted).
      // The worker (workers/pool.ts) decrypts job.vaultToken via decryptText for all channel types,
      // so the message must hold ciphertext — decrypting here would double-decrypt and fail.
      const vaultTokenEncrypted = source.vault_token_encrypted
      if (!vaultTokenEncrypted) {
        // Legacy row registered before vault_token_encrypted existed. Skip just this source and
        // log how to remediate (one-off backfill), rather than failing the whole cycle.
        console.warn(
          `[scheduler] Email source ${source.email_address} has no vault_token_encrypted; skipping. ` +
            'Backfill it with scripts/backfill-email-vault-token.',
        )
        continue
      }

      const message: PollJobMessage = {
        credId: `email:${source.email_address}`,
        orgId: source.organisation_id,
        zoneId: source.zone_id,
        kmsServiceId: source.vault_service_id,
        vaultToken: vaultTokenEncrypted,
        channelType: 'EMAIL',
        scheduledAt: new Date().toISOString(),
        emailAddress: source.email_address,
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
