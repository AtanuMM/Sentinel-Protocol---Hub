import axios from "axios";
import { config } from "../config";

const buildHeaders = (vaultToken: string) => ({
  "Content-Type": "application/json",
  "x-vault-token": vaultToken,
});

export interface VaultSecretListItem {
  keyName: string;
  value: Record<string, unknown> | string;
  updatedAt: string;
}

function axiosVaultErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as { error?: string; message?: string };
    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export const vaultClient = {
  /**
   * Key Vault expects POST /secrets with { serviceId, keyName, value } (see key-vault secretRoutes).
   */
  async storeSecret(
    params: {
      serviceId: string;
      keyName: string;
      value: Record<string, unknown> | string | number | boolean;
    },
    vaultToken: string,
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${config.vaultUrl}/secrets`,
        {
          serviceId: params.serviceId,
          keyName: params.keyName,
          value: params.value,
        },
        { headers: buildHeaders(vaultToken) },
      );
      const secretId = response.data?.secretId as string | undefined;
      if (!secretId) {
        throw new Error("Vault response missing secretId");
      }
      return secretId;
    } catch (err) {
      throw new Error(axiosVaultErrorMessage(err));
    }
  },

  /**
   * GET /secrets/:serviceId — bulk list decrypted secrets for a service.
   */
  async listSecretsForService(
    serviceId: string,
    vaultToken: string,
  ): Promise<VaultSecretListItem[]> {
    try {
      const servicePath = encodeURIComponent(serviceId);
      const url = config.kmsBaseUrl
        ? `${config.kmsBaseUrl.replace(/\/+$/, "")}/api/v1/secrets/${servicePath}`
        : `${config.vaultUrl}/secrets/${servicePath}`;
      const response = await axios.get(url, { headers: buildHeaders(vaultToken) });
      const data = response.data;
      if (!Array.isArray(data)) {
        throw new Error("Vault list response is not an array");
      }
      return data as VaultSecretListItem[];
    } catch (err) {
      throw new Error(axiosVaultErrorMessage(err));
    }
  },

  /**
   * GET /secrets/:serviceId/:keyName — returns decrypted value payload.
   */
  async getSecretForService(
    serviceId: string,
    keyName: string,
    vaultToken: string,
  ): Promise<Record<string, unknown>> {
    try {
      const url = `${config.vaultUrl}/secrets/${encodeURIComponent(serviceId)}/${encodeURIComponent(keyName)}`;
      const response = await axios.get(url, { headers: buildHeaders(vaultToken) });
      return response.data.value as Record<string, unknown>;
    } catch (err) {
      throw new Error(axiosVaultErrorMessage(err));
    }
  },

  /** @deprecated Prefer getSecretForService; path did not match Key Vault routes. */
  async getSecret(secretId: string, vaultToken: string): Promise<Record<string, unknown>> {
    const response = await axios.get(`${config.vaultUrl}/secrets/${secretId}`, {
      headers: buildHeaders(vaultToken),
    });
    return response.data.data as Record<string, unknown>;
  },

  async deleteSecret(secretId: string, vaultToken: string): Promise<void> {
    try {
      await axios.delete(`${config.vaultUrl}/secrets/by-id/${secretId}`, {
        headers: buildHeaders(vaultToken),
      });
    } catch (err) {
      throw new Error(axiosVaultErrorMessage(err));
    }
  },
};
