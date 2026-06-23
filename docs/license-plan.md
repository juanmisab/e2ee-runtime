# License Plan

## Decision

License target:

```text
AGPL-3.0-only
```

This repo now vendors `getmaapp/signal-wasm` under `third_party/` for the public
AGPL runtime path.

## Current Source Facts

As checked on 2026-06-23:

- `getmaapp/signal-wasm` declares `AGPL-3.0-only`.
- Its `Cargo.toml` depends on `signalapp/libsignal` crates.
- `signalapp/libsignal` is AGPL.
- Getmaapp's notice says its WASM bridge is built on top of libsignal and is
  not affiliated with Signal Technology Foundation.

Primary references:

- https://raw.githubusercontent.com/getmaapp/signal-wasm/main/LICENSE
- https://raw.githubusercontent.com/getmaapp/signal-wasm/main/Cargo.toml
- https://raw.githubusercontent.com/signalapp/libsignal/main/LICENSE
- https://www.gnu.org/licenses/agpl-3.0.en.html

## Getmaapp Source Import

Imported:

- source path: `third_party/getmaapp-signal-wasm`
- upstream commit: `3a5293905e7eacfad42b0b324665849bdd4c9cdf`
- import log: `docs/import-log.md`
- upstream record: `third_party/getmaapp-signal-wasm/UPSTREAM.md`

Completed:

- full `LICENSE` with complete AGPL-3.0-only text
- `NOTICE` with upstream attribution
- upstream repo URL and commit SHA recorded
- upstream copyright and license notices preserved

Still required before a runtime artifact release:

- mark local modifications with date
- keep source tree, lockfiles, and build scripts together
- generate `SOURCE.txt` for each artifact version
- generate `hashes.json` for JS/WASM artifacts
- document no affiliation with Signal

## Package Policy

Root package remains private until first release:

```json
{
  "private": true,
  "license": "AGPL-3.0-only"
}
```

Future public packages may be:

```text
@juanmisab/e2ee-core
@juanmisab/e2ee-browser
@juanmisab/e2ee-wasm
```

Do not publish packages until the source and license packet is complete.
