# Source Intake Manifest

## Rule

Nothing moves into this public repo until it is classified as:

- `port_now`
- `sanitize_then_port`
- `review_only`
- `do_not_export`
- `upstream_import_after_license_packet`

## Private Checkpoint Source

Source checkpoint:

```text
checkpoint/comms-web-worker-artifact-boundary-20260623
0a989dfa11 docs(comms): freeze AGPL worker runtime boundary
```

## Port Now

These files can be ported after renaming product-specific identifiers:

| Source path | Public destination | Notes |
|---|---|---|
| `packages/comms-crypto-browser/native/comms-browser-signal-wasm/Cargo.toml` | `crates/e2ee-wasm-skeleton/Cargo.toml` | Rename crate and metadata. |
| `packages/comms-crypto-browser/native/comms-browser-signal-wasm/Cargo.lock` | `crates/e2ee-wasm-skeleton/Cargo.lock` | Keep if skeleton dependency versions stay pinned. |
| `packages/comms-crypto-browser/native/comms-browser-signal-wasm/LICENSE` | `crates/e2ee-wasm-skeleton/LICENSE` | Replace with repo license if skeleton is first-party. |
| `packages/comms-crypto-browser/native/comms-browser-signal-wasm/README.md` | `crates/e2ee-wasm-skeleton/README.md` | Rewrite public wording. |
| `packages/comms-crypto-browser/native/comms-browser-signal-wasm/src/lib.rs` | `crates/e2ee-wasm-skeleton/src/lib.rs` | Rename engine id and operation labels. |
| `scripts/build-comms-browser-cleanroom-wasm.mjs` | `scripts/build-wasm.mjs` | Rewrite paths. |
| `scripts/check-comms-browser-cleanroom-wasm-skeleton.mjs` | `scripts/check-wasm-skeleton.mjs` | Rewrite paths and forbidden needles. |

## Sanitize Then Port

These files contain useful contracts but must not be copied directly:

| Source path | Public destination | Required changes |
|---|---|---|
| `packages/comms-crypto-browser/src/cleanRoomRuntimeModule.ts` | `packages/e2ee-core/src/runtime-abi.ts` | Rename `Comms*` types, remove private package imports, keep only generic ABI. |
| `packages/comms-crypto-browser/src/cleanRoomRustBridge.ts` | `packages/e2ee-browser/src/skeleton-binding.ts` | Remove private manifest import and product engine ids. |
| `packages/comms-crypto-browser/src/index.test.ts` | `packages/e2ee-core/src/runtime-abi.test.ts` | Use as behavior checklist only; rewrite tests. |
| `packages/comms-crypto-core/src/crypto/engineBinding.ts` | `packages/e2ee-core/src/engine-binding.ts` | Rename from comms/product wording to E2EE runtime wording. |
| `packages/comms-crypto-core/src/crypto/material.ts` | `packages/e2ee-core/src/private-state.ts` | Remove product identity assumptions. |
| `packages/comms-crypto-core/src/crypto/signalWireFormat.ts` | `packages/e2ee-core/src/signal-wire-format.ts` | Keep generic Signal-compatible metadata only. |
| `packages/comms-crypto-core/src/crypto/adapter.ts` | `packages/e2ee-core/src/adapter.ts` | Remove private app coupling. |

## Review Only

These files are useful evidence but should not be copied into the public repo:

| Source branch | Source path | Use |
|---|---|---|
| `codex/comms-browser-alpha-clean` | `docs/comms/18-browser-runtime-load-getmaapp-signal-wasm-2026-06-23.*` | Runtime-load evidence. |
| `codex/comms-browser-alpha-clean` | `docs/comms/19-browser-crypto-source-provenance-getmaapp-signal-wasm-2026-06-23.*` | Provenance evidence. |
| `codex/comms-browser-alpha-clean` | `docs/comms/31-browser-crypto-license-supply-chain-getmaapp-signal-wasm-2026-06-23.*` | License and supply-chain evidence. |
| `codex/comms-browser-alpha-clean` | `docs/comms/36-browser-crypto-runtime-footprint-getmaapp-signal-wasm-2026-06-23.*` | Bundle footprint evidence. |
| `codex/comms-browser-alpha-clean` | `docs/comms/39-browser-crypto-review-disposition-ledger-getmaapp-signal-wasm-2026-06-23.*` | Why private product import was rejected. |
| `codex/comms-browser-alpha-clean` | `docs/comms/46-browser-crypto-conformance-evidence-getmaapp-signal-wasm-2026-06-23.*` | Conformance evidence shape. |

## Upstream Import After License Packet

The Getmaapp source may be imported only after `docs/license-plan.md` is complete
and the repo has full AGPL text plus NOTICE.

| Upstream | Destination | Rule |
|---|---|---|
| `https://github.com/getmaapp/signal-wasm` | `third_party/getmaapp-signal-wasm/` | Preserve upstream source and notices. |
| selected local wrapper code | `crates/e2ee-wasm/` | Mark modifications and keep build scripts. |

## Do Not Export

Never move these private-consumer surfaces into this repo:

- app source directories
- private client/runtime packages
- private database migrations or RPC implementations
- private auth, tenant, org, location, customer, sales, inventory, fulfillment,
  pricing, or product workflow code
- private environment, deployment, observability, or secrets wiring
- private source maps
- target-customer smoke data
- product-specific global names
- product-specific engine ids
- mobile/Expo runtime packaging for the AGPL route

