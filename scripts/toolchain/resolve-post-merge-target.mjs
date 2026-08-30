import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MISSING_POST_MERGE_BINDING: ${name}`);
  }
  return value;
}

function git(repository, ...args) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function requireSha(value, label) {
  if (!SHA_PATTERN.test(value)) {
    throw new Error(`INVALID_POST_MERGE_${label}: ${value}`);
  }
}

export function resolvePostMergeTarget({
  targetSha,
  currentMainSha,
  refName,
  repository = process.cwd(),
}) {
  requireSha(targetSha, "TARGET_SHA");
  requireSha(currentMainSha, "CURRENT_MAIN_SHA");
  if (refName !== "main") {
    throw new Error(`POST_MERGE_DISPATCH_REQUIRES_MAIN: ${refName}`);
  }

  const checkoutSha = git(repository, "rev-parse", "HEAD");
  if (checkoutSha !== targetSha) {
    throw new Error(
      `POST_MERGE_TARGET_CHECKOUT_MISMATCH: expected=${targetSha} actual=${checkoutSha}`,
    );
  }
  const remoteMainSha = git(repository, "rev-parse", "refs/remotes/origin/main");
  if (remoteMainSha !== currentMainSha) {
    throw new Error(
      `POST_MERGE_CURRENT_MAIN_MISMATCH: expected=${currentMainSha} actual=${remoteMainSha}`,
    );
  }

  const firstParentHistory = git(repository, "rev-list", "--first-parent", currentMainSha).split(
    "\n",
  );
  if (!firstParentHistory.includes(targetSha)) {
    throw new Error(`POST_MERGE_TARGET_OUTSIDE_MAIN_FIRST_PARENT: ${targetSha}`);
  }
  const commitAndParents = git(repository, "rev-list", "--parents", "-n", "1", targetSha).split(
    " ",
  );
  if (commitAndParents.length !== 3 || commitAndParents[0] !== targetSha) {
    throw new Error(`POST_MERGE_TARGET_NOT_TWO_PARENT_MERGE: ${targetSha}`);
  }

  return {
    PHASE1_SCOPE_BASE: commitAndParents[1],
    PHASE1_SCOPE_HEAD: targetSha,
    PHASE1_SCOPE_BRANCH: "main",
    PHASE1_SCOPE_EVENT: "local",
    POST_MERGE_QUALIFICATION_TARGET: targetSha,
    POST_MERGE_QUALIFICATION_CURRENT_MAIN: currentMainSha,
  };
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  try {
    const bindings = resolvePostMergeTarget({
      targetSha: requiredEnvironment("POST_MERGE_TARGET_SHA"),
      currentMainSha: requiredEnvironment("POST_MERGE_CURRENT_MAIN_SHA"),
      refName: requiredEnvironment("POST_MERGE_REF_NAME"),
    });
    process.stdout.write(
      `${Object.entries(bindings)
        .map(([name, value]) => `${name}=${value}`)
        .join("\n")}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
