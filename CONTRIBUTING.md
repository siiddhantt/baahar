# Contributing to Baahar

The current build order is defined in [docs/EXECUTION.md](docs/EXECUTION.md).
Do not begin a later checkpoint while an earlier exit gate is red.

## Boundaries

- `contracts/` is the source of truth for HTTP and collector payloads.
- `internal/` packages own product capabilities, not generic technical layers.
- `apps/web/` consumes generated contract types and does not reproduce them.
- `sources/` owns reviewed manifests, collector code/evidence, and source fixtures.
- Interfaces exist at effect boundaries and are owned by their consumers.
- Do not add a dependency, service, abstraction, or route for an unimplemented
  future feature.

## Required before handoff

- format, lint, typecheck, focused tests, and production build are green;
- real PostgreSQL/MinIO or live Bright Data checks are run when the change crosses
  those boundaries; a skipped live check is reported as skipped;
- generated binaries, local data, secrets, and raw private evidence are untracked;
- changed behaviour and exact verification commands are recorded in the handoff.

Comments explain an external constraint or non-obvious invariant. Delete dead
code and obsolete comments instead of leaving them for a future cleanup.

Run Go checks with `./cmd/... ./contracts ./internal/...`. The frontend's npm
dependency tree contains third-party `.go` source, so an unscoped `go test ./...`
would test code Baahar neither owns nor ships.
