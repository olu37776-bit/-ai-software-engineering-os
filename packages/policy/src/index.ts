import { canonicalJson, canonicalJsonSha256, type PolicyDecision } from "@aseos/contracts";

export type PolicyJson =
  | null
  | boolean
  | number
  | string
  | readonly PolicyJson[]
  | Readonly<{ [key: string]: PolicyJson }>;

export type PolicyDiagnostic = Readonly<{
  code:
    | "INVALID_POLICY_VALUE"
    | "INVALID_POLICY_SET"
    | "INVALID_POLICY_RULE"
    | "INVALID_CONDITION"
    | "INVALID_REFERENCE"
    | "INVALID_REQUIREMENTS"
    | "INVALID_YAML"
    | "YAML_LIMIT_EXCEEDED";
  path: string;
  message: string;
}>;

export type PolicyRequirements = Readonly<{
  permissionScopes?: readonly string[];
  minimumIsolationLevel?:
    "PROCESS_RESTRICTED" | "OS_SANDBOXED" | "CONTAINER_ISOLATED" | "REMOTE_ISOLATED";
  timeoutMs?: number;
  maxConcurrency?: number;
  postVerificationRequired?: boolean;
}>;

export type PolicyLeafCondition = Readonly<{
  operator:
    | "eq"
    | "notEq"
    | "in"
    | "contains"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "exists"
    | "startsWith"
    | "setSubset"
    | "setIntersects";
  reference: string;
  operand?: PolicyJson;
}>;

export type PolicyCondition =
  | PolicyLeafCondition
  | Readonly<{ operator: "all" | "any"; conditions: readonly PolicyCondition[] }>
  | Readonly<{ operator: "not"; condition: PolicyCondition }>;

export type CompiledPolicyRule = Readonly<{
  schemaVersion: "1.0.0";
  ruleId: string;
  domain: string;
  subjectSelector: Readonly<{ subjectTypes: readonly string[] }>;
  action: string;
  resourceSelector: Readonly<{ resourceTypes: readonly string[] }>;
  when: PolicyCondition;
  ruleEffect: "ALLOW" | "DENY";
  requirements: PolicyRequirements;
  reasonCode: string;
  metadata: Readonly<Record<string, PolicyJson>>;
}>;

export type CompiledPolicySet = Readonly<{
  schemaVersion: "1.0.0";
  policySetId: string;
  version: string;
  description: string;
  source: Readonly<{
    kind: "RELEASE" | "MACHINE" | "USER" | "WORKSPACE" | "NODE" | "WORKFLOW";
    ref: string;
  }>;
  defaultOutcome: "DENY";
  constants: Readonly<Record<string, PolicyJson>>;
  rules: readonly CompiledPolicyRule[];
}>;

export type CompilePolicyResult =
  | Readonly<{ ok: true; value: CompiledPolicySet; canonicalJson: string; sha256: string }>
  | Readonly<{ ok: false; diagnostics: readonly PolicyDiagnostic[] }>;

export type PolicySnapshot = Readonly<{
  schemaVersion: "1.0.0";
  snapshotId: string;
  policySetId: string;
  policyVersion: string;
  policyHash: string;
  compiledPolicySet: CompiledPolicySet;
  compilerVersion: string;
  createdAt: string;
}>;

export type PolicySnapshotMetadata = Readonly<{
  snapshotId: string;
  compilerVersion: string;
  createdAt: string;
}>;

export type PolicyEvaluationInput = Readonly<{
  schemaVersion: "1.0.0";
  evaluationId: string;
  capturedAt: string;
  policySnapshotId: string;
  domain: string;
  subjectType: string;
  action: string;
  resourceType: string;
  riskClass: "R0" | "R1" | "R2" | "R3" | "R4";
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET";
  direction: "LOCAL" | "INBOUND" | "OUTBOUND";
  authorityMutation: boolean;
  controlVerified: boolean;
  permissionScopes: readonly string[];
  capabilityIds: readonly string[];
}>;

export type RestrictedYamlLimits = Readonly<{
  maxBytes?: number;
  maxLines?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxScalarLength?: number;
}>;

type MutableJsonObject = Record<string, PolicyJson>;
type ParseResult = Readonly<{ value: PolicyJson; next: number }>;
type ConditionResult = Readonly<{ ok: boolean; matched: boolean }>;
type LeafCondition = PolicyLeafCondition;

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const semver =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const stableCode = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const ruleIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const constantReference = /^constant\.[A-Z][A-Z0-9_]*$/u;
const allowedInputReferences = new Set([
  "input.action",
  "input.domain",
  "input.subjectType",
  "input.resourceType",
  "input.riskClass",
  "input.dataClassification",
  "input.direction",
  "input.authorityMutation",
  "input.controlVerified",
  "input.permissionScopes",
  "input.capabilityIds",
]);
const leafOperators = new Set([
  "eq",
  "notEq",
  "in",
  "contains",
  "lt",
  "lte",
  "gt",
  "gte",
  "exists",
  "startsWith",
  "setSubset",
  "setIntersects",
]);
const protectedKeys = new Set(["__proto__", "prototype", "constructor"]);
const fallbackId = "00000000-0000-7000-8000-000000000000";
const fallbackTime = "1970-01-01T00:00:00.000Z";

export const POLICY_EVALUATOR_VERSION = "0.1.0";
export const HARD_INVARIANT_IDS: readonly string[] = Object.freeze([
  "NO_DIRECT_AUTHORITY_WRITE",
  "R4_REQUIRES_VERIFIED_CONTROL",
  "NO_SECRET_OUTBOUND",
]);

