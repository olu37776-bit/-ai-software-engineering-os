import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(resolve(packageRoot, "dist"), { recursive: true });
await copyFile(
  resolve(packageRoot, "src/win32-bridge.ps1"),
  resolve(packageRoot, "dist/win32-bridge.ps1"),
);
