import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TextDecoder } from "node:util";

export type MigrationManifest = Readonly<{
  schemaVersion: string;
  databaseSchemaVersion: number;
  migrations: readonly Readonly<{
    version: number;
    name: string;
    path: string;
    sha256: string;
  }>[];
}>;

export type MigrationAssets = Readonly<{
  manifest: MigrationManifest;
  sql: string;
  migration: MigrationManifest["migrations"][number];
}>;

function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export async function readMigrationAssets(
  packageRootUrl: URL = new URL("../", import.meta.url),
): Promise<MigrationAssets> {
  const manifestUrl = new URL("migrations/manifest.json", packageRootUrl);
  const sqlUrl = new URL("migrations/001-initial.sql", packageRootUrl);
  const [manifestBytes, sqlBytes] = await Promise.all([readFile(manifestUrl), readFile(sqlUrl)]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(manifestBytes, "Migration manifest")) as unknown;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("not valid UTF-8")) throw error;
    throw new Error("Migration manifest is not valid JSON", { cause: error });
  }

  const manifestRecord = asRecord(parsed);
  const migrations = manifestRecord?.["migrations"];
  const migrationRecord = Array.isArray(migrations) ? asRecord(migrations[0]) : undefined;
  const version = migrationRecord?.["version"];
  const name = migrationRecord?.["name"];
  const path = migrationRecord?.["path"];
  const expectedSha256 = migrationRecord?.["sha256"];

  if (
    manifestRecord?.["schemaVersion"] !== "1.0.0" ||
    manifestRecord["databaseSchemaVersion"] !== 1 ||
    !Array.isArray(migrations) ||
    migrations.length !== 1 ||
    version !== 1 ||
    typeof name !== "string" ||
    name.length === 0 ||
    path !== "migrations/001-initial.sql" ||
    typeof expectedSha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(expectedSha256) ||
    rawSha256(sqlBytes) !== expectedSha256
  ) {
    throw new Error("Migration manifest or checksum mismatch");
  }

  const migration = {
    version,
    name,
    path,
    sha256: expectedSha256,
  };
  return {
    manifest: {
      schemaVersion: "1.0.0",
      databaseSchemaVersion: 1,
      migrations: [migration],
    },
    sql: decodeUtf8(sqlBytes, "Migration SQL"),
    migration,
  };
}
