#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "package.json",
  "docs/branching.md",
  "docs/distribution-mode.md",
  "docs/license-plan.md",
  "docs/source-intake-manifest.md",
];

const requiredText = {
  "README.md": [
    "pre-alpha scaffold",
    "/e2ee-runtime/v1/runtime-worker.js",
    "JSON `postMessage`",
    "not affiliated",
  ],
  "package.json": [
    "\"private\": true",
    "\"license\": \"AGPL-3.0-only\"",
    "https://github.com/juanmisab/e2ee-runtime.git",
  ],
  "docs/branching.md": [
    "codex/agpl-worker-runtime-foundation",
    "checkpoint/comms-web-worker-artifact-boundary-20260623",
    "0a989dfa11",
  ],
  "docs/distribution-mode.md": [
    "web_worker_url_artifact",
    "JSON ABI messages",
    "new Worker",
    "expo_agpl_runtime_blocked_until_legal_review",
  ],
  "docs/license-plan.md": [
    "AGPL-3.0-only",
    "getmaapp/signal-wasm",
    "signalapp/libsignal",
    "Before Importing Getmaapp Source",
  ],
  "docs/source-intake-manifest.md": [
    "Port Now",
    "Sanitize Then Port",
    "Review Only",
    "Upstream Import After License Packet",
    "Do Not Export",
  ],
};

const forbiddenSourceNeedles = [
  "@comms/client",
  "dominizeComms",
  "comms_orgs",
  "apps/app",
  "apps/showroom",
  "apps/expo",
  "SupabaseClient",
  "Firebase",
  "process.env.SUPABASE",
];

const failures = [];

for (const file of requiredFiles) {
  const source = await readRequired(file);
  for (const needle of requiredText[file] ?? []) {
    if (source.includes(needle)) continue;
    failures.push(`${file}: missing required text ${JSON.stringify(needle)}`);
  }
}

await scanSourceFiles(repoRoot, ".");

if (failures.length > 0) {
  console.error("Public E2EE runtime boundary check failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public E2EE runtime boundary check passed.");

async function readRequired(relativePath) {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch (error) {
    failures.push(`${relativePath}: required file missing`);
    return "";
  }
}

async function scanSourceFiles(absolutePath, relativePath) {
  let info;
  try {
    info = await stat(absolutePath);
  } catch {
    return;
  }

  if (info.isDirectory()) {
    const baseName = path.basename(absolutePath);
    if ([".git", "node_modules", "dist", "target", "pkg"].includes(baseName)) {
      return;
    }
    const entries = await readdir(absolutePath, { withFileTypes: true });
    for (const entry of entries) {
      await scanSourceFiles(path.join(absolutePath, entry.name), path.join(relativePath, entry.name));
    }
    return;
  }

  if (!info.isFile() || !shouldScan(relativePath)) return;
  if (relativePath === "scripts/check-public-boundary.mjs") return;

  const source = await readFile(absolutePath, "utf8");
  for (const needle of forbiddenSourceNeedles) {
    if (!source.includes(needle)) continue;
    failures.push(`${relativePath}: forbidden private source text ${JSON.stringify(needle)}`);
  }
}

function shouldScan(relativePath) {
  if (relativePath.startsWith("docs/")) return false;
  return [".js", ".mjs", ".ts", ".tsx", ".rs", ".json"].includes(path.extname(relativePath));
}
