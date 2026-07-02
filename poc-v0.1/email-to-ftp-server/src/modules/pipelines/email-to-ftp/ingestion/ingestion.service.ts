import { createHash, randomUUID } from "crypto";
import { Readable } from "stream";
import { config } from "../../../../config";
import { AppError } from "../../../../errors/appError";
import { minioClient, producer, redisClient } from "../../../../infra/clients";
import { EmailClaimArtifactRepository } from "../../../../repositories/emailClaimArtifact.repository";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { IngestionTraceEvent } from "../../../../types/ingestionEvent";
import { buildDedupKey } from "../../../../utils/dedupKey";
import { deleteRedisKeysByPattern } from "../../../../utils/redisScanDel";
import { findMatchedClaimKeywords, stripHtmlForScan } from "../integration/claim-text";
import {
  sanitizeAttachmentFilename,
  sanitizeSubjectForKey,
  sanitizeUidValidityForSegment,
} from "../integration/email-subject-key";
import {
  buildEmailTranscriptPdfBuffer,
  formatEnvelopeFromForTranscript,
  type TranscriptAddressLike,
} from "../integration/email-transcript-pdf";
import { createImapFlowClient } from "../integration/imap-flow-factory";
import { getImapPollMailboxPath } from "../integration/imap-mailbox-cursor";
import { splitPollParts } from "../integration/imap-claim-parts";
import { resolveRegisteredImapCredentials } from "../integration/vault-imap-resolve";

const EMAIL_TRANSCRIPT_OBJECT = "email-transcript.pdf";
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
  /** IMAP UID cursor before this poll (`Ingestion_Channel_Master.last_processed_uid`). */
  lastProcessedUidBefore: number;
  /** IMAP UID cursor after this poll (unchanged if nothing scanned). */
  lastProcessedUidAfter: number;
}

export class EmailIngestionService {
  constructor(
    private readonly artifactRepository: EmailClaimArtifactRepository,
    private readonly channelRepository: IngestionChannelRepository,
  ) {}

