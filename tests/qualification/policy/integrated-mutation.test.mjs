import { expect, test } from "vitest";

import { qualifyPolicyMutations } from "../../../scripts/verify-phase-1/qualify-policy-mutations.mjs";

test("the compiled canonical Policy owner kills eight behavioral mutations while valid ALLOW survives", async () => {
  expect(await qualifyPolicyMutations()).toMatchObject({
    result: "PASS",
    baselineProbes: 8,
    killedMutations: 8,
    survivingMutations: 0,
  });
});
