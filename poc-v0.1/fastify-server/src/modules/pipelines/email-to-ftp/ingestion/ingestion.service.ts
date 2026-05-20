import { createHash, randomUUID } from "crypto";
import { Readable } from "stream";
import { config } from "../../../../config";
import { AppError } from "../../../../errors/appError";
import { EmailSourceModel } from "../../../../infra/db";
import { minioClient, producer, redisClient } from "../../../../infra/clients";
import { EmailClaimArtifactRepository } from "../../../../repositories/emailClaimArtifact.repository";
import { IngestionTraceEvent } from "../../../../types/ingestionEvent";
import { buildDedupKey } from "../../../../utils/dedupKey";
import { findMatchedClaimKeywords, stripHtmlForScan } from "../integration/claim-text";
import { createImapFlowClient } from "../integration/imap-flow-factory";
import { getImapPollMailboxPath } from "../integration/imap-mailbox-cursor";
import { splitPollParts } from "../integration/imap-claim-parts";
import { resolveRegisteredImapCredentials } from "../integration/vault-imap-resolve";

/** Safety cap for MIME-encoded or unusually long envelope subjects stored on artifacts. */
const EMAIL_SUBJECT_STORE_MAX_CHARS = 4096;

const withRetries = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  throw lastErr;
};

export interface PollClaimsInput {
  email: string;
  serviceId: string;
  limit?: number;
  /** When true, resets IMAP UID cursor to 0 for this source before polling (reprocess existing messages). */
  resetCursor?: boolean;
}

export interface PollClaimsIngestedItem {
  traceId: string;
  landingPath: string;
  pdfSha256: string;
  attachmentFilename: string;
}

export interface PollClaimsResult {
  email: string;
  scannedUids: number;
  claimKeywordMatches: number;
  pdfsIngested: number;
  ingested: PollClaimsIngestedItem[];
  message: string;
  /** IMAP UID cursor before this poll (`Email_Source_Master.last_processed_uid`). */
  lastProcessedUidBefore: number;
  /** IMAP UID cursor after this poll (unchanged if nothing scanned). */
  lastProcessedUidAfter: number;
}

export class EmailIngestionService {
  constructor(private readonly artifactRepository: EmailClaimArtifactRepository) {}

