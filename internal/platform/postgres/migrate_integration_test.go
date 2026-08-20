package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/sources"
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
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC before health-policy guard: %v", err)
	}

	jagritiID := uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f")
	_, err = pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at)
		VALUES ($1, $2, $3, 'queued', now())`, uuid.Must(uuid.NewV7()), jagritiID, uuid.NewString())
	if err != nil {
		t.Fatal(err)
	}
	bicID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f")
	if _, err := pool.Exec(ctx, `UPDATE sources SET maximum_duplicate_ratio_bps = 101 WHERE id = $1`, bicID); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove Atta Galatta before health-policy guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove workshops category before health-policy guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BHU activation before health-policy guard: %v", err)
	}
	assertVersion(t, ctx, pool, 5)
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("health policy migration discarded a non-recoverable reviewed ratio")
	}
	assertVersion(t, ctx, pool, 5)
	if _, err := pool.Exec(ctx, `UPDATE sources SET maximum_duplicate_ratio_bps = 100 WHERE id = $1`, bicID); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove merge/policy migration over compatible history: %v", err)
	}
	assertVersion(t, ctx, pool, 4)
	if _, err := pool.Exec(ctx, `UPDATE sources SET minimum_records = 2 WHERE id = $1`, bicID); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("source hardening migration discarded a non-recoverable reviewed policy")
	}
	assertVersion(t, ctx, pool, 4)
	if _, err := pool.Exec(ctx, `UPDATE sources SET minimum_records = 1 WHERE id = $1`, bicID); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove source hardening migration over compatible history: %v", err)
	}
	assertVersion(t, ctx, pool, 3)
	var preserved int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM collection_runs WHERE source_id = $1`, jagritiID).Scan(&preserved); err != nil {
		t.Fatal(err)
	}
	if preserved != 1 {
		t.Fatalf("collection history after down = %d, want 1", preserved)
	}
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatalf("reapply policy migrations over existing history: %v", err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM collection_runs WHERE source_id = $1`, jagritiID).Scan(&preserved); err != nil || preserved != 1 {
		t.Fatalf("collection history after up = %d, error = %v", preserved, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE collection_runs SET status = 'triggering' WHERE source_id = $1`, jagritiID); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC before triggering-state guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove Atta Galatta before triggering-state guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove workshops category before triggering-state guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BHU activation before triggering-state guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove merge migration before triggering-state guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("source hardening migration removed an unreconciled triggering state")
	}
	assertVersion(t, ctx, pool, 4)
}

func TestBHUActivationMigrationRoundTripPreservesExistingSchedules(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}

	knownSources := []uuid.UUID{
		uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"),
	}
	priorDue := make(map[uuid.UUID]time.Time, len(knownSources))
	for _, sourceID := range knownSources {
		var due time.Time
		if err := pool.QueryRow(ctx, `SELECT next_due_at FROM sources WHERE id = $1`, sourceID).Scan(&due); err != nil {
			t.Fatal(err)
		}
		priorDue[sourceID] = due
	}
	assertBHUActivated(t, ctx, pool)

	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, 5)
	var remaining int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM sources WHERE id = 'bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd'`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	var cityEnabled bool
	if err := pool.QueryRow(ctx, `SELECT enabled FROM cities WHERE id = '019c5d13-c392-79d2-9012-3ed4242f771e'`).Scan(&cityEnabled); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 || cityEnabled {
		t.Fatalf("BHU source/city after down = %d/%v, want 0/false", remaining, cityEnabled)
	}
	assertSourceDueTimes(t, ctx, pool, priorDue)

	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
	assertBHUActivated(t, ctx, pool)
	assertSourceDueTimes(t, ctx, pool, priorDue)

	bhuID := uuid.MustParse("bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd")
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at)
		VALUES ($1, $2, $3, 'queued', now())`, uuid.Must(uuid.NewV7()), bhuID, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC before BHU history guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove Atta Galatta before BHU history guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove workshops category before BHU history guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("BHU activation migration removed a source with collection history")
	}
	assertVersion(t, ctx, pool, int64(len(migrations)-3))
}

