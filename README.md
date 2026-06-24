# e2ee-runtime

Public browser E2EE runtime workbench owned under `juanmisab`.

Status: web AGPL Worker production candidate for the `web_worker_url_artifact`
distribution mode. The runtime version is still `0.1.0-prealpha.8`; production
web use requires each consuming deploy to publish the matching source, license,
and hash records and to avoid direct private-app imports.

This repo is intended to produce a versioned static Worker artifact:

```text
/e2ee-runtime/v1/runtime-worker.js
/e2ee-runtime/v1/runtime-core.js
/e2ee-runtime/v1/abi.js
/e2ee-runtime/v1/ops/device.js
/e2ee-runtime/v1/ops/envelopes.js
/e2ee-runtime/v1/ops/attachments.js
/e2ee-runtime/v1/ops/recovery.js
/e2ee-runtime/v1/runtime.wasm
/e2ee-runtime/v1/LICENSE
/e2ee-runtime/v1/NOTICE
/e2ee-runtime/v1/SOURCE.txt
/e2ee-runtime/v1/hashes.json
```

Private apps should communicate with the runtime through JSON `postMessage`
requests to the Worker artifact. They should not bundle this runtime through a
direct npm import unless a later legal review explicitly approves that mode.
`runtime-worker.js` is the small Worker entrypoint; domain operations live in
the staged `ops/*.js` modules and shared libsignal/WASM helpers live in
`runtime-core.js`.

Current Packet A/B/C operations include device material generation, public prekey
bundle export, first-message `encryptEnvelope`, `decryptEnvelope`,
`exportDeviceState`, and known-session reply encryption. The Worker also exposes
pre-alpha attachment wrapping operations: `encryptAttachment` encrypts bytes with
AES-256-GCM and wraps the attachment key through the Signal envelope session, and
`decryptAttachment` unwraps that key for the local device. Recovery Protocol v1
adds encrypted device-transfer and recovery-bundle operations for product
clients that need old-device state restoration while keeping private state
encrypted outside the Worker boundary.

This project may become Signal Protocol-compatible, but it is not affiliated with
Signal Messenger LLC, Signal Foundation, Signal Technology Foundation, or the
Signal app.

## Current Branch

Use this local work branch:

```text
codex/agpl-worker-runtime-foundation
```

Local checkout:

```text
/Users/jm/Developer/worktrees/e2ee-runtime/agpl-worker-runtime-foundation
```

## First Gates

```bash
node scripts/check-public-boundary.mjs
node scripts/stage-web-artifact.mjs
```

Private apps may connect only through the staged, hashed Worker URL boundary.
Do not import this runtime as a private app npm dependency.
