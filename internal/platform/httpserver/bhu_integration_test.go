package httpserver

import (
	"context"
	"encoding/json"
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
	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/events"
	"github.com/siddhantk232/baahar/internal/platform/postgres"
	"github.com/siddhantk232/baahar/internal/sources"
)

var bhuReviewedIDs = []string{"6386", "6383", "6382", "6389", "6385", "6381", "6397", "6396", "6376", "6387"}

func TestBHUTransportNormalizesPersistsAndServesTenOccurrences(t *testing.T) {
	ctx, pool := bhuIntegrationPool(t)
	source, err := postgres.NewSourceConfigs(pool).Get(ctx, uuid.MustParse("bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd"))
	if err != nil {
		t.Fatal(err)
	}
	observedAt := time.Date(2026, time.August, 19, 10, 0, 0, 0, time.UTC)
	transport := bhuTransportDataset(t, source, observedAt)
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
	if prepared.HealthCode != "" || len(prepared.Candidates) != 10 || len(prepared.Quarantined) != 0 {
		t.Fatalf("BHU preparation = %+v, want ten healthy candidates", prepared)
	}

	runID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, 'validating', $4, 10)`, runID, source.ID, uuid.NewString(), observedAt); err != nil {
		t.Fatal(err)
	}
	completedAt := observedAt.Add(time.Minute)
	if err := postgres.NewPublication(pool).Publish(ctx, runID, source, prepared, completedAt); err != nil {
		t.Fatal(err)
	}
	assertBHUPersistence(t, ctx, pool, source.ID, runID)

	server := &Server{events: postgres.NewEvents(pool), logger: slog.Default(), now: func() time.Time { return completedAt }}
	cityResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(cityResponse, httptest.NewRequest(http.MethodGet, "/v1/cities", nil))
	if cityResponse.Code != http.StatusOK {
		t.Fatalf("city status = %d, body = %s", cityResponse.Code, cityResponse.Body.String())
	}
	var cities struct {
		Items []cityDTO `json:"items"`
	}
	if err := json.Unmarshal(cityResponse.Body.Bytes(), &cities); err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(cities.Items, func(city cityDTO) bool { return city.Slug == "varanasi" && city.Name == "Varanasi" }) {
		t.Fatalf("published cities = %+v, want Varanasi", cities.Items)
	}

	feedResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(feedResponse, httptest.NewRequest(http.MethodGet, "/v1/events?city=varanasi&limit=24", nil))
	if feedResponse.Code != http.StatusOK {
		t.Fatalf("feed status = %d, body = %s", feedResponse.Code, feedResponse.Body.String())
	}
	var page eventPageDTO
	if err := json.Unmarshal(feedResponse.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 10 || page.Meta.ResultCount != 10 || page.Meta.SourceCount != 1 || page.NextCursor != nil {
		t.Fatalf("BHU public page items/results/sources/cursor = %d/%d/%d/%v", len(page.Items), page.Meta.ResultCount, page.Meta.SourceCount, page.NextCursor)
	}
	registrations := 0
	categoryCounts := make(map[string]int)
	for _, item := range page.Items {
		categoryCounts[item.Category]++
		if item.City.Slug != "varanasi" || item.Source.Slug != "bhu-academic-events" ||
			item.Source.Host != "www.bhu.ac.in" || item.Timing.Precision != "timed" ||
			item.Timing.Timezone != "Asia/Kolkata" || item.Status != "scheduled" || item.Venue == nil ||
			item.Venue.Address != nil || item.Pricing.IsFree != nil || item.Pricing.MinimumMinor != nil ||
			item.Pricing.MaximumMinor != nil || item.Pricing.Currency != nil || item.ImageURL != nil ||
			item.AgeNote != nil || item.AccessibilityNote != nil || len(item.Language) != 0 {
			t.Fatalf("BHU public event lost reviewed facts/nullability: %+v", item)
		}
		if item.Registration.URL != nil {
			registrations++
			if !strings.HasPrefix(*item.Registration.URL, "https://forms.gle/") || item.Registration.State != nil {
				t.Fatalf("BHU registration = %+v", item.Registration)
			}
		}
	}
	if registrations != 1 {
		t.Fatalf("BHU public registrations = %d, want 1", registrations)
	}
	if categoryCounts["workshops"] != 4 || categoryCounts["talks"] != 4 || categoryCounts["other"] != 2 {
		t.Fatalf("BHU public categories = %v", categoryCounts)
	}
}

func bhuIntegrationPool(t *testing.T) (context.Context, *pgxpool.Pool) {
	t.Helper()
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL BHU test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := "baahar_bhu_http_" + uuid.NewString()[:8]
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

func bhuTransportDataset(t *testing.T, source sources.Config, observedAt time.Time) []byte {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	records := make([]map[string]json.RawMessage, len(bhuReviewedIDs))
	for index, sourceEventID := range bhuReviewedIDs {
		start := time.Date(2026, time.September, index+1, 10, 0, 0, 0, location)
		end := start.Add(90 * time.Minute)
		date := start.Format(time.DateOnly)
		venue := "BHU Campus, Varanasi"
		var registrationURL *string
		if sourceEventID == "6381" {
			value := "https://forms.gle/BHUTestRegistration6381"
			registrationURL = &value
		}
		category := events.CategoryOther
		if slices.Contains([]string{"6385", "6397", "6396", "6387"}, sourceEventID) {
			category = events.CategoryTalks
		}
		if slices.Contains([]string{"6383", "6382", "6389", "6376"}, sourceEventID) {
			category = events.CategoryWorkshops
		}
		record := collections.CollectorRecord{
			SchemaVersion: "event-occurrence/v1", SourceEventID: &sourceEventID,
			SourceURL:  "https://www.bhu.ac.in/Site/EventDetails/1_2_16_Main?Upcoming&" + sourceEventID,
			SourceHost: "www.bhu.ac.in", CitySlug: "varanasi", Title: "Reviewed BHU event " + sourceEventID,
			Category: category, StartDate: date, StartsAt: &start, EndDate: &date, EndsAt: &end,
			TimePrecision: events.TimePrecisionTimed, Timezone: "Asia/Kolkata", VenueName: &venue,
			RegistrationURL: registrationURL, Status: events.StatusScheduled, Language: []string{}, ObservedAt: observedAt,
		}
		canonical, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(canonical, &fields); err != nil {
			t.Fatal(err)
		}
		fields["input"] = append(json.RawMessage(nil), source.CollectionInput...)
		records[index] = fields
	}
	dataset, err := json.Marshal(records)
	if err != nil {
		t.Fatal(err)
	}
	return dataset
}

func assertBHUPersistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID, runID uuid.UUID) {
	t.Helper()
	var status string
	var accepted, quarantined int
	if err := pool.QueryRow(ctx, `
		SELECT status, accepted_count, quarantined_count FROM collection_runs WHERE id = $1`, runID).Scan(
		&status, &accepted, &quarantined,
	); err != nil {
		t.Fatal(err)
	}
	if status != "published" || accepted != 10 || quarantined != 0 {
		t.Fatalf("BHU run status/accepted/quarantined = %q/%d/%d", status, accepted, quarantined)
	}
	rows, err := pool.Query(ctx, `
		SELECT version.canonical_record->>'source_event_id',
			version.is_free IS NULL AND version.price_min_minor IS NULL AND version.price_max_minor IS NULL
				AND version.currency IS NULL AND version.venue_address IS NULL AND version.registration_state IS NULL
				AND version.age_note IS NULL AND version.accessibility_note IS NULL AND version.image_url IS NULL
				AND cardinality(version.languages) = 0,
			version.canonical_record ?& ARRAY['is_free', 'price_min_minor', 'price_max_minor', 'currency',
				'venue_address', 'registration_state', 'age_note', 'accessibility_note', 'image_url'],
			version.registration_url
		FROM event_occurrences occurrence
		JOIN event_versions version ON version.id = occurrence.current_version_id
		WHERE occurrence.source_id = $1
		ORDER BY version.canonical_record->>'source_event_id'`, sourceID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	ids := make([]string, 0, 10)
	registrations := 0
	for rows.Next() {
		var sourceEventID string
		var nullsPreserved, nullKeysPresent bool
		var registrationURL *string
		if err := rows.Scan(&sourceEventID, &nullsPreserved, &nullKeysPresent, &registrationURL); err != nil {
			t.Fatal(err)
		}
		if !nullsPreserved || !nullKeysPresent {
			t.Fatalf("BHU persisted row %s lost null values or keys", sourceEventID)
		}
		if registrationURL != nil {
			registrations++
			if sourceEventID != "6381" || !strings.HasPrefix(*registrationURL, "https://forms.gle/") {
				t.Fatalf("BHU persisted registration %s/%s", sourceEventID, *registrationURL)
			}
		}
		ids = append(ids, sourceEventID)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	wantIDs := append([]string(nil), bhuReviewedIDs...)
	slices.Sort(wantIDs)
	if !slices.Equal(ids, wantIDs) || registrations != 1 {
		t.Fatalf("BHU persisted IDs/registrations = %v/%d, want %v/1", ids, registrations, wantIDs)
	}
}