func TestAttaGalattaMigrationRoundTripPreservesExistingSources(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	existing := []uuid.UUID{
		uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"),
		uuid.MustParse("bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd"),
	}
	before := sourceRows(t, ctx, pool, existing)
	assertAttaGalattaMigration(t, ctx, pool)

	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)-2))
	var remaining int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM sources WHERE id = '854afb9d-c219-5f8f-b8a5-f0b8b24ae799'`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("Atta Galatta sources after down = %d, want 0", remaining)
	}
	assertSourceRows(t, ctx, pool, before)

	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
	assertAttaGalattaMigration(t, ctx, pool)
	assertSourceRows(t, ctx, pool, before)

	attaID := uuid.MustParse("854afb9d-c219-5f8f-b8a5-f0b8b24ae799")
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at)
		VALUES ($1, $2, $3, 'queued', now())`, uuid.Must(uuid.NewV7()), attaID, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC before Atta Galatta history guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("Atta Galatta migration removed a source with collection history")
	}
	assertVersion(t, ctx, pool, int64(len(migrations)-1))
}

func TestBIECMigrationRoundTripPreservesExistingSources(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	existing := []uuid.UUID{
		uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"),
		uuid.MustParse("bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd"),
		uuid.MustParse("854afb9d-c219-5f8f-b8a5-f0b8b24ae799"),
	}
	before := sourceRows(t, ctx, pool, existing)
	assertBIECMigration(t, ctx, pool)

	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)-1))
	var remaining int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM sources WHERE id = '520e6232-ab55-5c71-8918-bb68a659ae61'`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("BIEC sources after down = %d, want 0", remaining)
	}
	assertSourceRows(t, ctx, pool, before)

	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
	assertBIECMigration(t, ctx, pool)
	assertSourceRows(t, ctx, pool, before)

	biecID := uuid.MustParse("520e6232-ab55-5c71-8918-bb68a659ae61")
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at)
		VALUES ($1, $2, $3, 'queued', now())`, uuid.Must(uuid.NewV7()), biecID, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("BIEC migration removed a source with collection history")
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
}

func TestWorkshopsCategoryMigrationPreservesInUseVersions(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC before workshops rollback test: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove Atta Galatta before workshops rollback test: %v", err)
	}
	sourceID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f")
	cityID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	runID := uuid.Must(uuid.NewV7())
	eventID := uuid.Must(uuid.NewV7())
	occurrenceID := uuid.Must(uuid.NewV7())
	versionID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, completed_at)
		VALUES ($1, $2, $3, 'published', now(), now())`, runID, sourceID, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO events (id, city_id, slug, canonical_title)
		VALUES ($1, $2, 'workshops-migration-proof', 'Workshops migration proof')`, eventID, cityID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO event_occurrences (
			id, event_id, source_id, source_identity, start_date, time_precision, timezone,
			first_observed_at, last_observed_at
		) VALUES ($1, $2, $3, repeat('d', 64), '2026-09-10', 'date', 'Asia/Kolkata', now(), now())`,
		occurrenceID, eventID, sourceID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO event_versions (
			id, occurrence_id, collection_run_id, fingerprint, title, category, source_url,
			start_date, time_precision, timezone, status, observed_at, canonical_record
		) VALUES ($1, $2, $3, repeat('e', 64), 'Workshops migration proof', 'workshops',
			'https://bangaloreinternationalcentre.org/events/workshops-migration-proof/',
			'2026-09-10', 'date', 'Asia/Kolkata', 'scheduled', now(), '{}'::jsonb)`,
		versionID, occurrenceID, runID); err != nil {
		t.Fatal(err)
	}

	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("workshops migration discarded an in-use event version")
	}
	assertVersion(t, ctx, pool, int64(len(migrations)-2))
	var category string
	if err := pool.QueryRow(ctx, `SELECT category FROM event_versions WHERE id = $1`, versionID).Scan(&category); err != nil {
		t.Fatal(err)
	}
	if category != "workshops" {
		t.Fatalf("preserved category = %q", category)
	}

	for _, deletion := range []struct {
		query string
		id    uuid.UUID
	}{
		{`DELETE FROM event_versions WHERE id = $1`, versionID},
		{`DELETE FROM event_occurrences WHERE id = $1`, occurrenceID},
		{`DELETE FROM events WHERE id = $1`, eventID},
		{`DELETE FROM collection_runs WHERE id = $1`, runID},
	} {
		if _, err := pool.Exec(ctx, deletion.query, deletion.id); err != nil {
			t.Fatal(err)
		}
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)-3))
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, int64(len(migrations)))
}

