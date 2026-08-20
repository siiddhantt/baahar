package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/platform/postgres"
	objectstore "github.com/siiddhantt/baahar/internal/platform/s3"
)

func TestProcessorPublishesExactMinIORawBytesToPostgresAndReplays(t *testing.T) {
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	objectEndpoint := os.Getenv("BAAHAR_TEST_S3_ENDPOINT")
	if databaseURL == "" || objectEndpoint == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL and BAAHAR_TEST_S3_ENDPOINT are required for the worker integration test")
	}
	ctx, pool := migratedWorkerPool(t, databaseURL)
	objects, err := objectstore.Open(objectstore.Config{
		Endpoint:  objectEndpoint,
		AccessKey: os.Getenv("BAAHAR_TEST_S3_ACCESS_KEY"),
		SecretKey: os.Getenv("BAAHAR_TEST_S3_SECRET_KEY"),
		Bucket:    "baahar-test-raw",
		Region:    "us-east-1",
		PathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := objects.EnsureBucket(ctx); err != nil {
		t.Fatal(err)
	}
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	sourceID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f")
	runID := uuid.Must(uuid.NewV7())
	now := time.Date(2026, time.August, 18, 13, 0, 0, 0, time.UTC)
	_, err = pool.Exec(ctx, `
		INSERT INTO collection_runs (
			id, source_id, external_collection_id, trace_id, status, triggered_at
		) VALUES ($1, $2, 'd_worker_integration', $3, 'collecting', $4)`,
		runID, sourceID, uuid.NewString(), now.Add(-2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	dataset := integrationBrightDataset(t)
	bright := &fakeBright{datasets: []datasetResult{{content: dataset, ready: true}}}
	clock := now
	processor := &Processor{
		Bright:      bright,
		Objects:     objects,
		Sources:     postgres.NewSourceConfigs(pool),
		Runs:        postgres.NewRuns(pool),
		Publication: postgres.NewPublication(pool),
		Validator:   validator,
		Now:         func() time.Time { return clock },
	}
	payload, _ := json.Marshal(collections.CollectionJobPayload{RunID: runID, SourceID: sourceID})
	if err := processor.Process(ctx, collections.Job{Kind: "collect-source", Payload: payload}); err != nil {
		t.Fatal(err)
	}
	run, err := postgres.NewRuns(pool).Find(ctx, runID)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != collections.RunPublished || run.AcceptedCount != 1 || run.QuarantinedCount != 0 || run.RawObjectKey == nil {
		t.Fatalf("unexpected published run: %+v", run)
	}
	raw, snapshot, err := objects.Get(ctx, *run.RawObjectKey)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(raw, dataset) || snapshot.SHA256 != *run.RawSHA256 || snapshot.Bytes != *run.RawBytes {
		t.Fatal("PostgreSQL evidence does not match exact MinIO raw bytes")
	}
	var occurrenceID uuid.UUID
	var versionCount int
	if err := pool.QueryRow(ctx, `SELECT id FROM event_occurrences WHERE source_id = $1`, sourceID).Scan(&occurrenceID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_versions WHERE occurrence_id = $1`, occurrenceID).Scan(&versionCount); err != nil {
		t.Fatal(err)
	}
	if versionCount != 1 {
		t.Fatalf("event versions = %d, want 1", versionCount)
	}
	var collectionFreshness time.Time
	if err := pool.QueryRow(ctx, `SELECT last_healthy_at FROM sources WHERE id = $1`, sourceID).Scan(&collectionFreshness); err != nil {
		t.Fatal(err)
	}

	operator := postgres.NewOperator(pool)
	replay, err := operator.QueueReplay(ctx, runID, "worker-integration-replay", "test", uuid.NewString(), now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	replayPayload, _ := json.Marshal(collections.CollectionJobPayload{
		RunID: replay.ID, SourceID: sourceID, OriginalRunID: &runID,
	})
	clock = now.Add(2 * time.Minute)
	if err := processor.Process(ctx, collections.Job{Kind: "replay-run", Payload: replayPayload}); err != nil {
		t.Fatal(err)
	}
	if bright.triggerCalls != 0 || bright.datasetCalls != 1 {
		t.Fatal("immutable replay contacted Bright Data")
	}
	if err := processor.Process(ctx, collections.Job{Kind: "replay-run", Payload: replayPayload}); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_versions WHERE occurrence_id = $1`, occurrenceID).Scan(&versionCount); err != nil {
		t.Fatal(err)
	}
	if versionCount != 1 {
		t.Fatalf("idempotent replay created %d versions", versionCount)
	}
	var replayFreshness time.Time
	if err := pool.QueryRow(ctx, `SELECT last_healthy_at FROM sources WHERE id = $1`, sourceID).Scan(&replayFreshness); err != nil {
		t.Fatal(err)
	}
	if !replayFreshness.Equal(collectionFreshness) {
		t.Fatalf("replay changed source freshness from %s to %s", collectionFreshness, replayFreshness)
	}
}

func migratedWorkerPool(t *testing.T, databaseURL string) (context.Context, *pgxpool.Pool) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := "baahar_worker_" + uuid.NewString()[:8]
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
	t.Cleanup(pool.Close)
	migrations, err := postgres.ReadMigrations(os.DirFS("../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if err := postgres.MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	return ctx, pool
}

func integrationBrightDataset(t *testing.T) []byte {
	t.Helper()
	record, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err := json.Unmarshal(record, &fields); err != nil {
		t.Fatal(err)
	}
	fields["source_event_id"] = "12345"
	fields["language"] = []any{}
	fields["input"] = map[string]any{"url": "https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}
	encoded, err := json.Marshal(fields)
	if err != nil {
		t.Fatal(err)
	}
	dataset := append([]byte{'['}, encoded...)
	return append(dataset, ']')
}
