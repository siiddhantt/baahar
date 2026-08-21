# Deployment contract

Baahar ships as three deployable processes from one repository:

| Process | Build/run command                                      | Scaling rule                                           |
| ------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Web     | `npm ci && npm run build` in `apps/web`; serve `dist/` | CDN/static replicas                                    |
| API     | `go build -o bin/api ./cmd/api`                        | Stateless horizontal replicas                          |
| Worker  | `go build -o bin/worker ./cmd/worker`                  | One replica initially; durable leases allow more later |

PostgreSQL is the system of record. A private S3-compatible bucket stores exact
collector responses. Neither API nor worker relies on local disk or in-memory
job state.

## Required services

- PostgreSQL 17 or a compatible managed PostgreSQL service;
- private S3-compatible object storage with versioning and lifecycle retention;
- a Bright Data API token scoped to run the reviewed Scraper Studio collectors;
- a static web host/CDN and a container or VM runtime for the Go processes.

The local Compose file is for development and integration tests, not production.

The simplest production topology is a static Vercel deployment for the web app,
one always-on container or VM for the API and worker processes, managed
PostgreSQL, and a private S3-compatible bucket. API and worker can share a host,
but they remain separate processes so collection work never blocks public reads.
Only the API is public; PostgreSQL, object storage, and operator routes stay
private.

## Secrets and configuration

Start from `.env.example`, but inject production values through the hosting
platform's secret store. Never bake them into an image or frontend bundle.

- `BAAHAR_OPERATOR_TOKEN`: at least 24 random bytes; private operator routes only.
- `BAAHAR_CURSOR_SECRET`: at least 32 random bytes; stable across API replicas.
- `BRIGHT_DATA_API_TOKEN`: worker only.
- `BAAHAR_OBJECT_*`: worker only; grant access to the one private artifact bucket.
- `BAAHAR_DATABASE_URL`: grant the API and worker only the database permissions
  they require. Run migrations with a separate privileged release identity.
- `BAAHAR_WEB_ORIGIN`: exact public web origin; no wildcard CORS.
- `VITE_API_ORIGIN`: omit for a same-origin reverse proxy, or set the public API
  origin at web build time.

## Release order

1. Back up PostgreSQL and run `go run ./cmd/migrate up` once.
2. Deploy the API and verify `GET /v1/cities` returns `200` through the public
   route. This query also proves database readiness.
3. Deploy the web build and exercise chooser, feed, detail, source, save, and ICS.
4. Confirm every Scraper Studio collector schedule is disabled, then deploy one
   worker replica. Confirm one Baahar-scheduled run reaches a terminal state, the
   artifact hash matches object storage, and public freshness advances.
5. Keep the previous API and worker image available until the first healthy run.

The worker is intentionally not part of the request path. If Bright Data or a
source is temporarily unavailable, the public API continues serving the last
verified events and marks the source stale instead of publishing a broken run.

## Operational checks

- API: status/error rate, latency, PostgreSQL pool saturation, and `GET /v1/cities`.
- Worker: due/leased/retried/dead jobs and terminal collection-run counts.
- Bright Data: no active per-collector schedule; every production collection is
  associated with a Baahar run.
- Source: last healthy time, consecutive failures, record-count deviation, and
  publication freeze state.
- Object storage: immutable key, byte count, and SHA-256 recorded on every run.
- Browser: synthetic first-time chooser -> event detail -> official source -> ICS.

Raw collector artifacts, operator tokens, and incident diagnostics must never be
served by the public web application.
