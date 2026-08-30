import { resolve } from "node:path";

import {
  loadContractRegistry,
  qualifyCompatibility,
  validateContractInventory,
  validateExampleSuite,
} from "../../packages/contracts/dist/index.js";

import { runSchemaTypeConsistency } from "./schema-type-consistency.mjs";

export async function qualifyContracts(repositoryRoot = resolve(import.meta.dirname, "../..")) {
  const registry = await loadContractRegistry(repositoryRoot);
  const inventory = await validateContractInventory(registry);
  const examples = await validateExampleSuite(registry);
  const typeConsistency = await runSchemaTypeConsistency({ repositoryRoot });
  const compatibility = qualifyCompatibility(registry);
  const actorIdentity = {
    schemaId: "urn:aseos:schema:actor-ref:1.0.0",
    schemaVersion: "1.0.0",
  };
  const probes = {
    valid: registry.validate(actorIdentity, { actorType: "SYSTEM", actorId: "kernel" }),
    unknownField: registry.validate(actorIdentity, {
      actorType: "SYSTEM",
      actorId: "kernel",
      authorityBypass: true,
    }),
    unknownSchema: registry.validate(
      { schemaId: "urn:aseos:schema:unknown:1.0.0", schemaVersion: "1.0.0" },
      {},
    ),
    futureVersion: registry.validate(
      { schemaId: "urn:aseos:schema:actor-ref:99.0.0", schemaVersion: "99.0.0" },
      {},
    ),
    identityVersionMismatch: registry.validate(
      { schemaId: actorIdentity.schemaId, schemaVersion: "99.0.0" },
      {},
    ),
  };
  if (
    !probes.valid.ok ||
    probes.unknownField.ok ||
    probes.unknownSchema.ok ||
    probes.futureVersion.ok ||
    probes.identityVersionMismatch.ok
  ) {
    throw new Error(`RUNTIME_FAIL_CLOSED_PROBE_FAILED: ${JSON.stringify(probes)}`);
  }
  return {
    schemaVersion: "1.0.0",
    gateStepId: "P1-V03-CONTRACTS",
    result: "PASS",
    schemaMetaValidation: registry.loaded.metaValidation,
    schemaRegistryValidation: inventory.result,
    exampleSuite: examples,
    schemaTypeConsistency: typeConsistency,
    compatibility,
    runtimeValidation: {
      result: "PASS",
      validAccepted: probes.valid.ok,
      unknownField: probes.unknownField.code,
      unknownSchema: probes.unknownSchema.code,
      futureVersion: probes.futureVersion.code,
      identityVersionMismatch: probes.identityVersionMismatch.code,
    },
    inventory: {
      activeContracts: inventory.activeContracts.length,
      plannedContracts: inventory.plannedContracts.length,
      publicOrPersistedBoundaries: inventory.publicOrPersistedBoundaries,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${JSON.stringify(await qualifyContracts(), null, 2)}\n`);
}
