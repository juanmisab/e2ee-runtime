#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamPkg = path.join(repoRoot, "third_party/getmaapp-signal-wasm/pkg");
const artifactDir = path.join(repoRoot, "public/e2ee-runtime/v1");

const sourceText = `# E2EE Runtime Source Offer

Artifact path:
/e2ee-runtime/v1/runtime-worker.js

Public source repository:
https://github.com/juanmisab/e2ee-runtime

License:
AGPL-3.0-only

This artifact is built from the complete source tree in this public repository.
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

Affiliation:
This project may become Signal Protocol-compatible, but it is not affiliated
with Signal Messenger LLC, Signal Foundation, Signal Technology Foundation, or
the Signal app.
`;

await mkdir(artifactDir, { recursive: true });

await copyFile(path.join(upstreamPkg, "signal_wasm.js"), path.join(artifactDir, "signal_wasm.js"));
await copyFile(path.join(upstreamPkg, "signal_wasm_bg.wasm"), path.join(artifactDir, "runtime.wasm"));
await copyFile(path.join(repoRoot, "LICENSE"), path.join(artifactDir, "LICENSE"));
await copyFile(path.join(repoRoot, "NOTICE"), path.join(artifactDir, "NOTICE"));
await writeFile(path.join(artifactDir, "SOURCE.txt"), sourceText, "utf8");

const filesToHash = [
  "runtime-worker.js",
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
