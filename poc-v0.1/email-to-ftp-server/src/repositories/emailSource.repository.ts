import { EmailSourceModel } from "../infra/db";

export interface EmailSourceListRow {
  email_address: string;
  organisation_id: string;
  vault_service_id: string;
  zone_id: string;
  last_processed_uid: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailSourceRepository {
  async findAllByOrganisationId(orgId: string): Promise<EmailSourceListRow[]> {
    const rows = await EmailSourceModel.findAll({
      where: { organisation_id: orgId },
      attributes: [
        "email_address",
        "organisation_id",
        "vault_service_id",
        "zone_id",
        "last_processed_uid",
        "is_active",
        "createdAt",
        "updatedAt",
      ],
      order: [["email_address", "ASC"]],
    });
    return rows.map((r) => ({
      email_address: r.email_address,
      organisation_id: r.organisation_id,
      vault_service_id: r.vault_service_id,
      zone_id: r.zone_id,
      last_processed_uid: r.last_processed_uid,
      is_active: r.is_active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
