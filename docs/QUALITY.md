# Quality evidence

This page maps Baahar's product claims to executable evidence. It is a navigation
aid, not a substitute for the source ledgers or test suites.

## Product in one sentence

Baahar turns overlooked official city calendars into a trustworthy, searchable
event feed without hiding source uncertainty or publishing a broken scrape.

## Evidence map

| Product property    | Repository proof                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Useful coverage     | A public city feed combines independent long-tail calendars into one chronological, filterable experience with original-source attribution.                         |
| Source integrity    | Source-specific collectors feed one strict occurrence contract, immutable replay path, health quarantine, and last-known-good publication boundary.                 |
| Technical quality   | Typed contracts, migration guards, deterministic identity, exact-byte object storage, idempotent jobs, signed cursors, and real PostgreSQL/MinIO integration tests. |
| Collection boundary | Each reviewed source keeps its Studio worker, stable collector ID, mapping, request budget, and preview/production evidence under `sources/`.                       |
| Reliability         | Collectors fail atomically; suspect runs freeze publication; repairs require human review and the same schema, source, and downstream gates.                        |
| Experience          | Responsive city artwork, accessible navigation, category/date filters, detail pages, device-local saves, native share fallback, and downloadable calendar files.    |

## Release boundary

The public release depends on verified source health, immutable artifact storage,
successful normalization, and real API/browser acceptance. Research-only and
account-blocked sources remain visible in their evidence ledgers but cannot enter
the public feed.

A controlled development-only collector break may be used to exercise repair
and recovery. Production and the last-known-good feed remain untouched until the
repaired draft passes its local, Studio, immutable batch, replay, API, and browser
gates.

## Reproduce the quality gates

```powershell
go vet ./cmd/... ./contracts ./internal/...
go test ./cmd/... ./contracts ./internal/...
npm --prefix apps/web run format:check
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
```

Live-source tests are opt-in because they contact first-party public pages. Raw
production batches, credentials, and account-specific evidence are never stored
in the public repository.