class PolicyFailure extends Error {
  public constructor(
    public readonly code: PolicyDiagnostic["code"],
    public readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: object | null = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertWellFormedUnicodeString(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const next = value.charCodeAt(index + 1);
    const previous = value.charCodeAt(index - 1);
    if (
      (code >= 0xd800 && code <= 0xdbff && !(next >= 0xdc00 && next <= 0xdfff)) ||
      (code >= 0xdc00 && code <= 0xdfff && !(previous >= 0xd800 && previous <= 0xdbff))
    ) {
      throw new PolicyFailure("INVALID_POLICY_VALUE", path, "Lone Unicode surrogate");
    }
  }
}

function hasExactKeys(
  object: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean {
  const keys = Reflect.ownKeys(object);
  const allowedSet = new Set(allowed);
  return (
    keys.length === allowed.length &&
    keys.every((key) => typeof key === "string" && allowedSet.has(key))
  );
}

function isBoundedString(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === "string" && value.length >= minLength && value.length <= maxLength;
}

function isRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.[0-9]+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/u.exec(
      value,
    );
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = daysByMonth[month - 1] ?? 0;
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 60 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function isUniqueBoundedStringArray(value: unknown, maxLength: number): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isBoundedString(item, 1, maxLength)) &&
    new Set(value).size === value.length
  );
}

function assertPolicyJson(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): asserts value is PolicyJson {
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }
  if (typeof value === "string") {
    assertWellFormedUnicodeString(value, path);
    return;
  }
  if (typeof value !== "object") {
    throw new PolicyFailure("INVALID_POLICY_VALUE", path, "Value is not I-JSON compatible");
  }
  if (seen.has(value)) throw new PolicyFailure("INVALID_POLICY_VALUE", path, "Cyclic value");
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      assertPolicyJson(child, path + "/" + String(index), seen);
    });
    seen.delete(value);
    return;
  }
  if (!isRecord(value)) {
    throw new PolicyFailure("INVALID_POLICY_VALUE", path, "Object must have a plain prototype");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || protectedKeys.has(key)) {
      throw new PolicyFailure("INVALID_POLICY_VALUE", path, "Unsafe object key");
    }
    assertWellFormedUnicodeString(key, path + "/<key>");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
      throw new PolicyFailure(
        "INVALID_POLICY_VALUE",
        path + "/" + key,
        "Accessors and non-enumerable properties are forbidden",
      );
    }
    assertPolicyJson(descriptor.value, path + "/" + key, seen);
  }
  seen.delete(value);
}

export function canonicalizePolicyValue(value: unknown): string {
  assertPolicyJson(value, "$", new WeakSet<object>());
  return canonicalJson(value);
}

export function hashPolicyValue(value: unknown): string {
  assertPolicyJson(value, "$", new WeakSet<object>());
  return canonicalJsonSha256(value);
}

function requiredString(
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  pattern?: RegExp,
  maxLength?: number,
  minLength = 1,
): string {
  const value = object[key];
  if (
    typeof value !== "string" ||
    value.length < minLength ||
    (maxLength !== undefined && value.length > maxLength) ||
    (pattern !== undefined && !pattern.test(value))
  ) {
    throw new PolicyFailure("INVALID_POLICY_SET", path + "/" + key, "Expected canonical string");
  }
  return value;
}

function exactKeys(
  object: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedSet.has(key)) {
      throw new PolicyFailure("INVALID_POLICY_SET", path + "/" + key, "Unknown field");
    }
  }
}

function sortedUniqueStrings(value: unknown, path: string): readonly string[] {
  if (!isUniqueBoundedStringArray(value, 256)) {
    throw new PolicyFailure("INVALID_POLICY_SET", path, "Expected unique bounded string array");
  }
  return Object.freeze([...value].sort(compareCodeUnits));
}

function compileRequirements(value: unknown, path: string): PolicyRequirements {
  if (!isRecord(value)) {
    throw new PolicyFailure("INVALID_REQUIREMENTS", path, "Requirements must be an object");
  }
  exactKeys(
    value,
    [
      "permissionScopes",
      "minimumIsolationLevel",
      "timeoutMs",
      "maxConcurrency",
      "postVerificationRequired",
    ],
    path,
  );
  const result: {
    permissionScopes?: readonly string[];
    minimumIsolationLevel?:
      "PROCESS_RESTRICTED" | "OS_SANDBOXED" | "CONTAINER_ISOLATED" | "REMOTE_ISOLATED";
    timeoutMs?: number;
    maxConcurrency?: number;
    postVerificationRequired?: boolean;
  } = {};
  if (value["permissionScopes"] !== undefined) {
    result.permissionScopes = sortedUniqueStrings(
      value["permissionScopes"],
      path + "/permissionScopes",
    );
  }
  const isolation = value["minimumIsolationLevel"];
  if (isolation !== undefined) {
    if (
      isolation !== "PROCESS_RESTRICTED" &&
      isolation !== "OS_SANDBOXED" &&
      isolation !== "CONTAINER_ISOLATED" &&
      isolation !== "REMOTE_ISOLATED"
    ) {
      throw new PolicyFailure(
        "INVALID_REQUIREMENTS",
        path + "/minimumIsolationLevel",
        "Unknown isolation level",
      );
    }
    result.minimumIsolationLevel = isolation;
  }
  const timeoutMs = value["timeoutMs"];
  const maxConcurrency = value["maxConcurrency"];
  if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || (timeoutMs as number) < 1)) {
    throw new PolicyFailure(
      "INVALID_REQUIREMENTS",
      path + "/timeoutMs",
      "Expected positive integer",
    );
  }
  if (
    maxConcurrency !== undefined &&
    (!Number.isSafeInteger(maxConcurrency) || (maxConcurrency as number) < 1)
  ) {
    throw new PolicyFailure(
      "INVALID_REQUIREMENTS",
      path + "/maxConcurrency",
      "Expected positive integer",
    );
  }
  if (timeoutMs !== undefined) result.timeoutMs = timeoutMs as number;
  if (maxConcurrency !== undefined) result.maxConcurrency = maxConcurrency as number;
  if (value["postVerificationRequired"] !== undefined) {
    if (typeof value["postVerificationRequired"] !== "boolean") {
      throw new PolicyFailure(
        "INVALID_REQUIREMENTS",
        path + "/postVerificationRequired",
        "Expected boolean",
      );
    }
    result.postVerificationRequired = value["postVerificationRequired"];
  }
  return Object.freeze(result);
}

