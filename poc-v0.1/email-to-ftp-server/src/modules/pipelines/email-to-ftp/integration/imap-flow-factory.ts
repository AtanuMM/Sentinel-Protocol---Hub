import { ImapFlow } from "imapflow";

export interface ImapAuthConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Shared TLS/auth settings for GreenMail/local (self-signed) vs production.
 */
export function createImapFlowClient(config: ImapAuthConfig): ImapFlow {
  const allowInsecureTls =
    process.env.ALLOW_INSECURE_IMAP_TLS === "true" || process.env.NODE_ENV !== "production";

  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    tls: {
      rejectUnauthorized: !allowInsecureTls,
    },
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
  });
}
