const EXACT_SHA = /^[0-9a-f]{40}$/;

function requireExactSha(value, label) {
  if (!EXACT_SHA.test(value ?? "") || /^0{40}$/.test(value)) {
    throw new Error(`INVALID_${label}: ${value || "<missing>"}`);
  }
  return value;
}

function requireBranch(value, label) {
  const hasControlOrSpace =
    typeof value === "string" &&
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 32 || codePoint === 127;
    });
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("//") ||
    value.includes("..") ||
    hasControlOrSpace ||
    /[~^:?*[\\]/u.test(value)
  ) {
    throw new Error(`INVALID_${label}: ${value || "<missing>"}`);
  }
  return value;
}

export function resolveScopeEventBindings(input) {
  let baseCommit;
  let headCommit;
  let branch;
  if (input.eventName === "pull_request") {
    baseCommit = requireExactSha(input.pullRequestBaseSha, "PULL_REQUEST_BASE_SHA");
    headCommit = requireExactSha(input.pullRequestHeadSha, "PULL_REQUEST_HEAD_SHA");
    branch = requireBranch(input.pullRequestHeadRef, "PULL_REQUEST_HEAD_REF");
  } else if (input.eventName === "push") {
    if (input.refName !== "main") {
      throw new Error(`UNAUTHORIZED_PUSH_REF: ${input.refName || "<missing>"}`);
    }
    baseCommit = requireExactSha(input.pushBeforeSha, "PUSH_BEFORE_SHA");
    headCommit = requireExactSha(input.pushHeadSha, "PUSH_HEAD_SHA");
    branch = "main";
  } else if (input.eventName === "workflow_dispatch") {
    throw new Error("WORKFLOW_DISPATCH_HAS_NO_INDEPENDENT_EVENT_BASE");
  } else {
    throw new Error(`UNSUPPORTED_SCOPE_EVENT: ${input.eventName || "<missing>"}`);
  }

  const checkoutHead = requireExactSha(input.checkoutHead, "CHECKOUT_HEAD");
  if (checkoutHead !== headCommit) {
    throw new Error(`MISMATCHED_CHECKOUT_HEAD: checkout=${checkoutHead} event=${headCommit}`);
  }
  return {
    PHASE1_SCOPE_BASE: baseCommit,
    PHASE1_SCOPE_HEAD: headCommit,
    PHASE1_SCOPE_BRANCH: branch,
    PHASE1_SCOPE_EVENT: input.eventName,
  };
}
