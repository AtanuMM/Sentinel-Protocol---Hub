import prisma from '../lib/prisma.js';
import { CryptoService, EncryptedData } from '@/services/CryptoService';

const cryptoProcessor = new CryptoService();

export class SecretService {
  /**
   * Encrypts and saves a secret for a specific service
   */
  static async storeSecret(serviceId: string, keyName: string, plainValue: string) {
    const encrypted: EncryptedData = cryptoProcessor.encrypt(plainValue);

    return await prisma.secret.upsert({
      where: {
        serviceId_keyName: { serviceId, keyName },
      },
      update: {
        ...encrypted,
      },
      create: {
        serviceId,
        keyName,
        ...encrypted,
      },
    });
  }

  /**
   * Fetches and decrypts a secret
   */
  static async getSecret(serviceId: string, keyName: string) {
    const secret = await prisma.secret.findUnique({
      where: {
        serviceId_keyName: { serviceId, keyName },
      },
    });

    if (!secret) return null;

    return cryptoProcessor.decrypt({
      encryptedBlob: secret.encryptedBlob,
      authTag: secret.authTag,
      iv: secret.iv,
      wrappedDek: secret.wrappedDek,
      dekIv: secret.dekIv,
      dekTag: secret.dekTag,
    });
  }
}