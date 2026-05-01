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
  /**
   * Fetches all secrets for a service and decrypts them
   */
  static async getAllSecrets(serviceId: string) {
    const secrets = await prisma.secret.findMany({
      where: { serviceId },
    });

    if (secrets.length === 0) return [];

    // Decrypt each secret in the list
    return secrets.map((secret) => {
      try {
        const decryptedValue = cryptoProcessor.decrypt({
          encryptedBlob: secret.encryptedBlob,
          authTag: secret.authTag,
          iv: secret.iv,
          wrappedDek: secret.wrappedDek,
          dekIv: secret.dekIv,
          dekTag: secret.dekTag,
        });

        // Try to parse JSON if applicable, else return string
        let parsedValue;
        try {
          parsedValue = JSON.parse(decryptedValue);
        } catch {
          parsedValue = decryptedValue;
        }

        return {
          keyName: secret.keyName,
          value: parsedValue,
          updatedAt: secret.updatedAt
        };
      } catch (error) {
        console.error(`Failed to decrypt secret: ${secret.keyName}`, error);
        return { keyName: secret.keyName, value: "ERROR_DECRYPTION_FAILED" };
      }
    });
  }
}
