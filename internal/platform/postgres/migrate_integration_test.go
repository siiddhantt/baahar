package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigrationUpDownUpOnPostgres(t *testing.T) {
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL migration test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "baahar_test_" + uuid.NewString()[:8]
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_, _ = admin.Exec(cleanupCtx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
	})

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}

	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
	assertMigrationInvariants(t, ctx, pool)
	for range migrations {
		if err := MigrateDown(ctx, pool, migrations); err != nil {
			t.Fatal(err)
		}
	}
	assertVersion(t, ctx, pool, 0)
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
}

func assertVersion(t *testing.T, ctx context.Context, pool *pgxpool.Pool, want int64) {
	t.Helper()
	got, err := MigrationVersion(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("migration version = %d, want %d", got, want)
	}
}

func assertMigrationInvariants(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	cityID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	var cityEnabled bool
	if err := pool.QueryRow(ctx, `SELECT enabled FROM cities WHERE id = $1`, cityID).Scan(&cityEnabled); err != nil {
		t.Fatal(err)
	}
	if !cityEnabled {
		t.Fatal("launch migration must enable Bengaluru")
	}
	var pageLimit int
	var recordLimit int
	var eventIDPattern string
	if err := pool.QueryRow(ctx, `
		SELECT page_limit, record_limit, source_event_id_pattern
		FROM sources WHERE slug = 'bic'`).Scan(&pageLimit, &recordLimit, &eventIDPattern); err != nil {
		t.Fatal(err)
	}
	if pageLimit != 2 || recordLimit != 100 || eventIDPattern != `^[0-9]+$` {
		t.Fatalf("BIC launch policy pages/records/id = %d/%d/%q", pageLimit, recordLimit, eventIDPattern)
	}
	for index := range 2 {
		if _, err := pool.Exec(ctx, `INSERT INTO venues (id, city_id, name) VALUES ($1, $2, $3)`, uuid.Must(uuid.NewV7()), cityID, fmt.Sprintf("Unreviewed venue %d", index)); err != nil {
			t.Fatalf("multiple venues without reviewed keys should be allowed: %v", err)
		}
	}

	sourceID := uuid.Must(uuid.NewV7())
	_, err := pool.Exec(ctx, `INSERT INTO sources (
		id, city_id, slug, display_name, canonical_host, official_url, manifest_version,
		collector_id, schema_version, collection_input, source_event_id_pattern, freshness_ttl_seconds, cadence_seconds, page_limit, record_limit,
		daily_run_limit, absence_threshold
	) VALUES ($1, $2, 'integration-source', 'Integration source', 'integration.example.org',
		'https://integration.example.org/', 'source-manifest/v1', 'c_test_integration',
		'event-occurrence/v1', '{"url":"https://integration.example.org/events"}'::jsonb, NULL, 43200, 21600, 80, 100, 4, 2)`, sourceID, cityID)
	if err != nil {
		t.Fatal(err)
	}
	runID := uuid.Must(uuid.NewV7())
	_, err = pool.Exec(ctx, `INSERT INTO collection_runs (id, source_id, external_collection_id, trace_id, status, triggered_at)
		VALUES ($1, $2, 'test-collection', 'test-trace', 'validating', now())`, runID, sourceID)
	if err != nil {
		t.Fatal(err)
	}
	eventID := uuid.Must(uuid.NewV7())
	_, err = pool.Exec(ctx, `INSERT INTO events (id, city_id, slug, canonical_title) VALUES ($1, $2, 'test-event', 'Test event')`, eventID, cityID)
	if err != nil {
		t.Fatal(err)
	}
	occurrenceID := uuid.Must(uuid.NewV7())
	_, err = pool.Exec(ctx, `INSERT INTO event_occurrences (
		id, event_id, source_id, source_identity, start_date, starts_at, time_precision, timezone,
		first_observed_at, last_observed_at
	) VALUES ($1, $2, $3, $4, '2026-08-20', '2026-08-20T18:30:00+05:30', 'timed', 'Asia/Kolkata', now(), now())`,
		occurrenceID, eventID, sourceID, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO event_versions (
		id, occurrence_id, collection_run_id, fingerprint, title, category, source_url, start_date,
		starts_at, time_precision, timezone, is_free, price_min_minor, price_max_minor, currency,
		status, observed_at, canonical_record
	) VALUES ($1, $2, $3, $4, 'Test event', 'talks', 'https://bangaloreinternationalcentre.org/events/test/',
		'2026-08-20', '2026-08-20T18:30:00+05:30', 'timed', 'Asia/Kolkata', false, 25000, NULL, 'INR',
		'scheduled', now(), '{}'::jsonb)`, uuid.Must(uuid.NewV7()), occurrenceID, runID,
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	if err != nil {
		t.Fatalf("known minimum with unknown maximum should be allowed: %v", err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO event_versions (
		id, occurrence_id, collection_run_id, fingerprint, title, category, source_url, start_date,
		starts_at, time_precision, timezone, is_free, price_min_minor, currency, status, observed_at, canonical_record
	) VALUES ($1, $2, $3, $4, 'Invalid free event', 'talks', 'https://bangaloreinternationalcentre.org/events/test/',
		'2026-08-20', '2026-08-20T18:30:00+05:30', 'timed', 'Asia/Kolkata', true, 100, 'INR',
		'scheduled', now(), '{}'::jsonb)`, uuid.Must(uuid.NewV7()), occurrenceID, runID,
		"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
	if err == nil {
		t.Fatal("is_free=true with a known price must violate the database contract")
	}
}
