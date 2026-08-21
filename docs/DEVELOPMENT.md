# Local development

This guide runs the Baahar web app, Go API, worker, PostgreSQL, and private
S3-compatible storage on one development machine.

## Requirements

- Go 1.26
- Node.js 24
- Docker with Compose
- a Bright Data API token that can run the reviewed collectors

## Configure

Copy the example environment and replace the development placeholders:

```powershell
Copy-Item .env.example .env
```

Set `BRIGHT_DATA_API_TOKEN` and unique random values for
`BAAHAR_OPERATOR_TOKEN` and `BAAHAR_CURSOR_SECRET`. Load the file into the
current PowerShell process without committing it:

```powershell
Get-Content .env |
  Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } |
  ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value
  }
```

Ask Baahar works in deterministic guided mode without another secret. To test
the natural-language interpreter, set `BAAHAR_OPENAI_API_KEY` in the API process;
the key is never read by the Vite application.

## Start the stack

Start the development data services, apply migrations, and install the web
dependencies:

```powershell
docker compose up -d postgres minio create-bucket
go run ./cmd/migrate up
npm ci --prefix apps/web
```

Run the application processes in separate shells with the same environment:

```powershell
go run ./cmd/api
go run ./cmd/worker
npm --prefix apps/web run dev
```

The web app opens at `http://127.0.0.1:5174` and proxies `/v1` to the API at
`http://127.0.0.1:8080`. The worker runs shared scheduled collections; visiting
the public application never starts a scrape.

To work on the UI without making collection calls, start only PostgreSQL,
MinIO, the API, and the web app.

## Quality suite

```powershell
go vet ./cmd/... ./contracts ./internal/...
go test ./cmd/... ./contracts ./internal/...
npm --prefix apps/web run format:check
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
```

The CI infrastructure job starts real PostgreSQL and MinIO for migration,
publication, API, and immutable-object integration tests. Live source harnesses
under `tests/live/` are opt-in because they access official public pages.

Read the [source registry](../sources/README.md) before changing a collector and
the [quality evidence map](QUALITY.md) before changing a publication boundary.
