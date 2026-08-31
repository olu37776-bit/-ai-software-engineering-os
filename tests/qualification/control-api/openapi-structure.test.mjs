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
    expect(
      document.paths["/version"].get.responses["200"].content["application/json"].schema,
    ).toEqual({ $ref: "#/components/schemas/VersionResponse" });
    expect(
      document.paths["/status"].get.responses["200"].content["application/json"].schema,
    ).toEqual({ $ref: "#/components/schemas/StatusResponse" });
    expect(
      document.paths["/doctor"].get.responses["200"].content["application/json"].schema,
    ).toEqual({ $ref: "#/components/schemas/DoctorResponse" });
    const eventVariants =
      document.paths["/events"].get.responses["200"].content["text/event-stream"].schema.oneOf;
    expect(eventVariants).toEqual(
      expect.arrayContaining([
        { $ref: "./control-event-notification.schema.json" },
        { $ref: "#/components/schemas/RetentionGap" },
      ]),
    );

    const externalComponentRefs = [];
    const collectExternalRefs = (value) => {
      if (Array.isArray(value)) {
        value.forEach(collectExternalRefs);
      } else if (typeof value === "object" && value !== null) {
        if (typeof value.$ref === "string" && !value.$ref.startsWith("#")) {
          externalComponentRefs.push(value.$ref);
        }
        Object.values(value).forEach(collectExternalRefs);
      }
    };
    collectExternalRefs(document.components.schemas);
    expect(externalComponentRefs.length).toBeGreaterThan(0);
    for (const reference of externalComponentRefs) {
      expect(reference).toMatch(/^\.\.?(?:\/)[A-Za-z0-9._/-]+\.schema\.json(?:#\/.*)?$/u);
      expect(reference).not.toMatch(/^(?:https?:|urn:|\/|[A-Za-z]:)/u);
    }
    const resolveParameter = (parameter) => {
      if (parameter.$ref === undefined) return parameter;
      const prefix = "#/components/parameters/";
      expect(parameter.$ref).toMatch(new RegExp(`^${prefix}`));
      return document.components.parameters[parameter.$ref.slice(prefix.length)];
    };
    const stopParameters = document.paths["/runtime/stop"].post.parameters.map(resolveParameter);
    const stopHeaders = stopParameters.map((parameter) => parameter.name);
    expect(stopHeaders).toEqual(expect.arrayContaining(["Idempotency-Key", "If-Match"]));
    expect(stopParameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({
      in: "header",
      required: true,
      schema: { $ref: "../common/identifiers.schema.json#/$defs/idempotencyKey" },
    });
    const ifMatch = stopParameters.find((parameter) => parameter.name === "If-Match");
    expect(ifMatch).toMatchObject({ in: "header", required: true });
    expect(ifMatch.schema.pattern).toContain("-7");
    expect(ifMatch.schema.pattern).toContain("[89ab]");
  });
});
