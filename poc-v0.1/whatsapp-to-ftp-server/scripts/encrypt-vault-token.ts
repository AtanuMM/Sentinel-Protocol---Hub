/**
 * Encrypt a key-vault API token for whatsapp_channels.vault_token_encrypted.
 * Usage: npx tsx scripts/encrypt-vault-token.ts sv_live_your_token_here
 */
import dotenv from "dotenv";
import { encryptText } from "../src/utils/crypto";

dotenv.config();

const token = process.argv[2];
if (!token || !token.startsWith("sv_live_")) {
  console.error("Usage: npx tsx scripts/encrypt-vault-token.ts sv_live_<your_token>");
  process.exit(1);
}

console.log(encryptText(token));
