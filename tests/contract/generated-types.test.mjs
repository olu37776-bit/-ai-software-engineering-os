import { describe, expect, test } from "vitest";

import { assertGeneratedTypeSourceCurrent } from "../../scripts/contracts/generate-contract-types.mjs";

const generatedSource = [
  "// generated declaration",
  "export type ActorId = string;",
  "export type RunId = string;",
  "",
].join("\n");

describe("generated contract type drift detection", () => {
  test("accepts a semantically identical CRLF checkout", () => {
    const crlfSource = generatedSource.replaceAll("\n", "\r\n");
    expect(() => assertGeneratedTypeSourceCurrent(crlfSource, generatedSource)).not.toThrow();
  });

  test("rejects content drift even when the checkout uses CRLF", () => {
    const driftedCrLfSource = generatedSource
      .replace("ActorId = string", "ActorId = number")
      .replaceAll("\n", "\r\n");
    expect(() => assertGeneratedTypeSourceCurrent(driftedCrLfSource, generatedSource)).toThrow(
      /SCHEMA_TYPE_GENERATION_DRIFT/u,
    );
  });

  test.each([
    ["mixed LF and CRLF", generatedSource.replace("\n", "\r\n")],
    ["lone CR", generatedSource.replace("\n", "\r")],
  ])("rejects malformed %s line endings", (_label, actual) => {
    expect(() => assertGeneratedTypeSourceCurrent(actual, generatedSource)).toThrow(
      /SCHEMA_TYPE_GENERATION_INVALID_LINE_ENDINGS/u,
    );
  });
});
