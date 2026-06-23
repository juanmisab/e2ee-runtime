# Upstream Source Record

Package: `getmaapp/signal-wasm`

Imported into this repository for the AGPL public runtime path.

Upstream repository:

```text
https://github.com/getmaapp/signal-wasm
```

Imported commit:

```text
3a5293905e7eacfad42b0b324665849bdd4c9cdf
```

Imported on:

```text
2026-06-23
```

License:

```text
AGPL-3.0-only
```

Important source facts:

- The upstream `Cargo.toml` declares `license = "AGPL-3.0-only"`.
- The upstream runtime depends on `signalapp/libsignal` crates.
- The upstream `LICENSE` says the WASM bridge is built on top of libsignal.
- The upstream notice says it is not affiliated with or endorsed by Signal
  Technology Foundation.

Local rule:

- Preserve this source tree as upstream material unless a later commit clearly
  records local modifications.
- If modified, mark each local change with date and purpose in
  `docs/import-log.md`.
- Do not move private Dominize or CargoLens code into this tree.

