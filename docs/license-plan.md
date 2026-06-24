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
- mark local modifications with date
- keep source tree, lockfiles, and build scripts together
- generate `SOURCE.txt` for each artifact version
- generate `hashes.json` for JS/WASM artifacts
- document no affiliation with Signal

Current release-candidate status:

- the source/build/license packet exists for `0.1.0-prealpha.8`
- the staged artifact includes `LICENSE`, `NOTICE`, `SOURCE.txt`, and
  `hashes.json`
- `pnpm check` verifies the public boundary and required compliance files

Still required for each production web deploy:

- publish or record the exact public source commit/tag used by the deploy
- serve the matching artifact license/source/hash files
- keep the consuming private app on Worker URL plus JSON ABI mode
- do not use direct private-app npm/static/dynamic import
- record the consuming deploy smoke and owner release record

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

Do not publish packages until a separate package-publishing review exists. The
approved production path is the static Worker artifact, not npm package import.
