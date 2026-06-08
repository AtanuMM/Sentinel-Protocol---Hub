import { config } from '../config'
import { publishPollJob, type PollJobMessage } from '../kafka'
import { IngestionChannel } from '../models/channel.model'

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

    console.log(`[scheduler] Published ${published} poll job(s)`)
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