func TestAliasIdempotencyProvenanceSurvivesAllowedMigrationRoundTrip(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertVersion(t, ctx, pool, 3)
	sourceID := uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f")
	cityID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	eventID := uuid.Must(uuid.NewV7())
	occurrenceID := uuid.Must(uuid.NewV7())
	legacyIdentity := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := pool.Exec(ctx, `
		INSERT INTO events (id, city_id, slug, canonical_title)
		VALUES ($1, $2, 'migration-alias-target', 'Migration alias target')`, eventID, cityID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO event_occurrences (
			id, event_id, source_id, source_identity, start_date, time_precision, timezone,
			first_observed_at, last_observed_at
		) VALUES ($1, $2, $3, $4, '2026-09-10', 'date', 'Asia/Kolkata', now(), now())`,
		occurrenceID, eventID, sourceID, legacyIdentity); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO source_aliases (source_id, old_identity, occurrence_id, reason)
		VALUES ($1, $2, $3, 'Pre-hardening reviewed alias.')`, sourceID, legacyIdentity, occurrenceID); err != nil {
		t.Fatal(err)
	}
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	legacyKey := "legacy-alias-" + legacyIdentity
	assertAliasIdempotencyProvenance(t, ctx, pool, sourceID, legacyIdentity, legacyKey, true)
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC over legacy alias: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove Atta Galatta over legacy alias: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove workshops category over legacy alias: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BHU activation over legacy alias: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove merge migration over legacy alias: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove hardening migration over legacy-only aliases: %v", err)
	}
	assertVersion(t, ctx, pool, 3)
	var legacyRows int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM source_aliases WHERE source_id = $1 AND old_identity = $2`, sourceID, legacyIdentity).Scan(&legacyRows); err != nil {
		t.Fatal(err)
	}
	if legacyRows != 1 {
		t.Fatalf("legacy alias rows after down = %d, want 1", legacyRows)
	}
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	assertAliasIdempotencyProvenance(t, ctx, pool, sourceID, legacyIdentity, legacyKey, true)

	operator := NewOperator(pool)
	customIdentity := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	customKey := "operator-owned-alias-key-0001"
	createdAt := time.Date(2026, time.August, 19, 14, 0, 0, 0, time.UTC)
	created, err := operator.CreateSourceAlias(ctx, sourceID, customIdentity, occurrenceID,
		"Operator-owned prepublication alias.", customKey, "test", uuid.NewString(), createdAt)
	if err != nil {
		t.Fatal(err)
	}
	assertAliasIdempotencyProvenance(t, ctx, pool, sourceID, customIdentity, customKey, false)
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BIEC before custom-key guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove Atta Galatta before custom-key guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove workshops category before custom-key guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove BHU activation before custom-key guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err != nil {
		t.Fatalf("remove merge migration before custom-key guard: %v", err)
	}
	if err := MigrateDown(ctx, pool, migrations); err == nil {
		t.Fatal("hardening migration discarded an operator-owned idempotency key")
	}
	assertVersion(t, ctx, pool, 4)
	assertAliasIdempotencyProvenance(t, ctx, pool, sourceID, customIdentity, customKey, false)
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	reconciled, err := operator.CreateSourceAlias(ctx, sourceID, customIdentity, occurrenceID,
		"Operator-owned prepublication alias.", customKey, "test", uuid.NewString(), createdAt.Add(time.Hour))
	if err != nil || !reconciled.CreatedAt.Equal(created.CreatedAt) {
		t.Fatalf("preserved custom key did not reconcile: %+v, %v; want %+v", reconciled, err, created)
	}
	if _, err := operator.CreateSourceAlias(ctx, sourceID,
		"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", occurrenceID,
		"Different identity must not reuse the key.", customKey, "test", uuid.NewString(), createdAt.Add(2*time.Hour)); !errors.Is(err, sources.ErrConflict) {
		t.Fatalf("reused custom key error = %v, want conflict", err)
	}
}

func assertAliasIdempotencyProvenance(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	sourceID uuid.UUID,
	identity string,
	wantKey string,
	wantLegacy bool,
) {
	t.Helper()
	var key string
	var legacy bool
	if err := pool.QueryRow(ctx, `
		SELECT idempotency_key, idempotency_is_legacy
		FROM source_aliases
		WHERE source_id = $1 AND old_identity = $2`, sourceID, identity).Scan(&key, &legacy); err != nil {
		t.Fatal(err)
	}
	if key != wantKey || legacy != wantLegacy {
		t.Fatalf("alias idempotency provenance = %q/%v, want %q/%v", key, legacy, wantKey, wantLegacy)
	}
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
	var minimumRecords, quarantineBPS, duplicateBPS, lowCountBPS, highCountBPS int
	var registrationHosts, imageHosts []string
	if err := pool.QueryRow(ctx, `
		SELECT minimum_records, maximum_quarantine_ratio_bps, maximum_duplicate_ratio_bps,
			low_count_ratio_bps, high_count_ratio_bps, registration_hosts, image_hosts
		FROM sources WHERE slug = 'bic'`).Scan(&minimumRecords, &quarantineBPS, &duplicateBPS,
		&lowCountBPS, &highCountBPS, &registrationHosts, &imageHosts); err != nil {
		t.Fatal(err)
	}
	if minimumRecords != 1 || quarantineBPS != 200 || duplicateBPS != 100 || lowCountBPS != 4000 || highCountBPS != 25000 ||
		len(registrationHosts) != 1 || registrationHosts[0] != "bangaloreinternationalcentre.org" ||
		len(imageHosts) != 1 || imageHosts[0] != "bangaloreinternationalcentre.org" {
		t.Fatalf("BIC health/URL policy = min %d parse/duplicate/low/high %d/%d/%d/%d registration %v image %v",
			minimumRecords, quarantineBPS, duplicateBPS, lowCountBPS, highCountBPS, registrationHosts, imageHosts)
	}
	assertJagritiMigration(t, ctx, pool, cityID)
	assertBHUActivated(t, ctx, pool)
	assertAttaGalattaMigration(t, ctx, pool)
	assertBIECMigration(t, ctx, pool)
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
	_, err = pool.Exec(ctx, `INSERT INTO event_versions (
		id, occurrence_id, collection_run_id, fingerprint, title, category, source_url, start_date,
		starts_at, time_precision, timezone, status, observed_at, canonical_record
	) VALUES ($1, $2, $3, $4, 'Wrong local date', 'talks', 'https://integration.example.org/events/test/',
		'2026-08-21', '2026-08-20T18:30:00+05:30', 'timed', 'Asia/Kolkata',
		'scheduled', now(), '{}'::jsonb)`, uuid.Must(uuid.NewV7()), occurrenceID, runID,
		"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
	if err == nil {
		t.Fatal("start_date inconsistent with starts_at must violate the database contract")
	}
}

func assertSourceDueTimes(t *testing.T, ctx context.Context, pool *pgxpool.Pool, want map[uuid.UUID]time.Time) {
	t.Helper()
	for sourceID, wantDue := range want {
		var due time.Time
		if err := pool.QueryRow(ctx, `SELECT next_due_at FROM sources WHERE id = $1`, sourceID).Scan(&due); err != nil {
			t.Fatal(err)
		}
		if !due.Equal(wantDue) {
			t.Fatalf("source %s next_due_at = %s, want preserved %s", sourceID, due, wantDue)
		}
	}
}

func sourceRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceIDs []uuid.UUID) map[uuid.UUID]string {
	t.Helper()
	rows := make(map[uuid.UUID]string, len(sourceIDs))
	for _, sourceID := range sourceIDs {
		var row string
		if err := pool.QueryRow(ctx, `SELECT to_jsonb(source)::text FROM sources source WHERE id = $1`, sourceID).Scan(&row); err != nil {
			t.Fatal(err)
		}
		rows[sourceID] = row
	}
	return rows
}

func assertSourceRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, want map[uuid.UUID]string) {
	t.Helper()
	for sourceID, wantRow := range want {
		var got string
		if err := pool.QueryRow(ctx, `SELECT to_jsonb(source)::text FROM sources source WHERE id = $1`, sourceID).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != wantRow {
			t.Fatalf("source %s changed across Atta Galatta migration\ngot: %s\nwant: %s", sourceID, got, wantRow)
		}
	}
}

func assertAttaGalattaMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	var cityID uuid.UUID
	var displayName, canonicalHost, officialURL, manifestVersion, collectorID, schemaVersion, eventIDPattern string
	var collectionInput []byte
	var enabled bool
	var freshnessTTL, cadence, pageLimit, recordLimit, dailyRunLimit, absenceThreshold int
	var publicationState string
	var nextDueAt *time.Time
	var lastHealthyAt *time.Time
	var minimumRecords, quarantineBPS, duplicateBPS, lowCountBPS, highCountBPS int
	var registrationHosts, imageHosts []string
	err := pool.QueryRow(ctx, `
		SELECT city_id, display_name, canonical_host, official_url, manifest_version,
			collector_id, schema_version, collection_input, source_event_id_pattern, enabled,
			freshness_ttl_seconds, cadence_seconds, page_limit, record_limit, daily_run_limit,
			absence_threshold, publication_state, next_due_at, last_healthy_at,
			minimum_records, maximum_quarantine_ratio_bps, maximum_duplicate_ratio_bps,
			low_count_ratio_bps, high_count_ratio_bps, registration_hosts, image_hosts
		FROM sources
		WHERE id = '854afb9d-c219-5f8f-b8a5-f0b8b24ae799' AND slug = 'atta-galatta'`).Scan(
		&cityID, &displayName, &canonicalHost, &officialURL, &manifestVersion,
		&collectorID, &schemaVersion, &collectionInput, &eventIDPattern, &enabled,
		&freshnessTTL, &cadence, &pageLimit, &recordLimit, &dailyRunLimit,
		&absenceThreshold, &publicationState, &nextDueAt, &lastHealthyAt,
		&minimumRecords, &quarantineBPS, &duplicateBPS, &lowCountBPS, &highCountBPS,
		&registrationHosts, &imageHosts,
	)
	if err != nil {
		t.Fatal(err)
	}
	var input map[string]string
	if err := json.Unmarshal(collectionInput, &input); err != nil {
		t.Fatal(err)
	}
	if cityID != uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d") ||
		displayName != "Atta Galatta" || canonicalHost != "attagalatta.com" ||
		officialURL != "https://attagalatta.com/calendarpage.php" || manifestVersion != "source-manifest/v1" ||
		collectorID != "c_mt006uf51wdkssg1lh" || schemaVersion != "event-occurrence/v1" ||
		input["url"] != "https://attagalatta.com/events.php" || eventIDPattern != `^EVT[0-9]+$` || !enabled ||
		freshnessTTL != 43200 || cadence != 14400 || pageLimit != 1 || recordLimit != 100 || dailyRunLimit != 6 ||
		absenceThreshold != 2 || publicationState != "active" || nextDueAt == nil || lastHealthyAt != nil ||
		minimumRecords != 3 || quarantineBPS != 0 || duplicateBPS != 0 || lowCountBPS != 5000 || highCountBPS != 20000 ||
		len(registrationHosts) != 0 || len(imageHosts) != 1 || imageHosts[0] != "attagalatta.com" {
		t.Fatalf("unexpected Atta Galatta runtime policy: city=%s name=%q host=%q url=%q manifest=%q collector=%q schema=%q input=%v pattern=%q enabled=%v ttl/cadence/pages/records/daily/absence=%d/%d/%d/%d/%d/%d state=%q next=%v healthy=%v min/parse/duplicate/low/high=%d/%d/%d/%d/%d registration=%v images=%v",
			cityID, displayName, canonicalHost, officialURL, manifestVersion, collectorID, schemaVersion,
			input, eventIDPattern, enabled, freshnessTTL, cadence, pageLimit, recordLimit, dailyRunLimit,
			absenceThreshold, publicationState, nextDueAt, lastHealthyAt, minimumRecords, quarantineBPS,
			duplicateBPS, lowCountBPS, highCountBPS, registrationHosts, imageHosts)
	}
}

func assertBIECMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	var cityID uuid.UUID
	var displayName, canonicalHost, officialURL, manifestVersion, collectorID, schemaVersion string
	var collectionInput []byte
	var sourceEventIDPattern *string
	var enabled bool
	var freshnessTTL, cadence, pageLimit, recordLimit, dailyRunLimit, absenceThreshold int
	var publicationState string
	var nextDueAt *time.Time
	var lastHealthyAt *time.Time
	var minimumRecords, quarantineBPS, duplicateBPS, lowCountBPS, highCountBPS int
	var registrationHosts, imageHosts []string
	err := pool.QueryRow(ctx, `
		SELECT city_id, display_name, canonical_host, official_url, manifest_version,
			collector_id, schema_version, collection_input, source_event_id_pattern, enabled,
			freshness_ttl_seconds, cadence_seconds, page_limit, record_limit, daily_run_limit,
			absence_threshold, publication_state, next_due_at, last_healthy_at,
			minimum_records, maximum_quarantine_ratio_bps, maximum_duplicate_ratio_bps,
			low_count_ratio_bps, high_count_ratio_bps, registration_hosts, image_hosts
		FROM sources
		WHERE id = '520e6232-ab55-5c71-8918-bb68a659ae61' AND slug = 'biec'`).Scan(
		&cityID, &displayName, &canonicalHost, &officialURL, &manifestVersion,
		&collectorID, &schemaVersion, &collectionInput, &sourceEventIDPattern, &enabled,
		&freshnessTTL, &cadence, &pageLimit, &recordLimit, &dailyRunLimit,
		&absenceThreshold, &publicationState, &nextDueAt, &lastHealthyAt,
		&minimumRecords, &quarantineBPS, &duplicateBPS, &lowCountBPS, &highCountBPS,
		&registrationHosts, &imageHosts,
	)
	if err != nil {
		t.Fatal(err)
	}
	var input map[string]string
	if err := json.Unmarshal(collectionInput, &input); err != nil {
		t.Fatal(err)
	}
	if cityID != uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d") ||
		displayName != "Bangalore International Exhibition Centre" || canonicalHost != "www.biec.in" ||
		officialURL != "https://www.biec.in/events" || manifestVersion != "source-manifest/v1" ||
		collectorID != "c_mt199f5m1k5i18ud1i" || schemaVersion != "event-occurrence/v1" ||
		input["url"] != "https://www.biec.in/events" || sourceEventIDPattern != nil || !enabled ||
		freshnessTTL != 43200 || cadence != 21600 || pageLimit != 1 || recordLimit != 50 || dailyRunLimit != 4 ||
		absenceThreshold != 2 || publicationState != "active" || nextDueAt == nil || lastHealthyAt != nil ||
		minimumRecords != 3 || quarantineBPS != 0 || duplicateBPS != 0 || lowCountBPS != 5000 || highCountBPS != 20000 ||
		len(registrationHosts) != 0 || len(imageHosts) != 1 || imageHosts[0] != "www.biec.in" {
		t.Fatalf("unexpected BIEC runtime policy: city=%s name=%q host=%q url=%q manifest=%q collector=%q schema=%q input=%v pattern=%v enabled=%v ttl/cadence/pages/records/daily/absence=%d/%d/%d/%d/%d/%d state=%q next=%v healthy=%v min/parse/duplicate/low/high=%d/%d/%d/%d/%d registration=%v images=%v",
			cityID, displayName, canonicalHost, officialURL, manifestVersion, collectorID, schemaVersion,
			input, sourceEventIDPattern, enabled, freshnessTTL, cadence, pageLimit, recordLimit, dailyRunLimit,
			absenceThreshold, publicationState, nextDueAt, lastHealthyAt, minimumRecords, quarantineBPS,
			duplicateBPS, lowCountBPS, highCountBPS, registrationHosts, imageHosts)
	}
}

func assertBHUActivated(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	var cityEnabled, sourceEnabled bool
	if err := pool.QueryRow(ctx, `
		SELECT city.enabled, source.enabled
		FROM cities city
		JOIN sources source ON source.city_id = city.id
		WHERE city.id = '019c5d13-c392-79d2-9012-3ed4242f771e'
		  AND city.slug = 'varanasi'
		  AND source.id = 'bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd'
		  AND source.slug = 'bhu-academic-events'`).Scan(&cityEnabled, &sourceEnabled); err != nil {
		t.Fatal(err)
	}
	if !cityEnabled || !sourceEnabled {
		t.Fatalf("BHU city/source activation = %v/%v, want true/true", cityEnabled, sourceEnabled)
	}
}

func assertJagritiMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool, cityID uuid.UUID) {
	t.Helper()
	var gotCityID uuid.UUID
	var displayName, canonicalHost, officialURL, manifestVersion, collectorID, schemaVersion string
	var collectionInput []byte
	var sourceEventIDPattern *string
	var enabled bool
	var freshnessTTL, cadence, pageLimit, recordLimit, dailyRunLimit, absenceThreshold int
	var publicationState string
	var nextDueAt *time.Time
	var lastHealthyAt *time.Time
	err := pool.QueryRow(ctx, `
		SELECT city_id, display_name, canonical_host, official_url, manifest_version,
			collector_id, schema_version, collection_input, source_event_id_pattern, enabled,
			freshness_ttl_seconds, cadence_seconds, page_limit, record_limit, daily_run_limit,
			absence_threshold, publication_state, next_due_at, last_healthy_at
		FROM sources
		WHERE id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f' AND slug = 'jagriti'`).Scan(
		&gotCityID, &displayName, &canonicalHost, &officialURL, &manifestVersion,
		&collectorID, &schemaVersion, &collectionInput, &sourceEventIDPattern, &enabled,
		&freshnessTTL, &cadence, &pageLimit, &recordLimit, &dailyRunLimit,
		&absenceThreshold, &publicationState, &nextDueAt, &lastHealthyAt,
	)
	if err != nil {
		t.Fatal(err)
	}
	var input map[string]string
	if err := json.Unmarshal(collectionInput, &input); err != nil {
		t.Fatal(err)
	}
	if gotCityID != cityID || displayName != "Jagriti Theatre" || canonicalHost != "www.jagrititheatre.com" ||
		officialURL != "https://www.jagrititheatre.com/" || manifestVersion != "source-manifest/v1" ||
		collectorID != "c_msywx7up19xi1xi8v" || schemaVersion != "event-occurrence/v1" ||
		input["url"] != "https://www.jagrititheatre.com/jagriti-events-collections" || sourceEventIDPattern != nil || !enabled ||
		freshnessTTL != 43200 || cadence != 21600 || pageLimit != 26 || recordLimit != 50 || dailyRunLimit != 4 ||
		absenceThreshold != 2 || publicationState != "active" || nextDueAt == nil || lastHealthyAt != nil {
		t.Fatalf("unexpected Jagriti launch policy: city=%s name=%q host=%q url=%q manifest=%q collector=%q schema=%q input=%v pattern=%v enabled=%v ttl/cadence/pages/records/daily/absence=%d/%d/%d/%d/%d/%d state=%q next=%v healthy=%v",
			gotCityID, displayName, canonicalHost, officialURL, manifestVersion, collectorID, schemaVersion,
			input, sourceEventIDPattern, enabled, freshnessTTL, cadence, pageLimit, recordLimit, dailyRunLimit,
			absenceThreshold, publicationState, nextDueAt, lastHealthyAt)
	}
}