function compileCondition(value: unknown, path: string, remainingDepth: number): PolicyCondition {
  if (!isRecord(value) || remainingDepth < 0) {
    throw new PolicyFailure("INVALID_CONDITION", path, "Condition depth exceeds four");
  }
  const operator = value["operator"];
  if (operator === "all" || operator === "any") {
    exactKeys(value, ["operator", "conditions"], path);
    const conditions = value["conditions"];
    if (!Array.isArray(conditions) || conditions.length === 0 || conditions.length > 32) {
      throw new PolicyFailure(
        "INVALID_CONDITION",
        path + "/conditions",
        "Expected bounded condition array",
      );
    }
    return Object.freeze({
      operator,
      conditions: Object.freeze(
        conditions.map((child, index) =>
          compileCondition(child, path + "/conditions/" + String(index), remainingDepth - 1),
        ),
      ),
    });
  }
  if (operator === "not") {
    exactKeys(value, ["operator", "condition"], path);
    return Object.freeze({
      operator,
      condition: compileCondition(value["condition"], path + "/condition", remainingDepth - 1),
    });
  }
  if (typeof operator !== "string" || !leafOperators.has(operator)) {
    throw new PolicyFailure("INVALID_CONDITION", path + "/operator", "Unknown condition operator");
  }
  exactKeys(value, ["operator", "reference", "operand"], path);
  const reference = requiredString(value, "reference", path);
  if (!allowedInputReferences.has(reference) && !constantReference.test(reference)) {
    throw new PolicyFailure(
      "INVALID_REFERENCE",
      path + "/reference",
      "Reference is outside the typed namespace",
    );
  }
  if (operator !== "exists" && value["operand"] === undefined) {
    throw new PolicyFailure("INVALID_CONDITION", path + "/operand", "Operator requires an operand");
  }
  if (operator === "exists" && value["operand"] !== undefined) {
    throw new PolicyFailure(
      "INVALID_CONDITION",
      path + "/operand",
      "exists does not accept an operand",
    );
  }
  return Object.freeze({
    operator: operator as LeafCondition["operator"],
    reference,
    ...(value["operand"] === undefined ? {} : { operand: value["operand"] as PolicyJson }),
  });
}

function compileRule(value: unknown, index: number): CompiledPolicyRule {
  const path = "$/rules/" + String(index);
  if (!isRecord(value)) {
    throw new PolicyFailure("INVALID_POLICY_RULE", path, "Rule must be an object");
  }
  exactKeys(
    value,
    [
      "schemaVersion",
      "ruleId",
      "domain",
      "subjectSelector",
      "action",
      "resourceSelector",
      "when",
      "ruleEffect",
      "requirements",
      "reasonCode",
      "metadata",
    ],
    path,
  );
  if (value["schemaVersion"] !== "1.0.0") {
    throw new PolicyFailure("INVALID_POLICY_RULE", path + "/schemaVersion", "Unsupported version");
  }
  const subject = value["subjectSelector"];
  const resource = value["resourceSelector"];
  if (!isRecord(subject) || !isRecord(resource)) {
    throw new PolicyFailure("INVALID_POLICY_RULE", path, "Selectors must be objects");
  }
  exactKeys(subject, ["subjectTypes"], path + "/subjectSelector");
  exactKeys(resource, ["resourceTypes"], path + "/resourceSelector");
  const effect = value["ruleEffect"];
  if (effect !== "ALLOW" && effect !== "DENY") {
    throw new PolicyFailure("INVALID_POLICY_RULE", path + "/ruleEffect", "Unknown rule effect");
  }
  const metadata = value["metadata"];
  if (!isRecord(metadata)) {
    throw new PolicyFailure(
      "INVALID_POLICY_RULE",
      path + "/metadata",
      "Metadata must be an object",
    );
  }
  return Object.freeze({
    schemaVersion: "1.0.0",
    ruleId: requiredString(value, "ruleId", path, ruleIdPattern, 128),
    domain: requiredString(value, "domain", path, undefined, 64),
    subjectSelector: Object.freeze({
      subjectTypes: sortedUniqueStrings(
        subject["subjectTypes"],
        path + "/subjectSelector/subjectTypes",
      ),
    }),
    action: requiredString(value, "action", path, undefined, 128),
    resourceSelector: Object.freeze({
      resourceTypes: sortedUniqueStrings(
        resource["resourceTypes"],
        path + "/resourceSelector/resourceTypes",
      ),
    }),
    when: compileCondition(value["when"], path + "/when", 4),
    ruleEffect: effect,
    requirements: compileRequirements(value["requirements"], path + "/requirements"),
    reasonCode: requiredString(value, "reasonCode", path, stableCode, 128, 3),
    metadata: Object.freeze({
      ...(metadata as Readonly<Record<string, PolicyJson>>),
    }),
  });
}

