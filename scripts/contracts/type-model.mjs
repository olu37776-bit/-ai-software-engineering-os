import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format } from "prettier";

const registryPath = "packages/contracts/schema-registry.json";
const bindingsPath = "packages/contracts/type-bindings.json";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function literal(value) {
  if (Array.isArray(value)) {
    return `readonly [${value.map((item) => literal(item)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    const members = Object.entries(value).map(
      ([key, child]) => `readonly ${JSON.stringify(key)}: ${literal(child)}`,
    );
    return `Readonly<{ ${members.join("; ")} }>`;
  }
  return JSON.stringify(value);
}

function pointerValue(schema, fragment) {
  if (!fragment || fragment === "#") {
    return schema;
  }
  if (!fragment.startsWith("#/")) {
    throw new Error(`UNSUPPORTED_SCHEMA_REFERENCE_FRAGMENT: ${fragment}`);
  }
  return fragment
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value?.[part], schema);
}

function refTarget(reference, schemas, currentSchemaId) {
  const hashIndex = reference.indexOf("#");
  const schemaId =
    (hashIndex === -1 ? reference : reference.slice(0, hashIndex)) || currentSchemaId;
  const fragment = hashIndex === -1 ? "" : reference.slice(hashIndex);
  const schema = schemas.get(schemaId);
  if (!schema) {
    throw new Error(`UNRESOLVED_SCHEMA_REFERENCE: ${reference}`);
  }
  const target = pointerValue(schema, fragment);
  if (
    target === undefined ||
    (typeof target !== "boolean" &&
      (typeof target !== "object" || target === null || Array.isArray(target)))
  ) {
    throw new Error(`UNRESOLVED_SCHEMA_REFERENCE: ${reference}`);
  }
  return { schemaId, fragment, target };
}

function objectExpression(schema, context) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const members = Object.keys(properties)
    .sort()
    .map((key) => {
      const optional = required.has(key) ? "" : "?";
      return `readonly ${JSON.stringify(key)}${optional}: ${typeExpression(properties[key], context)}`;
    });
  const exact = `Readonly<{ ${members.join("; ")} }>`;
  if (schema.additionalProperties === false) {
    return exact;
  }
  if (members.length === 0) {
    return "Readonly<Record<string, unknown>>";
  }
  const additional =
    schema.additionalProperties && typeof schema.additionalProperties === "object"
      ? typeExpression(schema.additionalProperties, context)
      : "unknown";
  return `${exact} & Readonly<Record<string, ${additional}>>`;
}

function typeExpression(schema, context) {
  if (schema === false) return "never";
  if (schema === true) return "unknown";
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return "unknown";
  }
  // Compose sibling constraints instead of silently discarding allOf or $ref
  // siblings. Parenthesize unions before intersecting them.
  const { allOf, anyOf, oneOf, $ref: reference, ...base } = schema;
  const compositions = [];
  if (reference) {
    const { schemaId, fragment, target } = refTarget(
      reference,
      context.schemas,
      context.currentSchemaId,
    );
    const binding = context.bindingNames.get(schemaId);
    if (binding && !fragment && schemaId !== context.currentSchemaId) {
      compositions.push(binding);
    } else {
      const identity = `${schemaId}${fragment}`;
      if (context.references?.has(identity)) {
        throw new Error(`UNSUPPORTED_RECURSIVE_SCHEMA_REFERENCE: ${identity}`);
      }
      compositions.push(
        typeExpression(target, {
          ...context,
          currentSchemaId: schemaId,
          references: new Set([...(context.references ?? []), identity]),
        }),
      );
    }
  }
  if (allOf) compositions.push(...allOf.map((item) => typeExpression(item, context)));
  for (const alternatives of [oneOf, anyOf]) {
    if (alternatives)
      compositions.push(
        alternatives.map((item) => `(${typeExpression(item, context)})`).join(" | "),
      );
  }
  if (compositions.length > 0) {
    const basic = typeExpression(base, context);
    return (
      [basic, ...compositions]
        .filter((expression) => expression !== "unknown")
        .map((expression) => `(${expression})`)
        .join(" & ") || "unknown"
    );
  }
  if (Object.hasOwn(schema, "const")) {
    return literal(schema.const);
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => literal(value)).join(" | ");
  }
  if (schema.type === "object" || schema.properties) {
    return objectExpression(schema, context);
  }
  if (schema.type === "array") {
    return `readonly (${typeExpression(schema.items ?? {}, context)})[]`;
  }
  if (schema.type === "string") {
    return "string";
  }
  if (schema.type === "integer" || schema.type === "number") {
    return "number";
  }
  if (schema.type === "boolean") {
    return "boolean";
  }
  if (schema.type === "null") {
    return "null";
  }
  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => typeExpression({ type }, context)).join(" | ");
  }
  return "unknown";
}

export async function loadTypeModel(repositoryRoot, schemaOverrides = new Map()) {
  const registry = await readJson(resolve(repositoryRoot, registryPath));
  const bindingsFile = await readJson(resolve(repositoryRoot, bindingsPath));
  const schemas = new Map();
  for (const entry of registry.schemas) {
    const schema =
      schemaOverrides.get(entry.schemaId) ??
      (await readJson(resolve(repositoryRoot, entry.authorityPath)));
    schemas.set(entry.schemaId, schema);
  }
  const bindings = [...bindingsFile.bindings].sort((left, right) =>
    left.exportName.localeCompare(right.exportName),
  );
  const bindingNames = new Map(bindings.map((binding) => [binding.schemaId, binding.exportName]));
  return { bindings, bindingNames, schemas };
}

export async function generateContractTypeSource(repositoryRoot, schemaOverrides = new Map()) {
  const model = await loadTypeModel(repositoryRoot, schemaOverrides);
  const declarations = model.bindings.map((binding) => {
    const schema = model.schemas.get(binding.schemaId);
    if (!schema) {
      throw new Error(`TYPE_BINDING_SCHEMA_MISSING: ${binding.schemaId}`);
    }
    const expression = typeExpression(schema, {
      schemas: model.schemas,
      bindingNames: model.bindingNames,
      currentSchemaId: binding.schemaId,
    });
    return `export type ${binding.exportName} = ${expression};`;
  });
  const source = [
    "// Generated from canonical JSON Schemas by scripts/contracts/generate-contract-types.mjs.",
    "// JSON Schema remains runtime authority. Do not edit this file directly.",
    "",
    ...declarations,
    "",
  ].join("\n");
  return format(source, { parser: "typescript", endOfLine: "lf", printWidth: 100 });
}

export function collectSchemaShapeCounts(model) {
  const visited = new Set();
  let requiredOptionalChecks = 0;
  let primitiveContainerChecks = 0;
  let enumDiscriminantChecks = 0;

  const visit = (schema, identity, currentSchemaId) => {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
    if (schema.$ref) {
      const target = refTarget(schema.$ref, model.schemas, currentSchemaId);
      const key = `${target.schemaId}${target.fragment}`;
      if (!visited.has(key)) {
        visited.add(key);
        visit(target.target, key, target.schemaId);
      }
    }
    if (Array.isArray(schema.enum) || Object.hasOwn(schema, "const")) {
      enumDiscriminantChecks += 1;
    }
    if (schema.type || schema.properties || schema.enum || Object.hasOwn(schema, "const")) {
      primitiveContainerChecks += 1;
    }
    if (schema.properties) {
      requiredOptionalChecks += Object.keys(schema.properties).length;
      for (const [key, child] of Object.entries(schema.properties)) {
        visit(child, `${identity}/${key}`, currentSchemaId);
      }
    }
    if (schema.items) visit(schema.items, `${identity}/items`, currentSchemaId);
    for (const child of [
      ...(schema.oneOf ?? []),
      ...(schema.anyOf ?? []),
      ...(schema.allOf ?? []),
    ]) {
      visit(child, identity, currentSchemaId);
    }
  };

  for (const binding of model.bindings) {
    visit(model.schemas.get(binding.schemaId), binding.schemaId, binding.schemaId);
  }
  return { requiredOptionalChecks, primitiveContainerChecks, enumDiscriminantChecks };
}
