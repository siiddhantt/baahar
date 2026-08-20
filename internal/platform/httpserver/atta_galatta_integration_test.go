package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/events"
	"github.com/siiddhantt/baahar/internal/platform/postgres"
)

var attaGalattaReviewedIDs = []string{
	"EVT2080", "EVT2059", "EVT2083", "EVT2042", "EVT2071", "EVT2046", "EVT2057",
	"EVT2070", "EVT2069", "EVT2087", "EVT2062", "EVT2004", "EVT2089", "EVT2074",
	"EVT1999", "EVT2088", "EVT2048", "EVT2085", "EVT2047", "EVT2064", "EVT2096",
	"EVT2094", "EVT2095", "EVT2065", "EVT2045", "EVT2081", "EVT2090", "EVT2035",
	"EVT2082", "EVT2060", "EVT2066", "EVT2061", "EVT2068", "EVT2073", "EVT2092",
	"EVT2079", "EVT2084", "EVT2020", "EVT2091", "EVT2078", "EVT2093", "EVT2086",
}

func TestAttaGalattaTransportNormalizesPersistsAndServesReviewedHorizon(t *testing.T) {
	ctx, pool := attaGalattaIntegrationPool(t)
	source, err := postgres.NewSourceConfigs(pool).Get(ctx, uuid.MustParse("854afb9d-c219-5f8f-b8a5-f0b8b24ae799"))
	if err != nil {
		t.Fatal(err)
	}
	observedAt := time.Date(2026, time.August, 20, 0, 0, 0, 0, time.UTC)
	transport := attaGalattaTransportDataset(t, source.CollectionInput, observedAt)
	canonical, err := collections.CanonicalizeBrightDataset(transport, source.CollectionInput)
	if err != nil {
		t.Fatal(err)
	}
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	prepared, err := collections.PrepareDataset(canonical, collections.SourcePolicy{
		ID: source.ID, CitySlug: source.CitySlug, CanonicalHost: source.CanonicalHost,
		SchemaVersion: source.SchemaVersion, SourceEventIDPattern: source.SourceEventIDPattern,
		RecordLimit: source.RecordLimit, MinimumRecords: source.MinimumRecords,
		MaximumQuarantineRatioBPS: source.MaximumQuarantineRatioBPS,
		MaximumDuplicateRatioBPS:  source.MaximumDuplicateRatioBPS,
		LowCountRatioBPS:          source.LowCountRatioBPS,
		HighCountRatioBPS:         source.HighCountRatioBPS,
		RegistrationHosts:         source.RegistrationHosts, ImageHosts: source.ImageHosts,
		ObservationEarliest: observedAt.Add(-5 * time.Minute),
		ObservationLatest:   observedAt.Add(5 * time.Minute),
	}, validator)
	if err != nil {
		t.Fatal(err)
	}
	if prepared.HealthCode != "" || len(prepared.Candidates) != len(attaGalattaReviewedIDs) || len(prepared.Quarantined) != 0 {
		t.Fatalf("Atta Galatta preparation = %+v, want %d healthy candidates", prepared, len(attaGalattaReviewedIDs))
	}

	runID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, 'validating', $4, $5)`, runID, source.ID, uuid.NewString(), observedAt, len(attaGalattaReviewedIDs)); err != nil {
		t.Fatal(err)
	}
	completedAt := observedAt.Add(time.Minute)
	if err := postgres.NewPublication(pool).Publish(ctx, runID, source, prepared, completedAt); err != nil {
		t.Fatal(err)
	}
	assertAttaGalattaPersistence(t, ctx, pool, source.ID, runID)

	server := &Server{events: postgres.NewEvents(pool), logger: slog.Default(), now: func() time.Time { return completedAt }}
	feedResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(feedResponse, httptest.NewRequest(http.MethodGet, "/v1/events?city=bengaluru&limit=60", nil))
	if feedResponse.Code != http.StatusOK {
		t.Fatalf("feed status = %d, body = %s", feedResponse.Code, feedResponse.Body.String())
	}
	var page eventPageDTO
	if err := json.Unmarshal(feedResponse.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 42 || page.Meta.ResultCount != 42 || page.Meta.SourceCount != 1 || page.NextCursor != nil {
		t.Fatalf("Atta Galatta public page items/results/sources/cursor = %d/%d/%d/%v", len(page.Items), page.Meta.ResultCount, page.Meta.SourceCount, page.NextCursor)
	}
	for _, item := range page.Items {
		if item.City.Slug != "bengaluru" || item.Source.Slug != "atta-galatta" ||
			item.Source.Host != "attagalatta.com" || item.Category != "other" ||
			item.Timing.Precision != "timed" || item.Timing.Timezone != "Asia/Kolkata" ||
			item.Status != "scheduled" || item.Venue != nil || item.Pricing.IsFree != nil ||
			item.Pricing.MinimumMinor != nil || item.Pricing.MaximumMinor != nil || item.Pricing.Currency != nil ||
			item.Registration.URL != nil || item.Registration.State != nil || item.ImageURL == nil ||
			!strings.HasPrefix(*item.ImageURL, "https://attagalatta.com/admin/uploads/events/") ||
			item.AgeNote != nil || item.AccessibilityNote != nil || len(item.Language) != 0 {
			t.Fatalf("Atta Galatta public event lost reviewed facts/nullability: %+v", item)
		}
	}

	first := page.Items[0]
	for path, contentType := range map[string]string{
		"/v1/events/" + first.ID:           "application/json",
		"/v1/events/" + first.ID + ".ics":  "text/calendar",
		"/v1/sources/atta-galatta/summary": "application/json",
	} {
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK || !strings.HasPrefix(response.Header().Get("Content-Type"), contentType) {
			t.Fatalf("GET %s = %d/%q, body = %s", path, response.Code, response.Header().Get("Content-Type"), response.Body.String())
		}
	}
}

func attaGalattaIntegrationPool(t *testing.T) (context.Context, *pgxpool.Pool) {
	t.Helper()
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL Atta Galatta test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := "baahar_atta_http_" + uuid.NewString()[:8]
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
	migrations, err := postgres.ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if err := postgres.MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	return ctx, pool
}

func attaGalattaTransportDataset(t *testing.T, collectionInput json.RawMessage, observedAt time.Time) []byte {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	records := make([]map[string]json.RawMessage, len(attaGalattaReviewedIDs))
	for index, sourceEventID := range attaGalattaReviewedIDs {
		start := time.Date(2026, time.August, 21, 10, 0, 0, 0, location).AddDate(0, 0, index)
		date := start.Format(time.DateOnly)
		imageURL := fmt.Sprintf("https://attagalatta.com/admin/uploads/events/%s.jpg", strings.TrimPrefix(sourceEventID, "EVT"))
		record := collections.CollectorRecord{
			SchemaVersion: "event-occurrence/v1", SourceEventID: &sourceEventID,
			SourceURL:  "https://attagalatta.com/event_page.php?eventid=" + sourceEventID,
			SourceHost: "attagalatta.com", CitySlug: "bengaluru", Title: "Reviewed Atta Galatta event " + sourceEventID,
			Category: events.CategoryOther, StartDate: date, StartsAt: &start,
			TimePrecision: events.TimePrecisionTimed, Timezone: "Asia/Kolkata", Status: events.StatusScheduled,
			Language: []string{}, ImageURL: &imageURL, ObservedAt: observedAt,
		}
		canonical, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(canonical, &fields); err != nil {
			t.Fatal(err)
		}
		fields["input"] = append(json.RawMessage(nil), collectionInput...)
		records[index] = fields
	}
	dataset, err := json.Marshal(records)
	if err != nil {
		t.Fatal(err)
	}
	return dataset
}

func assertAttaGalattaPersistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID, runID uuid.UUID) {
	t.Helper()
	var status string
	var accepted, quarantined int
	if err := pool.QueryRow(ctx, `SELECT status, accepted_count, quarantined_count FROM collection_runs WHERE id = $1`, runID).Scan(&status, &accepted, &quarantined); err != nil {
		t.Fatal(err)
	}
	if status != "published" || accepted != 42 || quarantined != 0 {
		t.Fatalf("Atta Galatta run status/accepted/quarantined = %q/%d/%d", status, accepted, quarantined)
	}
	rows, err := pool.Query(ctx, `
		SELECT version.canonical_record->>'source_event_id', occurrence.source_identity,
			version.category, version.image_url,
			version.is_free IS NULL AND version.price_min_minor IS NULL AND version.price_max_minor IS NULL
				AND version.currency IS NULL AND version.venue_name IS NULL AND version.venue_address IS NULL
				AND version.registration_url IS NULL AND version.registration_state IS NULL
				AND version.age_note IS NULL AND version.accessibility_note IS NULL
				AND version.end_date IS NULL AND version.ends_at IS NULL AND cardinality(version.languages) = 0
		FROM event_occurrences occurrence
		JOIN event_versions version ON version.id = occurrence.current_version_id
		WHERE occurrence.source_id = $1
		ORDER BY version.canonical_record->>'source_event_id'`, sourceID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	ids := make([]string, 0, 42)
	for rows.Next() {
		var sourceEventID, sourceIdentity, category, imageURL string
		var nullsPreserved bool
		if err := rows.Scan(&sourceEventID, &sourceIdentity, &category, &imageURL, &nullsPreserved); err != nil {
			t.Fatal(err)
		}
		wantIdentity, err := events.Identity(events.IdentityInput{SourceID: sourceID, SourceEventID: sourceEventID})
		if err != nil {
			t.Fatal(err)
		}
		if sourceIdentity != wantIdentity || category != "other" ||
			!strings.HasPrefix(imageURL, "https://attagalatta.com/admin/uploads/events/") || !nullsPreserved {
			t.Fatalf("Atta Galatta persisted record = id %s identity %s category %s image %s nulls %v", sourceEventID, sourceIdentity, category, imageURL, nullsPreserved)
		}
		ids = append(ids, sourceEventID)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	wantIDs := append([]string(nil), attaGalattaReviewedIDs...)
	slices.Sort(wantIDs)
	if !slices.Equal(ids, wantIDs) {
		t.Fatalf("Atta Galatta persisted IDs = %v, want %v", ids, wantIDs)
	}
}
