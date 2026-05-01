import { createImapFlowClient } from "./imap-flow-factory";
import type { ImapAuthConfig } from "./imap-flow-factory";

export type ImapTestConfig = ImapAuthConfig;

export type ImapTestResult = { success: true } | { success: false; error: string };

function isImapAuthFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    authenticationFailed?: boolean;
    response?: string;
    responseText?: string;
    message?: string;
  };
  if (e.authenticationFailed === true) return true;
  const blob = `${e.message ?? ""} ${e.response ?? ""} ${e.responseText ?? ""}`;
  return /AUTHENTICATIONFAILED|LOGIN failed|Invalid login\/password/i.test(blob);
}

/**
 * Tests the IMAP connection using raw credentials.
 * Used during provisioning to verify the TPA-supplied email and password
 * before persisting any state. Returns a tagged union so the caller can
 * decide how to log/format the failure.
 */
export async function testImapConnection(config: ImapTestConfig): Promise<ImapTestResult> {
  const client = createImapFlowClient(config);

  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err) {
    if (isImapAuthFailure(err)) {
      return { success: false, error: "Invalid email or password." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Could not connect to the mail server.${message ? ` (${message})` : ""}`,
    };
  }
}
