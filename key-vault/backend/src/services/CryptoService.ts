import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedData {
  encryptedBlob: string;
  authTag: string;
  iv: string;
  wrappedDek: string;
  dekIv: string;
  dekTag: string;
}

export class CryptoService {
  private readonly masterKey: Buffer;

  constructor() {
    const key = process.env.MASTER_ROOT_KEY;
    if (!key || key.length !== 64) {
      throw new Error('MASTER_ROOT_KEY must be a 64-character hex string.');
    }
    this.masterKey = Buffer.from(key, 'hex');
  }

  public encrypt(plainText: string): EncryptedData {
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
    let encryptedBlob = cipher.update(plainText, 'utf8', 'hex');
    encryptedBlob += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const dekIv = crypto.randomBytes(IV_LENGTH);
    const dekCipher = crypto.createCipheriv(ALGORITHM, this.masterKey, dekIv);
    let wrappedDek = dekCipher.update(dek, undefined, 'hex');
    wrappedDek += dekCipher.final('hex');
    const dekTag = dekCipher.getAuthTag().toString('hex');

    return {
      encryptedBlob,
      authTag,
      iv: iv.toString('hex'),
      wrappedDek,
      dekIv: dekIv.toString('hex'),
      dekTag: dekTag,
    };
  }

  public decrypt(data: EncryptedData): string {
    const dekDecipher = crypto.createDecipheriv(
      ALGORITHM, 
      this.masterKey, 
      Buffer.from(data.dekIv, 'hex')
    );
    dekDecipher.setAuthTag(Buffer.from(data.dekTag, 'hex'));
    let dek = dekDecipher.update(Buffer.from(data.wrappedDek, 'hex'));
    dek = Buffer.concat([dek, dekDecipher.final()]);

    const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    let decrypted = decipher.update(data.encryptedBlob, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}