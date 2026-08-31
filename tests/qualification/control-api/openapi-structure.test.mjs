import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const openApiPath = resolve(
  repositoryRoot,
  "packages/contracts/schemas/control-api/control-api.openapi.json",
);

describe("P1-V07 OpenAPI 3.1.1 public surface", () => {
  test("declares the actual authenticated loopback API and CLI operations", async () => {
    const document = JSON.parse(await readFile(openApiPath, "utf8"));
    expect(document.openapi).toBe("3.1.1");
    expect(document.servers).toEqual([
      { url: "http://127.0.0.1:{port}/v1", variables: { port: expect.any(Object) } },
    ]);
    expect(document.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(document.security).toEqual([{ bearerAuth: [] }]);

    const requiredOperations = [
      ["/version", "get"],
      ["/health", "get"],
      ["/endpoint", "get"],
      ["/status", "get"],
      ["/doctor", "get"],
      ["/events", "get"],
      ["/runtime/stop", "post"],
    ];
    for (const [path, method] of requiredOperations) {
      expect(
        document.paths[path]?.[method]?.operationId,
        `${method.toUpperCase()} ${path}`,
      ).toBeTypeOf("string");
    }
    expect(document.paths["/runtime/stop"].get).toBeUndefined();
    expect(document.paths["/events"].post).toBeUndefined();
    const resolveParameter = (parameter) => {
      if (parameter.$ref === undefined) return parameter;
      const prefix = "#/components/parameters/";
      expect(parameter.$ref).toMatch(new RegExp(`^${prefix}`));
      return document.components.parameters[parameter.$ref.slice(prefix.length)];
    };
    const stopHeaders = document.paths["/runtime/stop"].post.parameters
      .map(resolveParameter)
      .map((parameter) => parameter.name);
    expect(stopHeaders).toEqual(expect.arrayContaining(["Idempotency-Key", "If-Match"]));
  });
});
