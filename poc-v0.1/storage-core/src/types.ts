import type { Readable } from 'stream'

export interface ReadInput {
  orgId: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  sourceChannel: string
  /** Raw value object from KMS, passed in by ingestion service */
  sourceCredentials: Record<string, any>
}

export interface WriteInput {
  orgId: string
  zoneId: string
  contextFolder: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  sourceChannel: string
}

export interface FileDescriptor {
  orgId: string
  zoneId: string
  claimFolder: string
  fileName: string
  filePath: string
  fileSizeBytes: number
  mimeType: string
}

export interface TransferResult {
  objectKey: string
  bucketName: string
  storageProvider: string
  fileSizeBytes: number
}

export interface KafkaEventPayload {
  eventId: string
  timestamp: string
  orgId: string
  sourceChannel: string
  payload: {
    fileName: string
    storageProvider: string
    bucketName: string
    objectKey: string
    fileSizeBytes: number
    mimeType: string
  }
}

/** Reader driver: lists and reads from TPA source */
export interface ReaderDriver {
  listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]>
  readFile(credentials: Record<string, any>, filePath: string): Promise<Readable>
}

/** Writer driver: streams to Sentinel landing bucket */
export interface WriterDriver {
  write(stream: Readable, input: WriteInput, objectKey: string): Promise<TransferResult>
}
