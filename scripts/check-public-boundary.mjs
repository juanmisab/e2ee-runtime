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
  "docs/build-evidence-2026-06-23.md",
  "docs/distribution-mode.md",
  "docs/import-log.md",
  "docs/license-plan.md",
  "docs/recovery-protocol-v1.md",
  "docs/source-intake-manifest.md",
  "public/e2ee-runtime/v1/LICENSE",
  "public/e2ee-runtime/v1/NOTICE",
  "public/e2ee-runtime/v1/SOURCE.txt",
  "public/e2ee-runtime/v1/hashes.json",
  "public/e2ee-runtime/v1/runtime-worker.js",
  "public/e2ee-runtime/v1/runtime.wasm",
  "public/e2ee-runtime/v1/signal_wasm.js",
  "scripts/stage-web-artifact.mjs",
  "src/worker/abi.ts",
  "src/worker/runtime-worker.js",
  "src/worker/ops/attachments.ts",
  "src/worker/ops/device.ts",
  "src/worker/ops/envelopes.ts",
  "src/worker/ops/recovery.ts",
  "third_party/getmaapp-signal-wasm/UPSTREAM.md",
];

const requiredText = {
  "README.md": [
    "pre-alpha AGPL runtime artifact",
    "/e2ee-runtime/v1/runtime-worker.js",
    "JSON `postMessage`",
    "Packet A/B/C operations",
    "not affiliated",
  ],
  "package.json": [
    "\"private\": true",
    "\"license\": \"AGPL-3.0-only\"",
    "https://github.com/juanmisab/e2ee-runtime.git",
  ],
  "LICENSE": [
    "GNU AFFERO GENERAL PUBLIC LICENSE",
    "Version 3, 19 November 2007",
  ],
  "docs/branching.md": [
    "codex/agpl-worker-runtime-foundation",
    "checkpoint/comms-web-worker-artifact-boundary-20260623",
    "0a989dfa11",
  ],
  "docs/build-evidence-2026-06-23.md": [
    "third_party/getmaapp-signal-wasm",
    "3a5293905e7eacfad42b0b324665849bdd4c9cdf",
    "wasm-pack build --target web --out-dir pkg",
    "signal_wasm_bg.wasm",
    "e0b125b21d0c663b8d74021fabb63a419ee3a1b5c1dd2a314d44b129b50063bd",
    "node scripts/stage-web-artifact.mjs",
    "createDeviceMaterial",
    "exportPrekeyBundle",
    "encryptEnvelope",
    "ciphertext type 3",
    "decryptEnvelope",
    "exportDeviceState",
    "encryptKnownSessionEnvelope",
    "Signal ciphertext\ntype 2",
    "exportDeviceTransferBundle",
    "importDeviceTransferBundle",
    "exportEncryptedRecoveryBundle",
    "importEncryptedRecoveryBundle",
    "encryptAttachment",
    "decryptAttachment",
    "AES-256-GCM",
  ],
  "docs/distribution-mode.md": [
    "web_worker_url_artifact",
    "JSON ABI messages",
    "new Worker",
    "createDeviceMaterial",
    "exportPrekeyBundle",
    "encryptEnvelope",
    "encryptKnownSessionEnvelope",
    "decryptEnvelope",
    "encryptAttachment",
    "decryptAttachment",
    "exportDeviceState",
    "exportDeviceTransferBundle",
    "importDeviceTransferBundle",
    "exportEncryptedRecoveryBundle",
    "importEncryptedRecoveryBundle",
    "AES-256-GCM",
    "expo_agpl_runtime_blocked_until_legal_review",
  ],
  "docs/recovery-protocol-v1.md": [
    "Recovery Protocol v1",
    "exportDeviceTransferBundle",
    "importDeviceTransferBundle",
    "exportEncryptedRecoveryBundle",
    "importEncryptedRecoveryBundle",
    "PBKDF2-SHA-256",
    "AES-GCM",
    "passkey step-up",
    "No Supabase tables or RLS",
    "No Dominize org or location membership logic",
  ],
  "docs/license-plan.md": [
    "AGPL-3.0-only",
    "getmaapp/signal-wasm",
    "signalapp/libsignal",
    "Getmaapp Source Import",
    "3a5293905e7eacfad42b0b324665849bdd4c9cdf",
  ],
  "docs/source-intake-manifest.md": [
    "Port Now",
    "Sanitize Then Port",
    "Review Only",
    "Upstream Import",
    "Do Not Export",
  ],
  "docs/import-log.md": [
    "third_party/getmaapp-signal-wasm",
    "3a5293905e7eacfad42b0b324665849bdd4c9cdf",
    "Local modifications:",
  ],
  "public/e2ee-runtime/v1/LICENSE": [
    "GNU AFFERO GENERAL PUBLIC LICENSE",
  ],
  "public/e2ee-runtime/v1/NOTICE": [
    "getmaapp/signal-wasm",
    "signalapp/libsignal",
  ],
  "public/e2ee-runtime/v1/SOURCE.txt": [
    "https://github.com/juanmisab/e2ee-runtime",
    "src/worker/runtime-worker.js",
    "src/worker/abi.ts",
    "3a5293905e7eacfad42b0b324665849bdd4c9cdf",
    "JSON postMessage",
  ],
  "public/e2ee-runtime/v1/hashes.json": [
    "\"artifactPath\": \"/e2ee-runtime/v1/runtime-worker.js\"",
    "\"runtime.wasm\"",
  ],
  "public/e2ee-runtime/v1/runtime-worker.js": [
    "JSON postMessage ABI only",
    "runtimeMetadata",
    "generateIdentityKeyPair",
    "createDeviceMaterial",
    "generatePrekeyBatch",
    "exportPrekeyBundle",
    "encryptEnvelope",
    "encryptKnownSessionEnvelope",
    "decryptEnvelope",
    "exportDeviceState",
    "exportDeviceTransferBundle",
    "importDeviceTransferBundle",
    "exportEncryptedRecoveryBundle",
    "importEncryptedRecoveryBundle",
    "encryptAttachment",
    "decryptAttachment",
  ],
  "public/e2ee-runtime/v1/signal_wasm.js": [
    "signal_wasm_bg.wasm",
  ],
  "scripts/stage-web-artifact.mjs": [
    "public/e2ee-runtime/v1",
    "src/worker/runtime-worker.js",
    "SOURCE.txt",
    "hashes.json",
  ],
  "src/worker/abi.ts": [
    "runtimeMetadata",
    "0.1.0-prealpha.8",
    "generatePrekeyBatch",
    "RuntimeOperation",
  ],
  "src/worker/runtime-worker.js": [
    "JSON postMessage ABI only",
    "runtimeMetadata",
    "createDeviceMaterial",
    "generatePrekeyBatch",
    "encryptEnvelope",
    "decryptEnvelope",
    "encryptAttachment",
    "decryptAttachment",
    "exportEncryptedRecoveryBundle",
  ],
  "src/worker/ops/attachments.ts": [
    "EncryptAttachmentPayload",
    "DecryptAttachmentResult",
    "AES-256-GCM",
  ],
  "src/worker/ops/device.ts": [
    "CreateDeviceMaterialPayload",
    "GeneratePrekeyBatchPayload",
    "GeneratePrekeyBatchResult",
  ],
  "src/worker/ops/envelopes.ts": [
    "EncryptEnvelopePayload",
    "DecryptEnvelopeResult",
  ],
  "src/worker/ops/recovery.ts": [
    "RecoveryBundle",
    "passphrase_encrypted_backup",
    "local_encrypted_transfer",
  ],
  "third_party/getmaapp-signal-wasm/UPSTREAM.md": [
    "https://github.com/getmaapp/signal-wasm",
    "3a5293905e7eacfad42b0b324665849bdd4c9cdf",
    "AGPL-3.0-only",
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
    if ([".git", "node_modules", "dist", "target", "pkg", "third_party"].includes(baseName)) {
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