export function compilePolicySet(value: unknown): CompilePolicyResult {
  try {
    assertPolicyJson(value, "$", new WeakSet<object>());
    if (!isRecord(value)) {
      throw new PolicyFailure("INVALID_POLICY_SET", "$", "PolicySet must be an object");
    }
    exactKeys(
      value,
      [
        "schemaVersion",
        "policySetId",
        "version",
        "description",
        "source",
        "defaultOutcome",
        "constants",
        "rules",
      ],
      "$",
    );
    if (value["schemaVersion"] !== "1.0.0" || value["defaultOutcome"] !== "DENY") {
      throw new PolicyFailure("INVALID_POLICY_SET", "$", "Unsupported version or non-deny default");
    }
    const source = value["source"];
    const constants = value["constants"];
    const rules = value["rules"];
    if (!isRecord(source) || !isRecord(constants) || !Array.isArray(rules) || rules.length > 4096) {
      throw new PolicyFailure("INVALID_POLICY_SET", "$", "Invalid source, constants, or rules");
    }
    exactKeys(source, ["kind", "ref"], "$/source");
    const kind = source["kind"];
    if (
      kind !== "RELEASE" &&
      kind !== "MACHINE" &&
      kind !== "USER" &&
      kind !== "WORKSPACE" &&
      kind !== "NODE" &&
      kind !== "WORKFLOW"
    ) {
      throw new PolicyFailure("INVALID_POLICY_SET", "$/source/kind", "Unknown source kind");
    }
    const compiledRules = rules.map((rule, index) => compileRule(rule, index));
    if (new Set(compiledRules.map((rule) => rule.ruleId)).size !== compiledRules.length) {
      throw new PolicyFailure("INVALID_POLICY_SET", "$/rules", "Duplicate ruleId");
    }
    const sortedConstants = Object.fromEntries(
      Object.entries(constants as Readonly<Record<string, PolicyJson>>).sort(([left], [right]) =>
        compareCodeUnits(left, right),
      ),
    );
    for (const key of Object.keys(sortedConstants)) {
      if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) {
        throw new PolicyFailure(
          "INVALID_POLICY_SET",
          "$/constants/" + key,
          "Invalid constant name",
        );
      }
    }
    const compiled: CompiledPolicySet = Object.freeze({
      schemaVersion: "1.0.0",
      policySetId: requiredString(value, "policySetId", "$", uuidV7),
      version: requiredString(value, "version", "$", semver),
      description: requiredString(value, "description", "$", undefined, 2048),
      source: Object.freeze({
        kind,
        ref: requiredString(source, "ref", "$/source", undefined, 512),
      }),
      defaultOutcome: "DENY",
      constants: Object.freeze(sortedConstants),
      rules: Object.freeze(
        [...compiledRules].sort((left, right) => compareCodeUnits(left.ruleId, right.ruleId)),
      ),
    });
    return {
      ok: true,
      value: compiled,
      canonicalJson: canonicalizePolicyValue(compiled),
      sha256: hashPolicyValue(compiled),
    };
  } catch (error: unknown) {
    const failure =
      error instanceof PolicyFailure
        ? error
        : new PolicyFailure(
            "INVALID_POLICY_SET",
            "$",
            error instanceof Error ? error.message : String(error),
          );
    return {
      ok: false,
      diagnostics: Object.freeze([
        Object.freeze({
          code: failure.code,
          path: failure.path,
          message: failure.message,
        }),
      ]),
    };
  }
}

type YamlLine = Readonly<{ indent: number; content: string; line: number }>;

function yamlFailure(code: PolicyDiagnostic["code"], line: number, message: string): never {
  throw new PolicyFailure(code, "$/line/" + String(line), message);
}

function requiredYamlLine(lines: readonly YamlLine[], index: number): YamlLine {
  const line = lines[index];
  if (line === undefined) {
    yamlFailure("INVALID_YAML", 1, "Missing YAML line");
  }
  return line;
}

function parseScalar(source: string, line: number, maxScalarLength: number): PolicyJson {
  if (source.length > maxScalarLength) {
    yamlFailure("YAML_LIMIT_EXCEEDED", line, "Scalar too long");
  }
  if (source === "true") return true;
  if (source === "false") return false;
  if (source === "null") return null;
  if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u.test(source)) {
    const value = Number(source);
    if (!Number.isFinite(value)) {
      yamlFailure("INVALID_YAML", line, "Non-finite number");
    }
    return value;
  }
  if (source.startsWith('"') && source.endsWith('"')) {
    let value: unknown;
    try {
      value = JSON.parse(source) as unknown;
    } catch {
      yamlFailure("INVALID_YAML", line, "Invalid JSON string scalar");
    }
    if (typeof value !== "string") {
      yamlFailure("INVALID_YAML", line, "Expected string scalar");
    }
    return value;
  }
  yamlFailure("INVALID_YAML", line, "Only JSON double-quoted strings and JSON scalars are allowed");
}

function splitMapping(content: string, line: number): readonly [string, string] {
  const index = content.indexOf(":");
  if (index <= 0) yamlFailure("INVALID_YAML", line, "Expected mapping entry");
  const key = content.slice(0, index);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/u.test(key) || protectedKeys.has(key)) {
    yamlFailure("INVALID_YAML", line, "Unsafe mapping key");
  }
  const rest = content.slice(index + 1);
  if (rest.length > 0 && !rest.startsWith(" ")) {
    yamlFailure("INVALID_YAML", line, "Mapping values require one separating space");
  }
  return [key, rest.trimStart()];
}

