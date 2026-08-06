import type { Readable } from 'stream'
import type { GcpWriterConfig, TransferResult, WriteInput, WriterDriver } from '../../types'

export const gcpWriterDriver: WriterDriver = {
  async write(
    _stream: Readable,
    _input: WriteInput,
    _objectKey: string,
    _storageConfig: GcpWriterConfig,
  ): Promise<TransferResult> {
    throw new Error('GCP writer not yet implemented')
  },
}
