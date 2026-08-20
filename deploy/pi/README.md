# Raspberry Pi deployment

This deployment runs the Baahar API, worker, PostgreSQL, and private object
storage on one 64-bit Raspberry Pi. PostgreSQL and MinIO stay on the private
Compose network. The API is bound only to `127.0.0.1:8081`, ready for a
Tailscale Funnel TLS endpoint.

## Bring-up

1. Copy `.env.example` to `.env`, replace every secret, and set mode `0600`.
2. Start storage: `docker compose --env-file .env up -d postgres minio create-bucket`.
3. Restore the reviewed PostgreSQL and object-store snapshots when migrating an
   existing installation.
4. Run migrations and the API: `docker compose --env-file .env up -d migrate api`.
5. Verify `curl -fsS http://127.0.0.1:8081/v1/cities`.
6. Point Tailscale Funnel at the loopback API only.
7. Start one scheduler/worker after verifying source due times:
   `docker compose --env-file .env --profile worker up -d worker`.

Do not publish ports for PostgreSQL or MinIO. Scraper Studio schedules remain
disabled; the Baahar worker is the sole production scheduler.