function parseYamlNode(
  lines: readonly YamlLine[],
  start: number,
  indent: number,
  limits: Required<RestrictedYamlLimits>,
  depth: number,
  nodeCounter: { value: number },
): ParseResult {
  if (depth > limits.maxDepth) {
    yamlFailure("YAML_LIMIT_EXCEEDED", lines[start]?.line ?? 1, "Depth limit");
  }
  const first = lines[start];
  if (first?.indent !== indent) {
    yamlFailure("INVALID_YAML", first?.line ?? 1, "Invalid indentation");
  }
  if (first.content.startsWith("-")) {
    const values: PolicyJson[] = [];
    let index = start;
    while (
      index < lines.length &&
      lines[index]?.indent === indent &&
      lines[index]?.content.startsWith("-")
    ) {
      const line = requiredYamlLine(lines, index);
      if (line.content !== "-" && !line.content.startsWith("- ")) {
        yamlFailure("INVALID_YAML", line.line, "Sequence marker requires a space");
      }
      nodeCounter.value += 1;
      if (nodeCounter.value > limits.maxNodes) {
        yamlFailure("YAML_LIMIT_EXCEEDED", line.line, "Node limit");
      }
      const rest = line.content === "-" ? "" : line.content.slice(2);
      if (rest === "") {
        const next = lines[index + 1];
        if (next?.indent !== indent + 2) {
          yamlFailure("INVALID_YAML", line.line, "Missing sequence child");
        }
        const parsed = parseYamlNode(lines, index + 1, indent + 2, limits, depth + 1, nodeCounter);
        values.push(parsed.value);
        index = parsed.next;
      } else if (/^[A-Za-z][A-Za-z0-9_-]*:/u.test(rest)) {
        const [key, scalar] = splitMapping(rest, line.line);
        const object: MutableJsonObject = Object.create(null) as MutableJsonObject;
        if (scalar === "") {
          const next = lines[index + 1];
          if (next?.indent !== indent + 4) {
            yamlFailure("INVALID_YAML", line.line, "Missing mapping child");
          }
          const child = parseYamlNode(lines, index + 1, indent + 4, limits, depth + 2, nodeCounter);
          object[key] = child.value;
          index = child.next;
        } else {
          object[key] = parseScalar(scalar, line.line, limits.maxScalarLength);
          index += 1;
        }
        if (
          index < lines.length &&
          lines[index]?.indent === indent + 2 &&
          !lines[index]?.content.startsWith("-")
        ) {
          const tail = parseYamlNode(lines, index, indent + 2, limits, depth + 1, nodeCounter);
          if (!isRecord(tail.value)) {
            yamlFailure("INVALID_YAML", line.line, "Invalid sequence mapping");
          }
          for (const [tailKey, tailValue] of Object.entries(tail.value)) {
            if (Object.hasOwn(object, tailKey)) {
              yamlFailure("INVALID_YAML", line.line, "Duplicate mapping key");
            }
            object[tailKey] = tailValue;
          }
          index = tail.next;
        }
        values.push(Object.freeze(object));
      } else {
        values.push(parseScalar(rest, line.line, limits.maxScalarLength));
        index += 1;
      }
    }
    return { value: Object.freeze(values), next: index };
  }

  const object: MutableJsonObject = Object.create(null) as MutableJsonObject;
  let index = start;
  while (
    index < lines.length &&
    lines[index]?.indent === indent &&
    !lines[index]?.content.startsWith("-")
  ) {
    const line = requiredYamlLine(lines, index);
    nodeCounter.value += 1;
    if (nodeCounter.value > limits.maxNodes) {
      yamlFailure("YAML_LIMIT_EXCEEDED", line.line, "Node limit");
    }
    const [key, scalar] = splitMapping(line.content, line.line);
    if (Object.hasOwn(object, key)) {
      yamlFailure("INVALID_YAML", line.line, "Duplicate mapping key");
    }
    if (scalar === "") {
      const next = lines[index + 1];
      if (next?.indent !== indent + 2) {
        yamlFailure("INVALID_YAML", line.line, "Missing mapping child");
      }
      const child = parseYamlNode(lines, index + 1, indent + 2, limits, depth + 1, nodeCounter);
      object[key] = child.value;
      index = child.next;
    } else {
      object[key] = parseScalar(scalar, line.line, limits.maxScalarLength);
      index += 1;
    }
  }
  return { value: Object.freeze(object), next: index };
}

export function parseRestrictedPolicyYaml(
  source: string,
  configuredLimits: RestrictedYamlLimits = {},
): PolicyJson {
  const limits: Required<RestrictedYamlLimits> = {
    maxBytes: configuredLimits.maxBytes ?? 1_048_576,
    maxLines: configuredLimits.maxLines ?? 20_000,
    maxDepth: configuredLimits.maxDepth ?? 32,
    maxNodes: configuredLimits.maxNodes ?? 100_000,
    maxScalarLength: configuredLimits.maxScalarLength ?? 65_536,
  };
  if (Buffer.byteLength(source, "utf8") > limits.maxBytes) {
    yamlFailure("YAML_LIMIT_EXCEEDED", 1, "Byte limit");
  }
  const withoutCrLf = source.replaceAll("\r\n", "");
  if (withoutCrLf.includes("\r") || (source.includes("\r\n") && withoutCrLf.includes("\n"))) {
    yamlFailure("INVALID_YAML", 1, "Mixed or lone carriage return");
  }
  const normalized = source.replaceAll("\r\n", "\n");
  const rawLines = normalized.split("\n");
  if (rawLines.length > limits.maxLines) {
    yamlFailure("YAML_LIMIT_EXCEEDED", 1, "Line limit");
  }
  const lines: YamlLine[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index] ?? "";
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    if (raw.includes("\t")) {
      yamlFailure("INVALID_YAML", index + 1, "Tabs are forbidden");
    }
    const indent = raw.length - raw.trimStart().length;
    if (indent % 2 !== 0) {
      yamlFailure("INVALID_YAML", index + 1, "Indentation must use two spaces");
    }
    const content = raw.slice(indent);
    if (
      /^(?:---|\.\.\.|%|!|&|\*|<<:)/u.test(content) ||
      content.includes("$" + "{") ||
      content.includes("{{") ||
      content.includes("'") ||
      content.includes("[") ||
      content.includes("{") ||
      /:\s*[|>]/u.test(content)
    ) {
      yamlFailure("INVALID_YAML", index + 1, "Unsupported YAML feature");
    }
    lines.push({ indent, content, line: index + 1 });
  }
  if (lines.length === 0 || lines[0]?.indent !== 0) {
    yamlFailure("INVALID_YAML", 1, "Empty or indented root");
  }
  const parsed = parseYamlNode(lines, 0, 0, limits, 0, { value: 0 });
  if (parsed.next !== lines.length) {
    yamlFailure("INVALID_YAML", lines[parsed.next]?.line ?? 1, "Trailing or inconsistent content");
  }
  assertPolicyJson(parsed.value, "$", new WeakSet<object>());
  return parsed.value;
}

