import axios from "axios";
import { config } from "../config";

const buildHeaders = (vaultToken: string) => ({
  "Content-Type": "application/json",
  "x-vault-token": vaultToken,
});

export const vaultClient = {
  async storeSecret(payload: Record<string, unknown>, vaultToken: string): Promise<string> {
    const response = await axios.post(
      `${config.vaultUrl}/secrets`,
      { data: payload },
      { headers: buildHeaders(vaultToken) },
    );
    return response.data.secretId as string;
  },

  async getSecret(secretId: string, vaultToken: string): Promise<Record<string, unknown>> {
    const response = await axios.get(`${config.vaultUrl}/secrets/${secretId}`, {
      headers: buildHeaders(vaultToken),
    });
    return response.data.data as Record<string, unknown>;
  },

  async deleteSecret(secretId: string, vaultToken: string): Promise<void> {
    await axios.delete(`${config.vaultUrl}/secrets/${secretId}`, {
      headers: buildHeaders(vaultToken),
    });
  },
};
