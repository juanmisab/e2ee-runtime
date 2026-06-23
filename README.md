# e2ee-runtime

Public browser E2EE runtime workbench owned under `juanmisab`.

Status: pre-alpha scaffold. No production crypto is included yet.

This repo is intended to produce a versioned static Worker artifact:

```text
/e2ee-runtime/v1/runtime-worker.js
/e2ee-runtime/v1/runtime.wasm
/e2ee-runtime/v1/LICENSE
/e2ee-runtime/v1/NOTICE
/e2ee-runtime/v1/SOURCE.txt
/e2ee-runtime/v1/hashes.json
```

Private apps should communicate with the runtime through JSON `postMessage`
requests to the Worker artifact. They should not bundle this runtime through a
direct npm import unless a later legal review explicitly approves that mode.

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
```

Do not import upstream AGPL source until the intake manifest and license plan
are accepted.