export function compileRestrictedPolicyYaml(
  source: string,
  limits: RestrictedYamlLimits = {},
): CompilePolicyResult {
  try {
    return compilePolicySet(parseRestrictedPolicyYaml(source, limits));
  } catch (error: unknown) {
    const failure =
      error instanceof PolicyFailure
        ? error
        : new PolicyFailure(
            "INVALID_YAML",
            "$",
            error instanceof Error ? error.message : String(error),
          );
    return {
      ok: false,
      diagnostics: Object.freeze([
        Object.freeze({
          code: failure.code,
          path: failure.path,
          message: failure.message,
        }),
      ]),
    };
  }
}

export function createPolicySnapshot(
  policy: CompiledPolicySet,
  metadata: PolicySnapshotMetadata,
): PolicySnapshot {
  if (
    !uuidV7.test(metadata.snapshotId) ||
    !semver.test(metadata.compilerVersion) ||
    !isRfc3339DateTime(metadata.createdAt)
  ) {
    throw new PolicyFailure("INVALID_POLICY_SET", "$/snapshot", "Invalid snapshot metadata");
  }
  return Object.freeze({
    schemaVersion: "1.0.0",
    snapshotId: metadata.snapshotId,
    policySetId: policy.policySetId,
    policyVersion: policy.version,
    policyHash: hashPolicyValue(policy),
    compiledPolicySet: policy,
    compilerVersion: metadata.compilerVersion,
    createdAt: metadata.createdAt,
  });
}

function referencedValue(input: PolicyEvaluationInput, reference: string): PolicyJson | undefined {
  switch (reference) {
    case "input.action":
      return input.action;
    case "input.domain":
      return input.domain;
    case "input.subjectType":
      return input.subjectType;
    case "input.resourceType":
      return input.resourceType;
    case "input.riskClass":
      return input.riskClass;
    case "input.dataClassification":
      return input.dataClassification;
    case "input.direction":
      return input.direction;
    case "input.authorityMutation":
      return input.authorityMutation;
    case "input.controlVerified":
      return input.controlVerified;
    case "input.permissionScopes":
      return input.permissionScopes;
    case "input.capabilityIds":
      return input.capabilityIds;
    default:
      return undefined;
  }
}

function equalJson(left: PolicyJson | undefined, right: PolicyJson | undefined): boolean {
  return left !== undefined && right !== undefined && canonicalJson(left) === canonicalJson(right);
}

function isPolicyArray(value: PolicyJson | undefined): value is readonly PolicyJson[] {
  return Array.isArray(value);
}

function evaluateCondition(
  condition: PolicyCondition,
  input: PolicyEvaluationInput,
  constants: Readonly<Record<string, PolicyJson>>,
): ConditionResult {
  if (condition.operator === "all" || condition.operator === "any") {
    const results = condition.conditions.map((child) => evaluateCondition(child, input, constants));
    if (results.some((result) => !result.ok)) {
      return { ok: false, matched: false };
    }
    return {
      ok: true,
      matched:
        condition.operator === "all"
          ? results.every((result) => result.matched)
          : results.some((result) => result.matched),
    };
  }
  if (condition.operator === "not") {
    const result = evaluateCondition(condition.condition, input, constants);
    return { ok: result.ok, matched: result.ok && !result.matched };
  }
  if (!("reference" in condition)) {
    return { ok: false, matched: false };
  }
  const leaf: LeafCondition = condition;
  const actual = leaf.reference.startsWith("constant.")
    ? constants[leaf.reference.slice("constant.".length)]
    : referencedValue(input, leaf.reference);
  const expected = leaf.operand;
  switch (leaf.operator) {
    case "exists":
      return { ok: true, matched: actual !== undefined };
    case "eq":
      return { ok: true, matched: equalJson(actual, expected) };
    case "notEq":
      return { ok: true, matched: !equalJson(actual, expected) };
    case "in":
      return isPolicyArray(expected)
        ? {
            ok: true,
            matched: expected.some((item) => equalJson(actual, item)),
          }
        : { ok: false, matched: false };
    case "contains":
      if (typeof actual === "string" && typeof expected === "string") {
        return { ok: true, matched: actual.includes(expected) };
      }
      return isPolicyArray(actual)
        ? {
            ok: true,
            matched: actual.some((item) => equalJson(item, expected)),
          }
        : { ok: false, matched: false };
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      if (typeof actual !== "number" || typeof expected !== "number") {
        return { ok: false, matched: false };
      }
      return {
        ok: true,
        matched:
          leaf.operator === "lt"
            ? actual < expected
            : leaf.operator === "lte"
              ? actual <= expected
              : leaf.operator === "gt"
                ? actual > expected
                : actual >= expected,
      };
    case "startsWith":
      return typeof actual === "string" && typeof expected === "string"
        ? { ok: true, matched: actual.startsWith(expected) }
        : { ok: false, matched: false };
    case "setSubset":
      return isPolicyArray(actual) && isPolicyArray(expected)
        ? {
            ok: true,
            matched: actual.every((item) =>
              expected.some((candidate) => equalJson(item, candidate)),
            ),
          }
        : { ok: false, matched: false };
    case "setIntersects":
      return isPolicyArray(actual) && isPolicyArray(expected)
        ? {
            ok: true,
            matched: actual.some((item) =>
              expected.some((candidate) => equalJson(item, candidate)),
            ),
          }
        : { ok: false, matched: false };
  }
}

