# Baahar

> Find something worth stepping out for.

Baahar is a source-first city discovery feed for public events that are easy to
miss because they live on venue calendars, cultural-institution websites,
university pages, government portals, and other long-tail sites rather than on
the major ticketing platforms.

The city roadmap starts with Bengaluru and Varanasi. The current release slice
is deliberately narrower: two official Bengaluru sources, end to end. Bright
Data Scraper Studio collectors turn BIC's public calendar and Jagriti Theatre's
list/detail pages into one verified event contract. Baahar then detects changes
so that cancellations, closed registrations, and revised times do not silently
leave stale cards in the feed.

There are no product-runtime LLM calls. Scraper Studio owns collection and
reviewable connector repair; Baahar never auto-approves a generated repair or
lets a changed collector bypass its schema and health gates.

## What the first release does

- collects the next 31 days of official BIC events and Jagriti Theatre's current
  performances through two reviewed Scraper Studio Code workers;
- preserves every returned batch byte in private S3-compatible storage before
  validation;
- rejects structurally invalid, suspiciously small, duplicated, stale, or
  out-of-order runs instead of replacing verified events;
- publishes a responsive Bengaluru feed with date/category/free filters, event
  details, source links, change history, device-local saves, and calendar files.

Varanasi remains the next city on the roadmap but is intentionally not exposed
as a usable noticeboard yet. The first Rudraksh collector attempt failed on an
upstream Bright Data proxy-tunnel error and was quarantined instead of producing
an empty or invented public feed.

## Repository map

```text
apps/web/       React/Vite public application
cmd/            API, worker, and migration entry points
contracts/      authoritative OpenAPI and JSON Schema contracts
internal/       Go domain, application, and platform adapters
migrations/     PostgreSQL schema and reviewed source configuration
sources/        source manifests, collector code, mapping, and evidence ledger
tests/live/     opt-in checks against official public sources
```

## Local development

Requirements: Go 1.26, Node.js 24, Docker with Compose, and a Bright Data API
token that can run the reviewed collector.

```powershell
Copy-Item .env.example .env
```

Set the Bright Data token and unique random values for `BAAHAR_OPERATOR_TOKEN`
and `BAAHAR_CURSOR_SECRET`. Load `.env` into the current PowerShell process
without committing it:

```powershell
Get-Content .env |
  Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } |
  ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value
  }
```

Start the infrastructure, migrate the database, and install the web
dependencies:

```powershell
docker compose up -d postgres minio create-bucket
go run ./cmd/migrate up
npm ci --prefix apps/web
```

Then run these in separate shells that have the same environment loaded:

```powershell
go run ./cmd/api
go run ./cmd/worker
npm --prefix apps/web run dev
```

The web app is served at `http://127.0.0.1:5174` and proxies `/v1` to the API at
`http://127.0.0.1:8080`. The worker schedules shared source collections; public
visitors never trigger a scrape.

## Quality gates

```powershell
go vet ./cmd/... ./contracts ./internal/...
go test ./cmd/... ./contracts ./internal/...
npm --prefix apps/web run format:check
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
```

PostgreSQL/MinIO integration tests use the `BAAHAR_TEST_*` variables documented
in the CI workflow. Live source tests are separate and never substitute for the
production worker path.

## Planning documents

- [Product requirements](docs/PRD.md)
- [System architecture](docs/ARCHITECTURE.md)
- [Experience and visual direction](docs/EXPERIENCE.md)
- [Launch source catalog](docs/SOURCES.md)
- [Execution and quality plan](docs/EXECUTION.md)
- [Deployment contract](docs/DEPLOYMENT.md)
- [Current checkpoint status](docs/STATUS.md)

## Working-name note

Search and registry screening on 18 August 2026 found no relevant live product
for the exact name `Baahar`, and no registry object for `baahar.in` or
`baahar.app`. This is preliminary discovery, not trademark clearance. Run exact
and phonetic searches through IP India before a public brand lock because
`Baahar`, `Bahar`, and `Bahaar` are likely to be treated as related marks.
