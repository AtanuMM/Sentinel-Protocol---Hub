import type { Readable } from 'stream'
import type { AzureWriterConfig, TransferResult, WriteInput, WriterDriver } from '../../types'

export const azureWriterDriver: WriterDriver = {
  async write(
    _stream: Readable,
    _input: WriteInput,
    _objectKey: string,
    _storageConfig: AzureWriterConfig,
  ): Promise<TransferResult> {
    throw new Error('Azure writer not yet implemented')
  },
}
