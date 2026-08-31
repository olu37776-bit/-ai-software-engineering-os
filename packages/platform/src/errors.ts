const SECRET_VALUE = /\b(?:bearer\s+)?[A-Za-z0-9_-]{32,}\b/giu;
const WINDOWS_PATH = /\b[A-Za-z]:\\[^\s"']+/gu;
const POSIX_SECRET_PATH = /\/(?:[^\s/]+\/)*(?:secrets?|credentials?)(?:\/[^\s"']*)?/giu;

export function redactForPublicBoundary(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value);
  return text
    .replace(SECRET_VALUE, "[REDACTED]")
    .replace(WINDOWS_PATH, "[REDACTED_PATH]")
    .replace(POSIX_SECRET_PATH, "[REDACTED_PATH]")
    .slice(0, 512);
}

export class ControlApiError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string, options?: ErrorOptions) {
    // Public boundary errors deliberately never retain a raw filesystem/network cause.
    super(redactForPublicBoundary(message));
    void options;
    this.name = "ControlApiError";
    this.code = code;
  }
}
