# Submission evidence

This page maps Baahar's public proof to the Scrape-Verse judging criteria. It is
a navigation aid, not a substitute for the source ledgers or executable tests.

## Product in one sentence

Baahar turns overlooked official city calendars into a trustworthy, searchable
event feed without hiding source uncertainty or publishing a broken scrape.

## Evidence by criterion

| Criterion            | Repository proof                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impact               | A public city feed combines independent long-tail calendars into one chronological, filterable experience with original-source attribution.                         |
| Creativity           | Source-specific collectors feed one strict occurrence contract, immutable replay path, health quarantine, and last-known-good publication boundary.                 |
| Technical excellence | Typed contracts, migration guards, deterministic identity, exact-byte object storage, idempotent jobs, signed cursors, and real PostgreSQL/MinIO integration tests. |
| Scraper Studio       | Each reviewed source keeps its Studio worker, stable collector ID, mapping, request budget, and preview/production evidence under `sources/`.                       |
| Reliability          | Collectors fail atomically; suspect runs freeze publication; repairs require human review and the same schema, source, and downstream gates.                        |
| Presentation         | Responsive city artwork, accessible navigation, category/date filters, detail pages, device-local saves, native share fallback, and downloadable calendar files.    |

## Demo boundary

The hackathon demo uses the verified non-government Bengaluru source set: BIC,
Jagriti Theatre, Atta Galatta, and BIEC. Varanasi remains visible as product
research and integration evidence, but its institutional source is excluded from
the judging narrative unless the organizers provide written eligibility
clarification.

The strongest reliability demonstration is a controlled development-only
selector break on the existing BIEC collector, followed by a human-reviewed
same-collector repair. The production version and last-known-good public feed
remain untouched until the repaired draft passes its local, Studio, immutable
batch, replay, API, and browser gates.

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

## Development disclosure

An AI coding agent assisted with research, implementation, and verification.
The author reviewed the changes, resolved conflicting evidence, and owns every
published decision. No runtime AI inference is used by the product.
