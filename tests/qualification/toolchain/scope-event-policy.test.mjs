import { describe, expect, test } from "vitest";

import { resolveScopeEventBindings } from "../../../scripts/toolchain/scope-event-policy.mjs";

const base = "1".repeat(40);
const head = "2".repeat(40);

describe("required verify exact event bindings", () => {
  test("binds a pull request to its immutable base, head and source branch", () => {
    expect(
      resolveScopeEventBindings({
        eventName: "pull_request",
        pullRequestBaseSha: base,
        pullRequestHeadRef: "phase-1/p1-o04-policy",
        pullRequestHeadSha: head,
        checkoutHead: head,
      }),
    ).toEqual({
      PHASE1_SCOPE_BASE: base,
      PHASE1_SCOPE_HEAD: head,
      PHASE1_SCOPE_BRANCH: "phase-1/p1-o04-policy",
      PHASE1_SCOPE_EVENT: "pull_request",
    });
  });

  test("binds only a protected-main push to before and after commits", () => {
    expect(
      resolveScopeEventBindings({
        eventName: "push",
        pushBeforeSha: base,
        pushHeadSha: head,
        refName: "main",
        checkoutHead: head,
      }),
    ).toEqual({
      PHASE1_SCOPE_BASE: base,
      PHASE1_SCOPE_HEAD: head,
      PHASE1_SCOPE_BRANCH: "main",
      PHASE1_SCOPE_EVENT: "push",
    });
  });

  test.each([
    ["manual dispatch", { eventName: "workflow_dispatch", checkoutHead: head }],
    [
      "non-main push",
      {
        eventName: "push",
        pushBeforeSha: base,
        pushHeadSha: head,
        refName: "feature",
        checkoutHead: head,
      },
    ],
    [
      "zero before SHA",
      {
        eventName: "push",
        pushBeforeSha: "0".repeat(40),
        pushHeadSha: head,
        refName: "main",
        checkoutHead: head,
      },
    ],
    [
      "mismatched checkout",
      {
        eventName: "pull_request",
        pullRequestBaseSha: base,
        pullRequestHeadRef: "phase-1/p1-o04-policy",
        pullRequestHeadSha: head,
        checkoutHead: "3".repeat(40),
      },
    ],
    [
      "unsafe branch",
      {
        eventName: "pull_request",
        pullRequestBaseSha: base,
        pullRequestHeadRef: "phase-1/bad..branch",
        pullRequestHeadSha: head,
        checkoutHead: head,
      },
    ],
  ])("fails closed for %s", (_label, input) => {
    expect(() => resolveScopeEventBindings(input)).toThrow();
  });
});
