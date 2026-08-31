import type {
  IsolationCapabilityReport,
  TrustedToolCatalog,
  WindowsProcessRestrictedRequest,
  WindowsProcessRestrictedResult,
} from "@aseos/windows-process-restricted";
import type { IsolationRequirement as CanonicalIsolationRequirement } from "@aseos/contracts";

export type IsolationRequirement = CanonicalIsolationRequirement;

export type RequestedIsolationLevel =
  "PROCESS_RESTRICTED" | "OS_SANDBOXED" | "CONTAINER_ISOLATED" | "REMOTE_ISOLATED";

export interface RestrictedWorkerTaskRequest extends Omit<
  WindowsProcessRestrictedRequest,
  "limits"
> {
  readonly isolationRequirement: CanonicalIsolationRequirement;
}

export type RestrictedWorkerTrustedCatalog = TrustedToolCatalog;

export type IsolationResolution =
  | {
      readonly status: "SELECTED";
      readonly requested: RequestedIsolationLevel;
      readonly selected: "PROCESS_RESTRICTED";
      readonly providerId: "aseos.windows-job-object";
      readonly providerVersion: "1.0.0";
      readonly probe: IsolationCapabilityReport;
    }
  | {
      readonly status: "BLOCKED";
      readonly requested: RequestedIsolationLevel | "INVALID";
      readonly selected: null;
      readonly providerId: "aseos.windows-job-object";
      readonly providerVersion: "1.0.0";
      readonly probe: IsolationCapabilityReport;
      readonly reasonCode:
        | "MINIMUM_ISOLATION_LEVEL_UNAVAILABLE"
        | "PROCESS_RESTRICTED_PROVIDER_UNAVAILABLE"
        | "REQUIRED_PROVIDER_FEATURE_UNAVAILABLE"
        | "DOWNGRADE_POLICY_INVALID"
        | "INVALID_ISOLATION_REQUIREMENT";
    };

export type RestrictedWorkerTaskResult =
  | { readonly status: "BLOCKED"; readonly isolation: IsolationResolution }
  | {
      readonly status: "EXECUTED";
      readonly isolation: IsolationResolution;
      readonly execution: WindowsProcessRestrictedResult;
    };
