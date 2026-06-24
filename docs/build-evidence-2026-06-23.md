# Build Evidence - 2026-06-23

## Source

Imported source:

```text
third_party/getmaapp-signal-wasm
```

Upstream:

```text
https://github.com/getmaapp/signal-wasm
3a5293905e7eacfad42b0b324665849bdd4c9cdf
```

## Tooling Notes

The default `cargo` and `rustc` on this machine are Homebrew binaries. For WASM
checks, use the rustup toolchain first in `PATH` or set `RUSTC` explicitly.

Required local tools observed:

- rustup stable toolchain
- `wasm32-unknown-unknown` target
- `protoc` from Homebrew `protobuf`
- `wasm-pack`

`protoc` was installed with:

```bash
brew install protobuf
```

## Checks Run

Cargo check:

```bash
RUSTC="$(rustup which rustc)" "$(rustup which cargo)" check --target wasm32-unknown-unknown
```

Result:

```text
Finished `dev` profile [optimized + debuginfo]
```

WASM package build:

```bash
PATH="$(dirname "$(rustup which cargo)"):$PATH" wasm-pack build --target web --out-dir pkg
```

Result:

```text
Finished `release` profile [optimized]
Your wasm pkg is ready to publish at third_party/getmaapp-signal-wasm/pkg.
```

## Generated Package Metadata

Generated package:

```text
name: signal-wasm
version: 0.2.0
license: AGPL-3.0-only
main: signal_wasm.js
types: signal_wasm.d.ts
wasm: signal_wasm_bg.wasm
```

## Generated Hashes

The generated `pkg/` directory is ignored and not committed yet. These hashes
record this local build output:

```text
07e1a617188071798c1eadde3e23954aacdbcf513810c881c86fe2ab364068a5  signal_wasm_bg.wasm.d.ts
2b87ae924bd39116783dbb5d33770a9fcd4d62a5578204c6304f572bcdc5f091  LICENSE
2db64c36627c27d2a07be499d60e37581f89674ad36ea3c128df50866c91f041  signal_wasm.d.ts
35a82f011cfa75cbf6f537bf327c909fa4646118129f4caa5f942ebe601f65d0  signal_wasm.js
be7da7f53eb061ba02d585c3211f3d9be90380f0e54f16e0b97065579c3e5a3b  package.json
e0b125b21d0c663b8d74021fabb63a419ee3a1b5c1dd2a314d44b129b50063bd  signal_wasm_bg.wasm
e9beb618d2bb7e489ec8bbbb6eaad363b7b21b236ab0248b4c51f545e875432d  README.md
```

## Public Worker Artifact

Staging command:

```bash
node scripts/stage-web-artifact.mjs
```

Artifact path:

```text
public/e2ee-runtime/v1/runtime-worker.js
```

The staged artifact includes `runtime-worker.js`, the generated wasm-bindgen JS,
`runtime.wasm`, `LICENSE`, `NOTICE`, `SOURCE.txt`, and `hashes.json`.

Packet A Worker operations added after the initial artifact:

- `createDeviceMaterial`
- `exportPrekeyBundle`

These operations are implemented in the public AGPL Worker artifact and keep
private-product consumers on the JSON Worker boundary.

Browser Worker smoke:

```text
createDeviceMaterial: generated registration id, signal device id 7,
3 one-time prekeys, signed prekey 101, Kyber prekey 301, and private state.
exportPrekeyBundle: returned a public bundle matching the generated material.
```

Packet B Worker operation added after Packet A:

- `encryptEnvelope`

Browser Worker smoke:

```text
Alice createDeviceMaterial: signal device id 1.
Bob createDeviceMaterial: signal device id 7.
Bob exportPrekeyBundle: public bundle exported.
Alice encryptEnvelope: processed Bob prekey bundle and produced Signal
ciphertext type 3, one sender session record, one trusted identity, and one
known-recipient device mapping.
```

Packet C Worker operations added after Packet B:

- `decryptEnvelope`
- `exportDeviceState`
- `encryptKnownSessionEnvelope`

Browser Worker smoke:

```text
Bob decryptEnvelope: opened Alice ciphertext as "hello bob".
Bob updated state: one session record, one-time prekeys reduced from 3 to 2.
Bob exportDeviceState: exported one session record.
Bob encryptKnownSessionEnvelope: reply used existing session, Signal ciphertext
type 2, and prekeyBundleProcessed false.
```

Recovery Protocol v1 Worker operations added after Packet C:

- `exportDeviceTransferBundle`
- `importDeviceTransferBundle`
- `exportEncryptedRecoveryBundle`
- `importEncryptedRecoveryBundle`

These operations encrypt and decrypt full device material snapshots with a
user-controlled secret using PBKDF2-SHA-256 plus AES-GCM in the Worker. Product
auth, passkey step-up, QR ceremony, server storage, and org authorization remain
private-product responsibilities outside this public runtime.

## Next Step

Connect a private web consumer only through the Worker URL boundary:

```text
public/e2ee-runtime/v1/runtime-worker.js
```

Do not connect Dominize until the Worker wrapper uses JSON ABI only and this
repo can regenerate the artifact from source.