function validateInput(value: unknown): value is PolicyEvaluationInput {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "evaluationId",
      "capturedAt",
      "policySnapshotId",
      "domain",
      "subjectType",
      "action",
      "resourceType",
      "riskClass",
      "dataClassification",
      "direction",
      "authorityMutation",
      "controlVerified",
      "permissionScopes",
      "capabilityIds",
    ])
  ) {
    return false;
  }
  return (
    value["schemaVersion"] === "1.0.0" &&
    typeof value["evaluationId"] === "string" &&
    uuidV7.test(value["evaluationId"]) &&
    isRfc3339DateTime(value["capturedAt"]) &&
    typeof value["policySnapshotId"] === "string" &&
    uuidV7.test(value["policySnapshotId"]) &&
    isBoundedString(value["domain"], 1, 64) &&
    isBoundedString(value["subjectType"], 1, 128) &&
    isBoundedString(value["action"], 1, 128) &&
    isBoundedString(value["resourceType"], 1, 128) &&
    (value["riskClass"] === "R0" ||
      value["riskClass"] === "R1" ||
      value["riskClass"] === "R2" ||
      value["riskClass"] === "R3" ||
      value["riskClass"] === "R4") &&
    (value["dataClassification"] === "PUBLIC" ||
      value["dataClassification"] === "INTERNAL" ||
      value["dataClassification"] === "CONFIDENTIAL" ||
      value["dataClassification"] === "SECRET") &&
    (value["direction"] === "LOCAL" ||
      value["direction"] === "INBOUND" ||
      value["direction"] === "OUTBOUND") &&
    typeof value["authorityMutation"] === "boolean" &&
    typeof value["controlVerified"] === "boolean" &&
    isUniqueBoundedStringArray(value["permissionScopes"], 256) &&
    isUniqueBoundedStringArray(value["capabilityIds"], 256)
  );
}

function validateSnapshot(
  value: unknown,
  input: PolicyEvaluationInput,
  compiledPolicySet: CompiledPolicySet,
  compiledHash: string,
): value is PolicySnapshot {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "snapshotId",
      "policySetId",
      "policyVersion",
      "policyHash",
      "compiledPolicySet",
      "compilerVersion",
      "createdAt",
    ])
  ) {
    return false;
  }
  return (
    value["schemaVersion"] === "1.0.0" &&
    typeof value["snapshotId"] === "string" &&
    uuidV7.test(value["snapshotId"]) &&
    value["snapshotId"] === input.policySnapshotId &&
    typeof value["policySetId"] === "string" &&
    uuidV7.test(value["policySetId"]) &&
    value["policySetId"] === compiledPolicySet.policySetId &&
    typeof value["policyVersion"] === "string" &&
    semver.test(value["policyVersion"]) &&
    value["policyVersion"] === compiledPolicySet.version &&
    typeof value["policyHash"] === "string" &&
    /^[0-9a-f]{64}$/u.test(value["policyHash"]) &&
    value["policyHash"] === compiledHash &&
    typeof value["compilerVersion"] === "string" &&
    semver.test(value["compilerVersion"]) &&
    isRfc3339DateTime(value["createdAt"])
  );
}

function hardInvariantViolations(input: PolicyEvaluationInput): readonly string[] {
  const violations: string[] = [];
  if (input.authorityMutation) {
    violations.push("NO_DIRECT_AUTHORITY_WRITE");
  }
  if (input.riskClass === "R4" && !input.controlVerified) {
    violations.push("R4_REQUIRES_VERIFIED_CONTROL");
  }
  if (input.dataClassification === "SECRET" && input.direction === "OUTBOUND") {
    violations.push("NO_SECRET_OUTBOUND");
  }
  return Object.freeze(violations.sort());
}

function mergeRequirements(
  requirements: readonly PolicyRequirements[],
): Readonly<{ ok: true; value: PolicyRequirements } | { ok: false }> {
  const permissionScopes = new Set<string>();
  let isolation: PolicyRequirements["minimumIsolationLevel"];
  let timeoutMs: number | undefined;
  let maxConcurrency: number | undefined;
  let postVerificationRequired = false;
  for (const requirement of requirements) {
    for (const scope of requirement.permissionScopes ?? []) {
      permissionScopes.add(scope);
    }
    const candidate = requirement.minimumIsolationLevel;
    if (candidate !== undefined) {
      if (isolation === undefined || isolation === "PROCESS_RESTRICTED") {
        isolation = candidate;
      } else if (candidate !== "PROCESS_RESTRICTED" && candidate !== isolation) {
        return { ok: false };
      }
    }
    if (requirement.timeoutMs !== undefined) {
      timeoutMs =
        timeoutMs === undefined
          ? requirement.timeoutMs
          : Math.min(timeoutMs, requirement.timeoutMs);
    }
    if (requirement.maxConcurrency !== undefined) {
      maxConcurrency =
        maxConcurrency === undefined
          ? requirement.maxConcurrency
          : Math.min(maxConcurrency, requirement.maxConcurrency);
    }
    postVerificationRequired ||= requirement.postVerificationRequired === true;
  }
  const merged: {
    permissionScopes?: readonly string[];
    minimumIsolationLevel?: NonNullable<PolicyRequirements["minimumIsolationLevel"]>;
    timeoutMs?: number;
    maxConcurrency?: number;
    postVerificationRequired?: boolean;
  } = {};
  if (permissionScopes.size > 0) {
    merged.permissionScopes = Object.freeze([...permissionScopes].sort());
  }
  if (isolation !== undefined) merged.minimumIsolationLevel = isolation;
  if (timeoutMs !== undefined) merged.timeoutMs = timeoutMs;
  if (maxConcurrency !== undefined) {
    merged.maxConcurrency = maxConcurrency;
  }
  if (postVerificationRequired) {
    merged.postVerificationRequired = true;
  }
  return { ok: true, value: Object.freeze(merged) };
}

