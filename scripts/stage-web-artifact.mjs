#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamPkg = path.join(repoRoot, "third_party/getmaapp-signal-wasm/pkg");
const workerSource = path.join(repoRoot, "src/worker/runtime-worker.js");
const artifactDir = path.join(repoRoot, "public/e2ee-runtime/v1");
const workerModuleFiles = [
  "abi.js",
  "runtime-core.js",
  "ops/attachments.js",
  "ops/device.js",
  "ops/envelopes.js",
  "ops/recovery.js",
];

const sourceText = `# E2EE Runtime Source Offer

Artifact path:
/e2ee-runtime/v1/runtime-worker.js

Public source repository:
https://github.com/juanmisab/e2ee-runtime

License:
AGPL-3.0-only

This artifact is built from the complete source tree in this public repository.
The Worker source of truth is:
src/worker/runtime-worker.js

The Worker runtime modules staged with the artifact are:
src/worker/abi.js
src/worker/runtime-core.js
src/worker/ops/device.js
src/worker/ops/envelopes.js
src/worker/ops/attachments.js
src/worker/ops/recovery.js

The JSON ABI and operation contracts are documented in:
src/worker/abi.ts
src/worker/ops/device.ts
src/worker/ops/envelopes.ts
src/worker/ops/attachments.ts
src/worker/ops/recovery.ts

The vendored upstream source is recorded in:
third_party/getmaapp-signal-wasm/UPSTREAM.md

Vendored upstream source:
https://github.com/getmaapp/signal-wasm

Vendored upstream commit:
3a5293905e7eacfad42b0b324665849bdd4c9cdf

Upstream crypto dependency:
signalapp/libsignal crates, AGPL-3.0-only, via the vendored Cargo.toml.

Build commands used for the current pre-alpha artifact:
cd third_party/getmaapp-signal-wasm
PATH="$(dirname "$(rustup which cargo)"):$PATH" wasm-pack build --target web --out-dir pkg
cd ../..
node scripts/stage-web-artifact.mjs

Consumer boundary:
Private apps must talk to this runtime through JSON postMessage calls to the
Worker artifact. Do not import this runtime as a private app npm dependency.

Recovery Protocol v1:
The Worker exposes encrypted device-transfer and encrypted recovery-bundle JSON
operations. Product auth, passkey step-up, QR ceremonies, and storage policy are
consumer responsibilities and are not implemented in this public runtime.

Prekey refill:
The Worker exposes generatePrekeyBatch so a local device can produce replacement
one-time and Kyber prekeys without resetting its identity, sessions, or recovery
state. Publishing those public keys to product storage is a consumer
responsibility and is not implemented in this public runtime.

Attachment operations:
The Worker exposes pre-alpha attachment encryption and decryption JSON
operations. Attachment bytes are encrypted inside the Worker with AES-256-GCM.
The attachment content key is wrapped per recipient device through the existing
Signal envelope session. Product storage, RLS, entitlement, and UI are consumer
responsibilities and are not implemented in this public runtime.

Affiliation:
This project may become Signal Protocol-compatible, but it is not affiliated
with Signal Messenger LLC, Signal Foundation, Signal Technology Foundation, or
the Signal app.
`;

await mkdir(artifactDir, { recursive: true });
await mkdir(path.join(artifactDir, "ops"), { recursive: true });

await copyFile(workerSource, path.join(artifactDir, "runtime-worker.js"));
for (const file of workerModuleFiles) {
  await copyFile(path.join(repoRoot, "src/worker", file), path.join(artifactDir, file));
}
await copyFile(path.join(upstreamPkg, "signal_wasm.js"), path.join(artifactDir, "signal_wasm.js"));
await copyFile(path.join(upstreamPkg, "signal_wasm_bg.wasm"), path.join(artifactDir, "runtime.wasm"));
await copyFile(path.join(repoRoot, "LICENSE"), path.join(artifactDir, "LICENSE"));
await copyFile(path.join(repoRoot, "NOTICE"), path.join(artifactDir, "NOTICE"));
await writeFile(path.join(artifactDir, "SOURCE.txt"), sourceText, "utf8");

const filesToHash = [
  "runtime-worker.js",
  ...workerModuleFiles,
  "signal_wasm.js",
  "runtime.wasm",
  "LICENSE",
  "NOTICE",
  "SOURCE.txt",
];

const hashes = {};
for (const file of filesToHash) {
  const bytes = await readFile(path.join(artifactDir, file));
  hashes[file] = {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.byteLength,
  };
}

await writeFile(
  path.join(artifactDir, "hashes.json"),
  `${JSON.stringify(
    {
      generatedBy: "scripts/stage-web-artifact.mjs",
      artifactPath: "/e2ee-runtime/v1/runtime-worker.js",
      license: "AGPL-3.0-only",
      hashes,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Staged web artifact at ${path.relative(repoRoot, artifactDir)}`);
