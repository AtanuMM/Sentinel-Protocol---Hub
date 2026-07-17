import { CreationAttributes } from "sequelize";
import { IngestionChannelModel } from "../infra/db";
import type { ConfigurationStrategy, IngestionChannel } from "../models/ingestionChannel.model";

interface UpsertChannelInput {
  organisation_id: string;
  insurance_company_code: string;
  channel_type: string;
  configuration_strategy: ConfigurationStrategy;
  is_onboarded: boolean;
  kms_service_id: string;
  vault_token_encrypted: string;
  source_prefix?: string;
  source_bucket?: string;
  external_username?: string;
  external_password_encrypted?: string;
  region?: string;
  email_address?: string;
  last_processed_uid?: number;
  imap_uidvalidity?: string;
}

export interface EmailChannelListRow {
  email_address: string;
  organisation_id: string;
  insurance_company_code: string;
  kms_service_id: string;
  last_processed_uid: number;
  is_onboarded: boolean;
  region: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EmailCursorUpdates {
  last_processed_uid?: number;
  imap_uidvalidity?: string | null;
}

export class IngestionChannelRepository {
  async upsert(input: UpsertChannelInput): Promise<void> {
    await IngestionChannelModel.upsert(input as unknown as CreationAttributes<IngestionChannel>);
  }

  async findByOrgIdInsurerAndChannel(
    orgId: string,
    insuranceCompanyCode: string,
    channelType: string,
  ): Promise<IngestionChannel | null> {
    return IngestionChannelModel.findOne({
      where: {
        organisation_id: orgId,
        insurance_company_code: insuranceCompanyCode,
        channel_type: channelType,
      },
    });
  }

  async findByEmailAndServiceId(
    email: string,
    serviceId: string,
  ): Promise<IngestionChannel | null> {
    return IngestionChannelModel.findOne({
      where: {
        email_address: email,
        kms_service_id: serviceId,
        channel_type: "EMAIL",
      },
    });
  }

  async findAllEmailChannelsByOrgId(orgId: string): Promise<EmailChannelListRow[]> {
    const rows = await IngestionChannelModel.findAll({
      where: { organisation_id: orgId, channel_type: "EMAIL" },
      attributes: [
        "email_address",
        "organisation_id",
        "insurance_company_code",
        "kms_service_id",
        "last_processed_uid",
        "is_onboarded",
        "region",
        "createdAt",
        "updatedAt",
      ],
      order: [["email_address", "ASC"]],
    });
    return rows
      .filter((r) => Boolean(r.email_address?.trim()))
      .map((r) => ({
        email_address: r.email_address!,
        organisation_id: r.organisation_id,
        insurance_company_code: r.insurance_company_code,
        kms_service_id: r.kms_service_id ?? "",
        last_processed_uid: r.last_processed_uid ?? 0,
        is_onboarded: r.is_onboarded,
        region: r.region,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
  }

  async findByOrgIdAndInsurer(orgId: string, insuranceCompanyCode: string) {
    return IngestionChannelModel.findOne({
      where: {
        organisation_id: orgId,
        insurance_company_code: insuranceCompanyCode,
      },
    });
  }

  async updateEncryptedPassword(
    orgId: string,
    insuranceCompanyCode: string,
    encryptedPassword: string,
  ): Promise<void> {
    await IngestionChannelModel.update(
      { external_password_encrypted: encryptedPassword },
      { where: { organisation_id: orgId, insurance_company_code: insuranceCompanyCode } },
    );
  }

  async findRecent(limit = 5) {
    return IngestionChannelModel.findAll({
      limit,
      attributes: [
        "organisation_id",
        "insurance_company_code",
        "configuration_strategy",
        "source_prefix",
        "source_bucket",
        "external_username",
        "region",
        "is_onboarded",
        "createdAt",
        "updatedAt",
      ],
      order: [["updatedAt", "DESC"]],
    });
  }

  /** Channels eligible for KMS-backed source polling (requires populated KMS + vault token columns). */
  async findActiveOnboardedForPolling() {
    const rows = await IngestionChannelModel.findAll({ where: { is_onboarded: true } });
    return rows.filter(
      (c) => Boolean(c.kms_service_id?.trim()) && Boolean(c.vault_token_encrypted?.trim()),
    );
  }

  async updateEmailCursor(
    orgId: string,
    insuranceCompanyCode: string,
    updates: EmailCursorUpdates,
  ): Promise<void> {
    await IngestionChannelModel.update(updates, {
      where: {
        organisation_id: orgId,
        insurance_company_code: insuranceCompanyCode,
        channel_type: "EMAIL",
      },
    });
  }

  async findActiveEmailChannelsForPolling() {
    const rows = await IngestionChannelModel.findAll({
      where: { channel_type: "EMAIL", is_onboarded: true },
    });
    return rows.filter(
      (c) => Boolean(c.kms_service_id?.trim()) && Boolean(c.vault_token_encrypted?.trim()),
    );
  }
}