function createDecision(
  snapshot: Partial<PolicySnapshot>,
  input: Partial<PolicyEvaluationInput>,
  outcome: PolicyDecision["outcome"],
  matchedRuleIds: readonly string[],
  invariantIds: readonly string[],
  requirements: PolicyRequirements,
  reasonCodes: readonly string[],
  inputHash: string,
): PolicyDecision {
  return {
    schemaVersion: "1.0.0",
    decisionId:
      typeof input.evaluationId === "string" && uuidV7.test(input.evaluationId)
        ? input.evaluationId
        : fallbackId,
    outcome,
    policySnapshotId:
      typeof snapshot.snapshotId === "string" && uuidV7.test(snapshot.snapshotId)
        ? snapshot.snapshotId
        : fallbackId,
    policySnapshotHash:
      typeof snapshot.policyHash === "string" && /^[0-9a-f]{64}$/u.test(snapshot.policyHash)
        ? snapshot.policyHash
        : "0".repeat(64),
    inputHash,
    matchedRuleIds: Object.freeze([...matchedRuleIds].sort()),
    hardInvariantIds: Object.freeze([...invariantIds].sort()),
    requirements,
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
    residualRiskRefs: Object.freeze([]),
    evaluatedAt: isRfc3339DateTime(input.capturedAt) ? input.capturedAt : fallbackTime,
    evaluatorVersion: POLICY_EVALUATOR_VERSION,
  };
}

export function evaluatePolicy(snapshotValue: unknown, inputValue: unknown): PolicyDecision {
  let inputHash = canonicalJsonSha256({ invalidInput: true });
  let snapshot: Partial<PolicySnapshot> = {};
  let input: Partial<PolicyEvaluationInput> = {};
  try {
    assertPolicyJson(snapshotValue, "$/snapshot", new WeakSet<object>());
    assertPolicyJson(inputValue, "$/input", new WeakSet<object>());
    if (isRecord(snapshotValue)) {
      snapshot = snapshotValue;
    }
    if (isRecord(inputValue)) {
      input = inputValue;
    }
    inputHash = hashPolicyValue(inputValue);
  } catch {
    return createDecision(
      snapshot,
      input,
      "INDETERMINATE",
      [],
      [],
      {},
      ["INVALID_EVALUATION_VALUE"],
      inputHash,
    );
  }
  if (!validateInput(inputValue) || !isRecord(snapshotValue)) {
    return createDecision(
      snapshot,
      input,
      "INDETERMINATE",
      [],
      [],
      {},
      ["INVALID_EVALUATION_INPUT"],
      inputHash,
    );
  }
  const compiled = compilePolicySet(snapshotValue["compiledPolicySet"]);
  if (
    !compiled.ok ||
    !validateSnapshot(snapshotValue, inputValue, compiled.value, compiled.sha256)
  ) {
    return createDecision(
      snapshot,
      input,
      "INDETERMINATE",
      [],
      [],
      {},
      ["INVALID_POLICY_SNAPSHOT"],
      inputHash,
    );
  }
  const typedSnapshot: PolicySnapshot = {
    ...snapshotValue,
    compiledPolicySet: compiled.value,
  };
  const invariantIds = hardInvariantViolations(inputValue);
  if (invariantIds.length > 0) {
    return createDecision(
      typedSnapshot,
      inputValue,
      "DENY",
      [],
      invariantIds,
      {},
      ["HARD_INVARIANT_VIOLATION"],
      inputHash,
    );
  }
  const matched: CompiledPolicyRule[] = [];
  for (const rule of compiled.value.rules) {
    if (
      rule.domain !== inputValue.domain ||
      rule.action !== inputValue.action ||
      !rule.subjectSelector.subjectTypes.includes(inputValue.subjectType) ||
      !rule.resourceSelector.resourceTypes.includes(inputValue.resourceType)
    ) {
      continue;
    }
    const result = evaluateCondition(rule.when, inputValue, compiled.value.constants);
    if (!result.ok) {
      return createDecision(
        typedSnapshot,
        inputValue,
        "INDETERMINATE",
        matched.map((candidate) => candidate.ruleId),
        [],
        {},
        ["CONDITION_TYPE_MISMATCH"],
        inputHash,
      );
    }
    if (result.matched) matched.push(rule);
  }
  const denied = matched.filter((rule) => rule.ruleEffect === "DENY");
  if (denied.length > 0) {
    return createDecision(
      typedSnapshot,
      inputValue,
      "DENY",
      matched.map((rule) => rule.ruleId),
      [],
      {},
      denied.map((rule) => rule.reasonCode),
      inputHash,
    );
  }
  const allowed = matched.filter((rule) => rule.ruleEffect === "ALLOW");
  if (allowed.length === 0) {
    return createDecision(
      typedSnapshot,
      inputValue,
      "DENY",
      [],
      [],
      {},
      ["DEFAULT_DENY"],
      inputHash,
    );
  }
  const merged = mergeRequirements(allowed.map((rule) => rule.requirements));
  if (!merged.ok) {
    return createDecision(
      typedSnapshot,
      inputValue,
      "INDETERMINATE",
      allowed.map((rule) => rule.ruleId),
      [],
      {},
      ["REQUIREMENTS_CONFLICT"],
      inputHash,
    );
  }
  return createDecision(
    typedSnapshot,
    inputValue,
    Object.keys(merged.value).length > 0 ? "ALLOW_WITH_REQUIREMENTS" : "ALLOW",
    allowed.map((rule) => rule.ruleId),
    [],
    merged.value,
    [],
    inputHash,
  );
}
