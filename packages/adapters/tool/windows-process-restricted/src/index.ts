export {
  createTrustedToolCatalog,
  probeWindowsProcessRestrictedCapability,
  runWindowsProcessRestricted,
} from "./windows-process-restricted.js";
export type {
  IsolationCapabilityReport,
  IsolationEvidence,
  IsolationLevel,
  StagedInput,
  SubjectRef,
  TrustedToolCatalog,
  TrustedToolDescriptor,
  WindowsProcessRestrictedLimits,
  WindowsProcessRestrictedRequest,
  WindowsProcessRestrictedResult,
} from "./types.js";
