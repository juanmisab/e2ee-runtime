# Import Log

## 2026-06-23 - getmaapp/signal-wasm

Imported upstream source into:

```text
third_party/getmaapp-signal-wasm
```

Upstream commit:

```text
3a5293905e7eacfad42b0b324665849bdd4c9cdf
```

Purpose:

- preserve the browser WASM Signal Protocol-compatible runtime source in the
  public AGPL repo
- prepare a Worker artifact path without importing AGPL code into Dominize
  private app bundles
- keep source/build evidence colocated with the public runtime work

Local modifications:

- none at import time

Build evidence:

- `docs/build-evidence-2026-06-23.md`

Next expected local change:

- build a thin public Worker wrapper around the imported runtime
- generate `SOURCE.txt` and `hashes.json` for built artifacts