  async pollClaimEmails(input: PollClaimsInput, vaultToken: string): Promise<PollClaimsResult> {
    const emailKey = input.email.trim();
    let row = await EmailSourceModel.findByPk(emailKey);
    if (!row) {
      throw new AppError(404, "Email source not found in master database.", "EMAIL_SOURCE_NOT_FOUND");
    }
    if (row.vault_service_id !== input.serviceId) {
      throw new AppError(403, "serviceId does not match the registered email source.", "SERVICE_ID_MISMATCH");
    }
    if (!row.is_active) {
      throw new AppError(403, "Email source is not active.", "EMAIL_SOURCE_INACTIVE");
    }

    if (input.resetCursor === true) {
      await EmailSourceModel.update({ last_processed_uid: 0 }, { where: { email_address: emailKey } });
      await row.reload();
    }

    const creds = await resolveRegisteredImapCredentials(emailKey, input.serviceId, vaultToken);

    const cap = Math.min(
      Math.max(Number(input.limit ?? config.emailPollMaxMessages), 1),
      config.emailPollMaxMessages,
    );
    const keywords = config.emailClaimKeywords;
    const bodyStoreMax = config.emailClaimBodyStoreMaxChars;
    const mailboxPath = getImapPollMailboxPath();

    const client = createImapFlowClient(creds);
    await client.connect();

    const ingested: PollClaimsIngestedItem[] = [];
    let scannedUids = 0;
    let claimKeywordMatches = 0;

    try {
      const lock = await client.getMailboxLock(mailboxPath, { readOnly: true });
      try {
        const uidValidity =
          client.mailbox && typeof client.mailbox !== "boolean"
            ? String(client.mailbox.uidValidity)
            : null;

        const searchResult = await client.search({ all: true }, { uid: true });
        const allUids = Array.isArray(searchResult) ? searchResult : [];
        const lastUid = row.last_processed_uid;
        const newUids = allUids
          .filter((u) => u > lastUid)
          .sort((a, b) => a - b)
          .slice(0, cap);

        if (newUids.length === 0) {
          return {
            email: emailKey,
            scannedUids: 0,
            claimKeywordMatches: 0,
            pdfsIngested: 0,
            ingested: [],
            message: `No new messages (UID > ${lastUid}). If you need to reprocess mail already in the mailbox, call again with resetCursor: true.`,
            lastProcessedUidBefore: lastUid,
            lastProcessedUidAfter: lastUid,
          };
        }

        const orgId = row.organisation_id;
        const zoneId = row.zone_id;
        const today = new Date().toISOString().split("T")[0];

        for (const uid of newUids) {
          scannedUids += 1;
          const msg = await client.fetchOne(
            String(uid),
            { envelope: true, bodyStructure: true, internalDate: true, uid: true },
            { uid: true },
          );

          if (!msg || !msg.bodyStructure) {
            continue;
          }

          const { textPart, htmlPart, pdfParts } = splitPollParts(msg.bodyStructure);
          const textPartsOnly = [textPart, htmlPart].filter((x): x is string => Boolean(x));
          let textBody = "";
          let htmlRaw = "";
          if (textPartsOnly.length > 0) {
            const partial = await client.downloadMany(String(uid), textPartsOnly, { uid: true });
            if (textPart) {
              const b = partial[textPart]?.content;
              if (b) textBody = b.toString("utf8");
            }
            if (htmlPart) {
              const b = partial[htmlPart]?.content;
              if (b) htmlRaw = b.toString("utf8");
            }
          }

          const subject = msg.envelope?.subject ?? "";
          const combinedForMatch = [subject, textBody, stripHtmlForScan(htmlRaw)].filter(Boolean).join("\n");
          const matchedKw = findMatchedClaimKeywords(combinedForMatch, keywords);
          if (matchedKw.length === 0) {
            continue;
          }
          claimKeywordMatches += 1;

          if (pdfParts.length === 0) {
            continue;
          }

          const storedSubjectText = subject.slice(0, EMAIL_SUBJECT_STORE_MAX_CHARS);
          const bodyOnlyCombined = [textBody, stripHtmlForScan(htmlRaw)].filter(Boolean).join("\n");
          const storedBodyText = bodyOnlyCombined.slice(0, bodyStoreMax);
          const rfcMessageId = msg.envelope?.messageId ?? null;

          const downloaded = await client.downloadMany(
            String(uid),
            pdfParts.map((p) => p.part),
            { uid: true },
          );

          for (const pdf of pdfParts) {
            const buf = downloaded[pdf.part]?.content;
            if (!buf || buf.length === 0) {
              continue;
            }

            const pdfSha256 = createHash("sha256").update(buf).digest("hex");
            const logicalName = `uid/${uid}/${pdf.filename}`;
            const dedupKey = buildDedupKey("email", orgId, `imap:${emailKey}`, logicalName, pdfSha256);
            const dedupInserted = await redisClient.set(
              dedupKey,
              "processing",
              "EX",
              config.dedupTtlSec,
              "NX",
            );
            if (dedupInserted !== "OK") {
              continue;
            }

            const traceId = randomUUID();
            const landingPath = `${orgId}/${zoneId}/${today}/raw/${traceId}.pdf`;
            const artifactId = randomUUID();
            const originalPath = `email://${emailKey}/imap/${mailboxPath}/uid/${uid}/${pdf.filename}`;

            try {
              await minioClient.putObject(
                config.landingBucket,
                landingPath,
                Readable.from(buf),
                buf.length,
                { "Content-Type": "application/pdf" },
              );

              await this.artifactRepository.create({
                id: artifactId,
                organisation_id: orgId,
                zone_id: zoneId,
                email_address: emailKey,
                imap_uid: uid,
                imap_mailbox: mailboxPath,
                imap_uidvalidity: uidValidity,
                rfc_message_id: rfcMessageId,
                email_subject_text: storedSubjectText,
                email_body_text: storedBodyText,
                matched_keywords: matchedKw,
                trace_id: traceId,
                landing_path: landingPath,
                attachment_filename: pdf.filename,
                pdf_sha256: pdfSha256,
              });

              const traceEvent: IngestionTraceEvent = {
                schemaVersion: 1,
                traceId,
                orgId,
                zoneId,
                landingPath,
                originalPath,
                timestamp: new Date().toISOString(),
                metadata: { source: "email" },
              };

              await withRetries(async () => {
                await producer.send({
                  topic: config.ingestionTopic,
                  messages: [{ key: orgId, value: JSON.stringify(traceEvent) }],
                });
              });

              await redisClient.set(dedupKey, "processed", "EX", config.dedupTtlSec);

              ingested.push({
                traceId,
                landingPath,
                pdfSha256,
                attachmentFilename: pdf.filename,
              });
            } catch (err) {
              await redisClient.del(dedupKey);
              throw err;
            }
          }
        }

        const maxSeen = Math.max(...newUids);
        await EmailSourceModel.update({ last_processed_uid: maxSeen }, { where: { email_address: emailKey } });

        return {
          email: emailKey,
          scannedUids,
          claimKeywordMatches,
          pdfsIngested: ingested.length,
          ingested,
          message:
            ingested.length > 0
              ? `Ingested ${ingested.length} PDF(s); scanned ${scannedUids} UID(s).`
              : `Scanned ${scannedUids} UID(s); no new claim PDFs ingested.`,
          lastProcessedUidBefore: lastUid,
          lastProcessedUidAfter: maxSeen,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}
