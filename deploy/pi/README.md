# Raspberry Pi deployment

This deployment runs the Baahar API, worker, PostgreSQL, and private object
storage on one 64-bit Raspberry Pi. PostgreSQL and MinIO stay on the private
Compose network. The API is bound only to `127.0.0.1:8081`, ready for a
Tailscale Funnel TLS endpoint.

## Bring-up

1. Copy `.env.example` to `.env`, replace every secret, add a server-only
   OpenRouter key for Mau, and set mode `0600`.
2. Start storage: `docker compose --env-file .env up -d postgres minio create-bucket`.
3. Restore the reviewed PostgreSQL and object-store snapshots when migrating an
   existing installation.
4. Run migrations and the API: `docker compose --env-file .env up -d migrate api`.
5. Verify the public feed with `curl -fsS http://127.0.0.1:8081/v1/cities`,
   then verify Mau:

   ```sh
   curl -fsS http://127.0.0.1:8081/v1/ask \
     -H 'Content-Type: application/json' \
     -d '{"city":"bengaluru","query":"free music this weekend"}'
   ```

   A `404` means the API image is stale; a typed `503` means the OpenRouter key
   or provider is unavailable.
6. Give the node its stable service name and point Funnel at the loopback API
   only: `sudo tailscale set --hostname=baahar-pi`, then
   `sudo tailscale funnel --bg 8081`.
7. Start one scheduler/worker after verifying source due times:
   `docker compose --env-file .env --profile worker up -d worker`.

Do not publish ports for PostgreSQL or MinIO. Scraper Studio schedules remain
disabled; the Baahar worker is the sole production scheduler.

## Reboot recovery

Enable both host services once with `sudo systemctl enable --now docker
tailscaled`. PostgreSQL, MinIO, the API, and worker use Compose
`restart: unless-stopped`; migrations and bucket creation remain one-shot
services. Tailscale persists the `baahar-pi` machine name and background Funnel
configuration across a normal reboot.

After a reboot, allow the database health check and worker restart policy to
settle, then verify:

```sh
systemctl is-active docker tailscaled
docker compose --env-file .env --profile worker ps
curl -fsS http://127.0.0.1:8081/v1/cities
tailscale funnel status
```

The API may be briefly unavailable while PostgreSQL becomes healthy. Docker
restarts the worker if its first connection attempt occurs during that window;
the public web client keeps the last rendered state and exposes its normal retry
action.
