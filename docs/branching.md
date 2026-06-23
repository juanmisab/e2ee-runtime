# Branching And Worktree Plan

## Public Repo Lane

Continue public runtime preparation here:

```text
/Users/jm/Developer/worktrees/e2ee-runtime/agpl-worker-runtime-foundation
```

Branch:

```text
codex/agpl-worker-runtime-foundation
```

Target public repo:

```text
github.com/juanmisab/e2ee-runtime
```

Do not push or publish until the license packet and source intake are reviewed.

## Private Consumer Checkpoint

The private consumer monorepo checkpoint is:

```text
checkpoint/comms-web-worker-artifact-boundary-20260623
```

Commit:

```text
0a989dfa11 docs(comms): freeze AGPL worker runtime boundary
```

Use that checkpoint when returning to any of these private-consumer lanes:

```text
codex/comms-browser-public-agpl-worker-from-checkpoint
codex/comms-browser-owned-crypto-from-checkpoint
codex/comms-browser-alt-provider-from-checkpoint
```

## Sequence

1. Scaffold this public repo.
2. Decide exact source intake.
3. Complete license and notice plan.
4. Port the clean generic skeleton.
5. Add Getmaapp/libsignal source only after the AGPL packet is ready.
6. Build the Worker artifact.
7. Connect the private consumer app through Worker URL plus JSON ABI.

