import type { MessageStructureObject } from "imapflow";
import { createImapFlowClient } from "./imap-flow-factory";
import type { ResolvedImapCredentials } from "./vault-imap-resolve";

/** Max UTF-8 characters returned per text/html body field (POC cap). */
const DEFAULT_BODY_PREVIEW_CHARS = 32768;

export interface InboxPreviewOptions {
  limit: number;
  maxAttachmentBytes: number;
  bodyPreviewMaxChars: number;
  mailboxPath: string;
}

export interface PreviewAttachmentPayload {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  encoding?: "base64";
  data?: string;
  omittedReason?: "too_large";
}

export interface PreviewMessagePayload {
  uid: number;
  subject: string | null;
  from: string | null;
  date: string | null;
  body: { text?: string; html?: string };
  attachments: PreviewAttachmentPayload[];
}

interface CollectedLeaf {
  part: string;
  mime: string;
  filename?: string;
  disposition?: string;
  size?: number;
}

function collectLeaves(node: MessageStructureObject | undefined, out: CollectedLeaf[]): void {
  if (!node) return;
  if (node.childNodes && node.childNodes.length > 0) {
    for (const c of node.childNodes) {
      collectLeaves(c, out);
    }
    return;
  }
  if (!node.part) return;
  const mime = node.type.toLowerCase();
  const filename =
    node.dispositionParameters?.filename || node.parameters?.name || node.parameters?.filename;
  out.push({
    part: node.part,
    mime,
    filename,
    disposition: node.disposition,
    size: node.size,
  });
}

function splitParts(struct: MessageStructureObject | undefined): {
  textPart?: string;
  htmlPart?: string;
  attachmentParts: { part: string; filename: string; mimeType: string; size?: number }[];
} {
  const leaves: CollectedLeaf[] = [];
  collectLeaves(struct, leaves);

  let textPart: string | undefined;
  let htmlPart: string | undefined;
  const attachmentParts: { part: string; filename: string; mimeType: string; size?: number }[] = [];

  for (const p of leaves) {
    if (p.mime === "text/plain" && !textPart) {
      textPart = p.part;
      continue;
    }
    if (p.mime === "text/html" && !htmlPart) {
      htmlPart = p.part;
      continue;
    }

    const disp = (p.disposition || "").toLowerCase();
    const isExplicitAttachment = disp === "attachment";
    const isNonTextWithName =
      Boolean(p.filename) && !p.mime.startsWith("text/") && p.mime !== "multipart/mixed";

    if (isExplicitAttachment || isNonTextWithName) {
      attachmentParts.push({
        part: p.part,
        filename: p.filename?.trim() || `attachment-${p.part}`,
        mimeType: p.mime,
        size: p.size,
      });
    }
  }

  return { textPart, htmlPart, attachmentParts };
}

function truncate(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  return `${str.slice(0, maxChars)}…`;
}

function formatFrom(envelope: { from?: { name?: string; address?: string }[] } | undefined): string | null {
  const from = envelope?.from;
  if (!from?.length) return null;
  return from
    .map((a) => {
      if (a.name && a.address) return `${a.name} <${a.address}>`;
      return a.address || a.name || "";
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Connects to IMAP, reads the latest messages (by UID), returns truncated bodies and capped attachment payloads.
 * Uses READ-ONLY mailbox lock (no flag changes from this flow).
 */
export async function fetchInboxPreview(
  creds: ResolvedImapCredentials,
  options: InboxPreviewOptions,
): Promise<PreviewMessagePayload[]> {
  const client = createImapFlowClient(creds);
  const bodyCap = options.bodyPreviewMaxChars ?? DEFAULT_BODY_PREVIEW_CHARS;

  await client.connect();

  try {
    const lock = await client.getMailboxLock(options.mailboxPath, { readOnly: true });
    try {
      const uidsResult = await client.search({ all: true }, { uid: true });
      const uids = Array.isArray(uidsResult) ? uidsResult : [];
      if (uids.length === 0) {
        return [];
      }

      const sorted = [...uids].sort((a, b) => a - b);
      const pickedUids = sorted.slice(-options.limit);
      const results: PreviewMessagePayload[] = [];

      for (const uid of pickedUids) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          bodyStructure: true,
          internalDate: true,
          uid: true,
        }, { uid: true });

        if (!msg || !msg.bodyStructure) {
          continue;
        }

        const env = msg.envelope;
        const subject = env?.subject ?? null;
        const from = formatFrom(env);
        const dateRaw = env?.date ?? msg.internalDate;
        const date =
          dateRaw instanceof Date
            ? dateRaw.toISOString()
            : typeof dateRaw === "string"
              ? dateRaw
              : null;

        const { textPart, htmlPart, attachmentParts } = splitParts(msg.bodyStructure);

        const partsToDownload = [
          textPart,
          htmlPart,
          ...attachmentParts.map((a) => a.part),
        ].filter((x): x is string => Boolean(x));

        type DownloadMap = Awaited<ReturnType<typeof client.downloadMany>>;
        let downloaded: DownloadMap = {};
        if (partsToDownload.length > 0) {
          downloaded = await client.downloadMany(String(uid), partsToDownload, { uid: true });
        }

        const body: { text?: string; html?: string } = {};
        if (textPart) {
          const buf = downloaded[textPart]?.content;
          if (buf && buf.length > 0) {
            body.text = truncate(buf.toString("utf8"), bodyCap);
          }
        }
        if (htmlPart) {
          const buf = downloaded[htmlPart]?.content;
          if (buf && buf.length > 0) {
            body.html = truncate(buf.toString("utf8"), bodyCap);
          }
        }

        const attachments: PreviewAttachmentPayload[] = [];
        for (const att of attachmentParts) {
          const buf = downloaded[att.part]?.content;
          const sizeBytes = buf?.length ?? att.size ?? 0;
          if (!buf || buf.length === 0) {
            attachments.push({
              filename: att.filename,
              mimeType: att.mimeType,
              sizeBytes,
              omittedReason: "too_large",
            });
            continue;
          }
          if (buf.length > options.maxAttachmentBytes) {
            attachments.push({
              filename: att.filename,
              mimeType: att.mimeType,
              sizeBytes: buf.length,
              omittedReason: "too_large",
            });
            continue;
          }
          attachments.push({
            filename: att.filename,
            mimeType: att.mimeType,
            sizeBytes: buf.length,
            encoding: "base64",
            data: buf.toString("base64"),
          });
        }

        results.push({
          uid: msg.uid,
          subject,
          from,
          date,
          body,
          attachments,
        });
      }

      return results;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
