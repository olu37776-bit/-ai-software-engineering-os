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

function refTarget(reference, schemas) {
  const hashIndex = reference.indexOf("#");
  const schemaId = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : reference.slice(hashIndex);
  const schema = schemas.get(schemaId);
  if (!schema) {
    throw new Error(`UNRESOLVED_SCHEMA_REFERENCE: ${reference}`);
  }
  const target = pointerValue(schema, fragment);
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error(`UNRESOLVED_SCHEMA_REFERENCE: ${reference}`);
  }
  return { schemaId, target };
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
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return "unknown";
  }
  if (schema.$ref) {
    const { schemaId, target } = refTarget(schema.$ref, context.schemas);
    const binding = context.bindingNames.get(schemaId);
    if (binding && schemaId !== context.currentSchemaId) {
      return binding;
    }
    return typeExpression(target, { ...context, currentSchemaId: schemaId });
  }
  if (Object.hasOwn(schema, "const")) {
    return literal(schema.const);
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => literal(value)).join(" | ");
  }
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const alternatives = schema.oneOf ?? schema.anyOf;
    return alternatives.map((item) => typeExpression(item, context)).join(" | ");
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

  const visit = (schema, identity) => {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
    if (schema.$ref) {
      const target = refTarget(schema.$ref, model.schemas);
      const key = `${identity}->${schema.$ref}`;
      if (!visited.has(key)) {
        visited.add(key);
        visit(target.target, target.schemaId);
      }
      return;
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
        visit(child, `${identity}/${key}`);
      }
    }
    if (schema.items) visit(schema.items, `${identity}/items`);
    for (const child of schema.oneOf ?? schema.anyOf ?? []) visit(child, identity);
  };

  for (const binding of model.bindings) {
    visit(model.schemas.get(binding.schemaId), binding.schemaId);
  }
  return { requiredOptionalChecks, primitiveContainerChecks, enumDiscriminantChecks };
}
