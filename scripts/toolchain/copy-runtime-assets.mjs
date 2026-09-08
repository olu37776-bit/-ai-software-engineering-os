import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { repositoryRoot } from "./lib.mjs";

// Runtime-loaded sources are not emitted by tsc. Keep the authority build complete
// even when project references are already up to date.
const assets = [
  [
    "packages/adapters/tool/windows-process-restricted/src/win32-bridge.ps1",
    "packages/adapters/tool/windows-process-restricted/dist/win32-bridge.ps1",
  ],
];
for (const [source, destination] of assets) {
  const output = resolve(repositoryRoot, destination);
  if (process.argv.includes("--clean")) {
    await rm(output, { force: true });
  } else {
    await mkdir(dirname(output), { recursive: true });
    await copyFile(resolve(repositoryRoot, source), output);
  }
}
