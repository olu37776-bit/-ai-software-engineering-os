import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ContractFoundationError } from "./foundation-error.js";

export type JsonObject = Readonly<Record<string, unknown>>;

export const defaultRepositoryRoot: string = fileURLToPath(new URL("../../../", import.meta.url));

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSafeRepositoryPath(path: string): boolean {
  return (
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes("\\") &&
    !path.split("/").includes("..") &&
    !/[?*[\]]/.test(path)
  );
}

export async function resolveAuthorityPath(
  repositoryRoot: string,
  authorityPath: string,
): Promise<string> {
  if (!isSafeRepositoryPath(authorityPath)) {
    throw new ContractFoundationError(
      "INVALID_AUTHORITY_PATH",
      `Authority path is not a canonical repository-relative path: ${authorityPath}`,
      { authorityPath },
    );
  }
  const root = await realpath(repositoryRoot);
  const candidate = resolve(root, authorityPath);
  const lexicalRelative = relative(root, candidate);
  if (lexicalRelative.startsWith("..") || isAbsolute(lexicalRelative)) {
    throw new ContractFoundationError(
      "REPOSITORY_ESCAPE",
      `Authority path escapes the repository: ${authorityPath}`,
      { authorityPath },
    );
  }
  let actual: string;
  try {
    actual = await realpath(candidate);
  } catch (error: unknown) {
    throw new ContractFoundationError(
      "MISSING_AUTHORITY_FILE",
      `Authority file does not exist: ${authorityPath}`,
      { authorityPath, cause: error instanceof Error ? error.message : String(error) },
    );
  }
  const actualRelative = relative(root, actual);
  if (actualRelative.startsWith("..") || isAbsolute(actualRelative)) {
    throw new ContractFoundationError(
      "REPOSITORY_ESCAPE",
      `Authority file resolves outside the repository: ${authorityPath}`,
      { authorityPath },
    );
  }
  return actual;
}

export async function readJsonAuthority(
  repositoryRoot: string,
  authorityPath: string,
): Promise<JsonObject> {
  const path = await resolveAuthorityPath(repositoryRoot, authorityPath);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error: unknown) {
    throw new ContractFoundationError(
      "INVALID_JSON",
      `Authority file is not valid JSON: ${authorityPath}`,
      { authorityPath, cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (!isJsonObject(value)) {
    throw new ContractFoundationError(
      "INVALID_JSON",
      `Authority JSON must be an object: ${authorityPath}`,
      { authorityPath },
    );
  }
  return value;
}

export async function sha256AuthorityFile(
  repositoryRoot: string,
  authorityPath: string,
): Promise<string> {
  const path = await resolveAuthorityPath(repositoryRoot, authorityPath);
  const bytes = await readFile(path);
  let contents: string;
  try {
    contents = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error: unknown) {
    throw new ContractFoundationError(
      "SCHEMA_HASH_MISMATCH",
      `Authority file is not valid UTF-8: ${authorityPath}`,
      { authorityPath, cause: error instanceof Error ? error.message : String(error) },
    );
  }

  const withoutCrLf = contents.replaceAll("\r\n", "");
  if (withoutCrLf.includes("\r")) {
    throw new ContractFoundationError(
      "SCHEMA_HASH_MISMATCH",
      `Authority file contains a lone carriage return: ${authorityPath}`,
      { authorityPath },
    );
  }
  if (contents.includes("\r\n") && withoutCrLf.includes("\n")) {
    throw new ContractFoundationError(
      "SCHEMA_HASH_MISMATCH",
      `Authority file contains mixed LF and CRLF line endings: ${authorityPath}`,
      { authorityPath },
    );
  }

  return createHash("sha256").update(contents.replaceAll("\r\n", "\n"), "utf8").digest("hex");
}

export async function sha256Artifact(
  repositoryRoot: string,
  authorityPath: string,
): Promise<{ readonly sha256: string; readonly sizeBytes: number }> {
  const path = await resolveAuthorityPath(repositoryRoot, authorityPath);
  const bytes = await readFile(path);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength,
  };
}

export function repositoryDirectory(path: string): string {
  return dirname(path);
}
