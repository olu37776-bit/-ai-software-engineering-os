export const QUALIFICATION_MARKER = "ESM 中文/space path qualification";

export function normalizeQualificationLabel(value: string): string {
  return value.normalize("NFC").trim();
}
