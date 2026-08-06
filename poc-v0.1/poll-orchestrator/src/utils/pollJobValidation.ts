import type { PollJobChannelType, PollJobMessage } from '../kafka'

const VALID_CHANNEL_TYPES = new Set<PollJobChannelType>([
  'FTP',
  'S3',
  'SFTP',
  'MINIO',
  'GCP',
  'AZURE',
  'EMAIL',
  'WHATSAPP',
])

function rejectInvalidString(
  reasons: string[],
  field: string,
  value: unknown,
  options?: { rejectLiteralUndefined?: boolean },
): void {
  if (value === undefined || value === null) {
    reasons.push(`${field} is missing`)
    return
  }
  if (typeof value !== 'string') {
    reasons.push(`${field} must be a string`)
    return
  }
  if (value.trim().length === 0) {
    reasons.push(`${field} must be a non-empty string`)
    return
  }
  if (options?.rejectLiteralUndefined && value === 'undefined') {
    reasons.push(`${field} is the literal string "undefined"`)
  }
}

export type PollJobValidationResult =
  | { valid: true; job: PollJobMessage }
  | { valid: false; reasons: string[] }

export function validatePollJobMessage(payload: unknown): PollJobValidationResult {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, reasons: ['payload must be a JSON object'] }
  }

  const obj = payload as Record<string, unknown>
  const reasons: string[] = []

  rejectInvalidString(reasons, 'credId', obj.credId)
  rejectInvalidString(reasons, 'orgId', obj.orgId)
  rejectInvalidString(reasons, 'vaultToken', obj.vaultToken, { rejectLiteralUndefined: true })
  rejectInvalidString(reasons, 'kmsServiceId', obj.kmsServiceId)
  rejectInvalidString(reasons, 'region', obj.region)
  rejectInvalidString(reasons, 'scheduledAt', obj.scheduledAt)

  const channelType = obj.channelType
  if (channelType === undefined || channelType === null) {
    reasons.push('channelType is missing')
  } else if (typeof channelType !== 'string' || !VALID_CHANNEL_TYPES.has(channelType as PollJobChannelType)) {
    reasons.push(`channelType is invalid: ${String(channelType)}`)
  }

  const typedChannelType = channelType as PollJobChannelType | undefined

  if (typedChannelType === 'EMAIL') {
    rejectInvalidString(reasons, 'emailAddress', obj.emailAddress)
    rejectInvalidString(reasons, 'insuranceCompanyCode', obj.insuranceCompanyCode)
  } else if (typedChannelType && VALID_CHANNEL_TYPES.has(typedChannelType)) {
    rejectInvalidString(reasons, 'insuranceCompanyCode', obj.insuranceCompanyCode)
    if (typedChannelType !== 'MINIO') {
      rejectInvalidString(reasons, 'sourcePrefix', obj.sourcePrefix)
    }
  }

  if (reasons.length > 0) {
    return { valid: false, reasons }
  }

  return { valid: true, job: obj as unknown as PollJobMessage }
}
