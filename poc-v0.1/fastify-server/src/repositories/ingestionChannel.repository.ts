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

  async updateEncryptedPassword(orgId: string, encryptedPassword: string): Promise<void> {
    await IngestionChannelModel.update(
      { external_password_encrypted: encryptedPassword },
      { where: { organisation_id: orgId } }
    );
  }

  async findRecent(limit = 5) {
    return IngestionChannelModel.findAll({
      limit,
      attributes: ["organisation_id", "source_prefix", "source_bucket", "external_username", "region", "is_onboarded", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
    });
  }
}
