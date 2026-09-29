export function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}
