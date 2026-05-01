import { EmailClaimArtifactModel } from "../infra/db";

export interface CreateEmailClaimArtifactInput {
  id: string;
  organisation_id: string;
  zone_id: string;
  email_address: string;
  imap_uid: number;
  imap_mailbox: string;
  imap_uidvalidity: string | null;
  rfc_message_id: string | null;
  email_subject_text: string;
  email_body_text: string;
  matched_keywords: string[];
  trace_id: string;
  landing_path: string;
  attachment_filename: string;
  pdf_sha256: string;
}

export class EmailClaimArtifactRepository {
  async create(input: CreateEmailClaimArtifactInput): Promise<void> {
    await EmailClaimArtifactModel.create(input as never);
  }
}
