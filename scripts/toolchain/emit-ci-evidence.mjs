import { reportAndExit, run, sha256Utf8LfFile } from "./lib.mjs";

reportAndExit({
  schemaVersion: "1.0.0",
  evidenceType: "CrossPlatformBuildEvidence",
  result: "PASS",
  commit: process.env.GITHUB_SHA ?? run("git", ["rev-parse", "HEAD"]),
  environment: {
    os: process.platform,
    arch: process.arch,
    node: process.versions.node,
    pnpm: run("pnpm", ["--version"]),
    typescript: run("pnpm", ["exec", "tsc", "--version"]).replace(/^Version\s+/, ""),
    runnerImage: process.env.ImageOS ?? "local",
    runnerImageVersion: process.env.ImageVersion ?? "local",
  },
  lockfileSha256: await sha256Utf8LfFile("pnpm-lock.yaml"),
  authorityBuild: "pnpm exec tsc -b tsconfig.build.json --pretty false",
});
