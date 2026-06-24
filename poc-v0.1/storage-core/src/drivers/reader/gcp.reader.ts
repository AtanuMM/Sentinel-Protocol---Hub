import type { Readable } from 'stream'
import type { FileDescriptor, ReaderDriver } from '../../types'

export const gcpReaderDriver: ReaderDriver = {
  async listNewFiles(_orgId: string, _credentials: Record<string, any>): Promise<FileDescriptor[]> {
    throw new Error('S3/GCP/Azure reader not yet implemented')
  },

  async readFile(_credentials: Record<string, any>, _filePath: string): Promise<Readable> {
    throw new Error('S3/GCP/Azure reader not yet implemented')
  },
}
