import { ImapFlow } from "imapflow";

export interface ImapTestConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export type ImapTestResult = { success: true } | { success: false; error: string };

/**
 * Tests the IMAP connection using raw credentials.
 * Used during provisioning to verify the TPA-supplied email and password
 * before persisting any state. Returns a tagged union so the caller can
 * decide how to log/format the failure.
 */
export async function testImapConnection(config: ImapTestConfig): Promise<ImapTestResult> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message.includes("AUTHENTICATIONFAILED")
        ? "Invalid email or password."
        : "Could not connect to the mail server.",
    };
  }
}
