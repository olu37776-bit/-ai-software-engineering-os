import { spawnSync } from "node:child_process";

import { resolveScopeEventBindings } from "./scope-event-policy.mjs";

const checkout = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
});
if (checkout.error) {
  throw checkout.error;
}
if (checkout.status !== 0) {
  throw new Error(`git rev-parse HEAD exited ${checkout.status}: ${checkout.stderr}`);
}

const bindings = resolveScopeEventBindings({
  eventName: process.env.EVENT_NAME,
  pullRequestBaseSha: process.env.PR_BASE_SHA,
  pullRequestHeadRef: process.env.PR_HEAD_REF,
  pullRequestHeadSha: process.env.PR_HEAD_SHA,
  pushBeforeSha: process.env.PUSH_BEFORE_SHA,
  pushHeadSha: process.env.PUSH_HEAD_SHA,
  refName: process.env.REF_NAME,
  checkoutHead: checkout.stdout.trim(),
});

for (const [key, value] of Object.entries(bindings)) {
  console.log(`${key}=${value}`);
}
