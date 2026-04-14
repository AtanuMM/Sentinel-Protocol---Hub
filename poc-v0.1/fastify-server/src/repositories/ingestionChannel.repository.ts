import { IngestionChannelModel } from "../infra/db";

interface UpsertChannelInput {
  organisation_id: string;
  source_prefix: string;
  source_bucket: string;
  external_username: string;
  external_password_encrypted: string;
  region: string;
  is_onboarded: boolean;
}

export class IngestionChannelRepository {
  async upsert(input: UpsertChannelInput): Promise<void> {
    await IngestionChannelModel.upsert(input as any);
  }

  async findByOrgId(orgId: string) {
    return IngestionChannelModel.findByPk(orgId);
  }

  async findRecent(limit = 5) {
    return IngestionChannelModel.findAll({
      limit,
      order: [["updatedAt", "DESC"]],
    });
  }
}
