# Distribution Mode

## Web

Chosen mode:

```text
web_worker_url_artifact
```

Runtime boundary:

```text
private consumer app -> JSON ABI messages -> public AGPL Worker artifact
```

Allowed private-app use:

```ts
const worker = new Worker("/e2ee-runtime/v1/runtime-worker.js", {
  type: "module",
});

worker.postMessage({
  op: "runtimeMetadata",
  requestId: crypto.randomUUID(),
});
```

Current public artifact path:

```text
public/e2ee-runtime/v1/runtime-worker.js
```

Current pre-alpha Worker operations:

- `runtimeMetadata`
- `runtimeReady`
- `messageTypes`
- `generateRegistrationId`
- `generateRandomBytes`
- `generateUuid`
- `generateIdentityKeyPair`
- `createDeviceMaterial`
- `exportPrekeyBundle`
- `encryptEnvelope`

Forbidden private-app use:

```ts
import { createEngine } from "@juanmisab/e2ee-runtime";
await import("@juanmisab/e2ee-runtime");
```

Each enabled private-app build must record:

- artifact URL or static asset path
- public source repo URL
- public source commit SHA
- runtime version
- runtime JS hash
- runtime WASM hash
- license file path
- source offer path
- bundle audit result
- owner GO record

## Mobile

Expo/native remains blocked for the AGPL runtime route.

Status:

```text
expo_agpl_runtime_blocked_until_legal_review
```

Allowed later paths:

- commercial or non-AGPL Signal-compatible license
- permissive compatible runtime
- owned implementation with external crypto review
- a separately approved public mobile shell
- remote/WebView runtime only after App Store and legal review