  async pollClaimEmails(input: PollClaimsInput, vaultToken: string): Promise<PollClaimsResult> {
    const emailKey = input.email.trim();
    const row = await this.channelRepository.findByEmailAndServiceId(emailKey, input.serviceId);
    if (!row) {
      throw new AppError(404, "Email channel not found in master database.", "EMAIL_SOURCE_NOT_FOUND");
    }
    if (row.kms_service_id !== input.serviceId) {
      throw new AppError(403, "serviceId does not match the registered email channel.", "SERVICE_ID_MISMATCH");
    }
    if (!row.is_onboarded) {
      throw new AppError(403, "Email channel is not onboarded.", "EMAIL_SOURCE_INACTIVE");
    }

    const orgId = row.organisation_id;
    const insuranceCompanyCode = row.insurance_company_code;
    const region = row.region ?? config.defaultEmailZone;

    if (input.resetCursor === true) {
      await this.channelRepository.updateEmailCursor(orgId, insuranceCompanyCode, {
        last_processed_uid: 0,
        imap_uidvalidity: null,
      });
      await row.reload();
      const dedupFlushPattern = `file:dedup:email:${orgId}:imap:${emailKey}:*`;
      await deleteRedisKeysByPattern(redisClient, dedupFlushPattern);
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
        const storedUidValidity = row.imap_uidvalidity;
        const uidValidityChanged =
          storedUidValidity !== null &&
          uidValidity !== null &&
          storedUidValidity !== uidValidity;
        const lastUid = uidValidityChanged ? 0 : (row.last_processed_uid ?? 0);
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

        const today = new Date().toISOString().split("T")[0];

        let maxSeenUid = lastUid;
        try {
        for (const uid of newUids) {
          maxSeenUid = uid;
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

          const rfcMessageId = msg.envelope?.messageId ?? null;
          const sanitizedSubject = sanitizeSubjectForKey(subject);
          const bodyPlainForTranscript = [textBody, stripHtmlForScan(htmlRaw)]
            .filter(Boolean)
            .join("\n")
            .slice(0, bodyStoreMax);

          const downloaded = await client.downloadMany(
            String(uid),
            pdfParts.map((p) => p.part),
            { uid: true },
          );

          const vvSeg = sanitizeUidValidityForSegment(uidValidity);
          const claimFolder = `${sanitizedSubject}__uid-${uid}__vv-${vvSeg}`;
          const folderPrefix = `${orgId}/${insuranceCompanyCode}/${today}/email/${claimFolder}/`;
          const transcriptKey = `${folderPrefix}${EMAIL_TRANSCRIPT_OBJECT}`;

          const internalDateRaw = (msg as { internalDate?: Date | string | null }).internalDate;
          const dateLine =
            internalDateRaw != null
              ? new Date(internalDateRaw).toISOString()
              : msg.envelope?.date != null
                ? String(msg.envelope.date)
                : null;

          const transcriptBuf = await buildEmailTranscriptPdfBuffer({
            subject,
            bodyPlain: bodyPlainForTranscript,
            fromLine: formatEnvelopeFromForTranscript(
              msg.envelope?.from as TranscriptAddressLike[] | undefined,
            ),
            dateLine,
            messageIdLine: rfcMessageId,
          });

          await minioClient.putObject(
            config.landingBucket,
            transcriptKey,
            Readable.from(transcriptBuf),
            transcriptBuf.length,
            { "Content-Type": "application/pdf" },
          );

          /** Same bytes can appear under multiple MIME leaves (e.g. inline + attachment); Redis dedup uses filename so keys differ. */
          const uploadedPdfShaInThisUid = new Set<string>();

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

            if (uploadedPdfShaInThisUid.has(pdfSha256)) {
              await redisClient.del(dedupKey);
              continue;
            }

            const traceId = randomUUID();
            const safeAttachmentName = sanitizeAttachmentFilename(pdf.filename);
            const landingPath = `${folderPrefix}${traceId}__${safeAttachmentName}`;
            const artifactId = randomUUID();
            const originalPath = `email://${emailKey}/imap/${mailboxPath}/uid/${uid}/${pdf.filename}`;

            let attachmentUploaded = false;
            try {
              await minioClient.putObject(
                config.landingBucket,
                landingPath,
                Readable.from(buf),
                buf.length,
                { "Content-Type": "application/pdf" },
              );
              attachmentUploaded = true;
              uploadedPdfShaInThisUid.add(pdfSha256);

              await this.artifactRepository.create({
                id: artifactId,
                organisation_id: orgId,
                zone_id: insuranceCompanyCode,
                email_address: emailKey,
                imap_uid: uid,
                imap_mailbox: mailboxPath,
                imap_uidvalidity: uidValidity,
                rfc_message_id: rfcMessageId,
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
                zoneId: region,
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
              if (!attachmentUploaded) {
                await redisClient.del(dedupKey);
              }
              throw err;
            }
          }
        }
        } finally {
          if (maxSeenUid > lastUid || uidValidityChanged) {
            const cursorUpdates: { last_processed_uid?: number; imap_uidvalidity?: string } = {};
            if (uidValidityChanged && uidValidity !== null) {
              cursorUpdates.imap_uidvalidity = uidValidity;
              if (maxSeenUid > 0) cursorUpdates.last_processed_uid = maxSeenUid;
            } else if (maxSeenUid > lastUid) {
              cursorUpdates.last_processed_uid = maxSeenUid;
            }
            if (uidValidity !== null && row.imap_uidvalidity === null && !uidValidityChanged) {
              cursorUpdates.imap_uidvalidity = uidValidity;
            }
            if (Object.keys(cursorUpdates).length > 0) {
              await this.channelRepository.updateEmailCursor(orgId, insuranceCompanyCode, cursorUpdates);
            }
          }
        }

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
          lastProcessedUidAfter: maxSeenUid,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}
