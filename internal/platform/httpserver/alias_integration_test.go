package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/platform/postgres"
)

func TestOperatorAliasHTTPIsIdempotentAgainstPostgres(t *testing.T) {
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL HTTP test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "baahar_alias_http_" + uuid.NewString()[:8]
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_, _ = admin.Exec(cleanup, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
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
	migrations, err := postgres.ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if err := postgres.MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	sourceID := uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f")
	cityID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	eventID := uuid.Must(uuid.NewV7())
	occurrenceID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO events (id, city_id, slug, canonical_title)
		VALUES ($1, $2, 'alias-http-event', 'Alias HTTP event')`, eventID, cityID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO event_occurrences (
			id, event_id, source_id, source_identity, start_date, time_precision, timezone,
			first_observed_at, last_observed_at
		) VALUES ($1, $2, $3, $4, '2026-09-05', 'date', 'Asia/Kolkata', $5, $5)`,
		occurrenceID, eventID, sourceID,
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		time.Date(2026, time.August, 19, 12, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	duplicateEventID := uuid.Must(uuid.NewV7())
	duplicateOccurrenceID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO events (id, city_id, slug, canonical_title)
		VALUES ($1, $2, 'alias-http-duplicate', 'Alias HTTP duplicate')`, duplicateEventID, cityID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO event_occurrences (
			id, event_id, source_id, source_identity, start_date, time_precision, timezone,
			first_observed_at, last_observed_at
		) VALUES ($1, $2, $3, $4, '2026-09-05', 'date', 'Asia/Kolkata', $5, $5)`,
		duplicateOccurrenceID, duplicateEventID, sourceID,
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		time.Date(2026, time.August, 19, 12, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	runID := uuid.Must(uuid.NewV7())
	targetVersionID := uuid.Must(uuid.NewV7())
	duplicateVersionID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (
			id, source_id, trace_id, status, triggered_at, completed_at, received_count, accepted_count
		) VALUES ($1, $2, $3, 'published', $4, $5, 2, 2)`, runID, sourceID, uuid.NewString(),
		time.Date(2026, time.August, 19, 12, 0, 0, 0, time.UTC), time.Date(2026, time.August, 19, 12, 1, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	for _, version := range []struct {
		id           uuid.UUID
		occurrenceID uuid.UUID
		fingerprint  string
		title        string
	}{
		{targetVersionID, occurrenceID, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", "Alias HTTP event"},
		{duplicateVersionID, duplicateOccurrenceID, "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "Alias HTTP duplicate"},
	} {
		if _, err := pool.Exec(ctx, `
			INSERT INTO event_versions (
				id, occurrence_id, collection_run_id, fingerprint, title, category, source_url,
				start_date, time_precision, timezone, is_free, status, observed_at, canonical_record
			) VALUES ($1, $2, $3, $4, $5, 'theatre', 'https://www.jagrititheatre.com/jagriti-events-collections',
				'2026-09-05', 'date', 'Asia/Kolkata', true, 'scheduled', $6, '{}'::jsonb)`,
			version.id, version.occurrenceID, runID, version.fingerprint, version.title,
			time.Date(2026, time.August, 19, 12, 0, 0, 0, time.UTC)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `
		UPDATE event_occurrences SET current_version_id = $2 WHERE id = $1`, occurrenceID, targetVersionID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		UPDATE event_occurrences SET current_version_id = $2 WHERE id = $1`, duplicateOccurrenceID, duplicateVersionID); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, time.August, 19, 12, 30, 0, 0, time.UTC)
	server := &Server{
		operatorToken: "operator-token-with-enough-bytes", operator: postgres.NewOperator(pool),
		logger: slog.Default(), now: func() time.Time { return now },
	}
	body := []byte(`{"incoming_identity":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","occurrence_id":"` + occurrenceID.String() + `","reason":"Reviewed official correction."}`)
	for range 2 {
		response := performAliasRequest(server.Handler(), sourceID, body, "alias-http-key-0001")
		if response.Code != http.StatusCreated {
			t.Fatalf("idempotent alias status = %d, body = %s", response.Code, response.Body.String())
		}
		var alias sourceAliasDTO
		if err := json.Unmarshal(response.Body.Bytes(), &alias); err != nil {
			t.Fatal(err)
		}
		if alias.MergedOccurrenceID == nil || *alias.MergedOccurrenceID != duplicateOccurrenceID.String() {
			t.Fatalf("HTTP merged occurrence = %v, want %s", alias.MergedOccurrenceID, duplicateOccurrenceID)
		}
	}
	var aliases, audits, merged int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM source_aliases WHERE source_id = $1`, sourceID).Scan(&aliases); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM operator_audit_log WHERE action = 'create_source_alias'`).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_occurrences WHERE merged_into_occurrence_id = $1`, occurrenceID).Scan(&merged); err != nil {
		t.Fatal(err)
	}
	if aliases != 1 || audits != 1 || merged != 1 {
		t.Fatalf("aliases/audits/merged = %d/%d/%d, want 1/1/1", aliases, audits, merged)
	}
	publicServer := &Server{events: postgres.NewEvents(pool), logger: slog.Default(), now: func() time.Time { return now }}
	for path, contentType := range map[string]string{
		"/v1/events/" + duplicateOccurrenceID.String():              "application/json",
		"/v1/events/" + duplicateOccurrenceID.String() + "/changes": "application/json",
		"/v1/events/" + duplicateOccurrenceID.String() + ".ics":     "text/calendar",
	} {
		response := httptest.NewRecorder()
		publicServer.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK || !bytes.Contains([]byte(response.Header().Get("Content-Type")), []byte(contentType)) {
			t.Fatalf("old-ID public route %s status/type = %d/%q, body = %s", path, response.Code, response.Header().Get("Content-Type"), response.Body.String())
		}
		if bytes.HasSuffix([]byte(path), []byte(".ics")) && !bytes.Contains([]byte(response.Header().Get("Content-Disposition")), []byte(occurrenceID.String())) {
			t.Fatalf("old-ID calendar did not resolve canonical filename: %q", response.Header().Get("Content-Disposition"))
		}
	}
	conflictBody := bytes.Replace(body, []byte("Reviewed official correction."), []byte("Different review."), 1)
	conflict := performAliasRequest(server.Handler(), sourceID, conflictBody, "alias-http-key-0001")
	if conflict.Code != http.StatusConflict {
		t.Fatalf("alias conflict status = %d, body = %s", conflict.Code, conflict.Body.String())
	}
}

func performAliasRequest(handler http.Handler, sourceID uuid.UUID, body []byte, idempotencyKey string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/v1/operator/sources/"+sourceID.String()+"/aliases", bytes.NewReader(body))
	request.Header.Set("Authorization", "Bearer operator-token-with-enough-bytes")
	request.Header.Set("Idempotency-Key", idempotencyKey)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}
