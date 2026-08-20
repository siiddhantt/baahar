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
)

type biecReviewedOccurrence struct {
	title, sourceURL, startDate, endDate, imageURL string
}

var biecReviewedOccurrences = []biecReviewedOccurrence{
	{"Franchise India", "https://www.biec.in/Calendar_event/2k26/franchise-india.php", "2026-08-22", "2026-08-23", "https://www.biec.in/images/events/franchise-india.webp"},
	{"India Med Expo", "https://www.biec.in/Calendar_event/2k26/india-med-expo-2026.php", "2026-09-05", "2026-09-07", "https://www.biec.in/images/events/indiamed.webp"},
	{"Bangalore Space Expo", "https://www.biec.in/Calendar_event/2k26/bangalore-space-expo.php", "2026-09-07", "2026-09-09", "https://www.biec.in/images/events/bangalore-space-expo.webp"},
	{"Electronica- Productronica", "https://www.biec.in/Calendar_event/2k26/electronica-productronica.php", "2026-09-16", "2026-09-18", "https://www.biec.in/images/events/electronica.webp"},
	{"LWOP", "https://www.biec.in/Calendar_event/2k26/lwop.php", "2026-09-16", "2026-09-18", "https://www.biec.in/images/events/lwop.webp"},
	{"Expodent", "https://www.biec.in/Calendar_event/2k26/expodent.php", "2026-09-25", "2026-09-27", "https://www.biec.in/images/events/expo-dent-2025.webp"},
	{"HBLF", "https://www.biec.in/Calendar_event/2k26/hblf.php", "2026-09-25", "2026-09-27", "https://www.biec.in/images/events/HBLF.webp"},
	{"Acetech", "https://www.biec.in/Calendar_event/2k26/acetech.php", "2026-10-09", "2026-10-11", "https://www.biec.in/images/events/Acetech.webp"},
	{"Hindustan International Furniture Fair", "https://www.biec.in/Calendar_event/2k26/hiff.php", "2026-10-24", "2026-10-26", "https://www.biec.in/images/events/Hiff-2026.webp"},
}

func TestBIECTransportPublishesExactReviewedHorizonAndFreezesBadCandidate(t *testing.T) {
	ctx, pool := biecIntegrationPool(t)
	source, err := postgres.NewSourceConfigs(pool).Get(ctx, uuid.MustParse("520e6232-ab55-5c71-8918-bb68a659ae61"))
	if err != nil {
		t.Fatal(err)
	}
	observedAt := time.Date(2026, time.August, 20, 10, 15, 46, 668000000, time.UTC)
	transport := biecTransportDataset(t, source.CollectionInput, observedAt)
	canonical, err := collections.CanonicalizeBrightDataset(transport, source.CollectionInput)
	if err != nil {
		t.Fatal(err)
	}
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	policy := collections.SourcePolicy{
		ID: source.ID, CitySlug: source.CitySlug, CanonicalHost: source.CanonicalHost,
		SchemaVersion: source.SchemaVersion, SourceEventIDPattern: source.SourceEventIDPattern,
		RecordLimit: source.RecordLimit, MinimumRecords: source.MinimumRecords,
		MaximumQuarantineRatioBPS: source.MaximumQuarantineRatioBPS,
		MaximumDuplicateRatioBPS:  source.MaximumDuplicateRatioBPS,
		LowCountRatioBPS:          source.LowCountRatioBPS,
		HighCountRatioBPS:         source.HighCountRatioBPS,
		RegistrationHosts:         source.RegistrationHosts, ImageHosts: source.ImageHosts,
		ObservationEarliest: observedAt.Add(-time.Minute), ObservationLatest: observedAt.Add(time.Minute),
	}
	prepared, err := collections.PrepareDataset(canonical, policy, validator)
	if err != nil {
		t.Fatal(err)
	}
	if prepared.HealthCode != "" || len(prepared.Candidates) != 9 || len(prepared.Quarantined) != 0 {
		t.Fatalf("BIEC preparation = %+v, want 9 healthy candidates", prepared)
	}

	runID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, 'validating', $4, 9)`, runID, source.ID, uuid.NewString(), observedAt); err != nil {
		t.Fatal(err)
	}
	completedAt := observedAt.Add(time.Minute)
	publication := postgres.NewPublication(pool)
	if err := publication.Publish(ctx, runID, source, prepared, completedAt); err != nil {
		t.Fatal(err)
	}
	assertBIECPersistence(t, ctx, pool, source.ID, runID, completedAt)
	assertBIECPublicAPI(t, pool, completedAt, 9)

	badTransport := append([]byte(nil), transport...)
	badTransport = []byte(strings.Replace(string(badTransport), "https://www.biec.in/Calendar_event/2k26/franchise-india.php", "https://evil.example/events/franchise", 1))
	badCanonical, err := collections.CanonicalizeBrightDataset(badTransport, source.CollectionInput)
	if err != nil {
		t.Fatal(err)
	}
	badPrepared, err := collections.PrepareDataset(badCanonical, policy, validator)
	if err != nil {
		t.Fatal(err)
	}
	if badPrepared.HealthCode != "quarantine_threshold_exceeded" || len(badPrepared.Candidates) != 8 || len(badPrepared.Quarantined) != 1 {
		t.Fatalf("bad BIEC preparation = %+v", badPrepared)
	}
	badRunID := uuid.Must(uuid.NewV7())
	badTriggeredAt := completedAt.Add(time.Minute)
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, 'validating', $4, 9)`, badRunID, source.ID, uuid.NewString(), badTriggeredAt); err != nil {
		t.Fatal(err)
	}
	if err := publication.Reject(ctx, badRunID, source.ID, 9, badPrepared, badTriggeredAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	var publicationState string
	var lastHealthyAt time.Time
	var currentVersions, incidents int
	if err := pool.QueryRow(ctx, `SELECT publication_state, last_healthy_at FROM sources WHERE id = $1`, source.ID).Scan(&publicationState, &lastHealthyAt); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_occurrences WHERE source_id = $1 AND current_version_id IS NOT NULL`, source.ID).Scan(&currentVersions); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM operator_incidents WHERE source_id = $1 AND state = 'open'`, source.ID).Scan(&incidents); err != nil {
		t.Fatal(err)
	}
	if publicationState != "frozen" || !lastHealthyAt.Equal(completedAt) || currentVersions != 9 || incidents != 1 {
		t.Fatalf("rejected BIEC state = %q/%s/%d/%d", publicationState, lastHealthyAt, currentVersions, incidents)
	}
	assertBIECPublicAPI(t, pool, badTriggeredAt.Add(2*time.Minute), 9)
}

func biecIntegrationPool(t *testing.T) (context.Context, *pgxpool.Pool) {
	t.Helper()
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL BIEC test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := "baahar_biec_http_" + uuid.NewString()[:8]
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

func biecTransportDataset(t *testing.T, collectionInput json.RawMessage, observedAt time.Time) []byte {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	venue := "Bangalore International Exhibition Centre"
	records := make([]map[string]json.RawMessage, len(biecReviewedOccurrences))
	for index, reviewed := range biecReviewedOccurrences {
		startDate, err := time.ParseInLocation(time.DateOnly, reviewed.startDate, location)
		if err != nil {
			t.Fatal(err)
		}
		endDate, err := time.ParseInLocation(time.DateOnly, reviewed.endDate, location)
		if err != nil {
			t.Fatal(err)
		}
		startsAt := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 9, 0, 0, 0, location)
		endsAt := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 18, 0, 0, 0, location)
		record := collections.CollectorRecord{
			SchemaVersion: "event-occurrence/v1", SourceEventID: nil,
			SourceURL: reviewed.sourceURL, SourceHost: "www.biec.in", CitySlug: "bengaluru",
			Title: reviewed.title, Category: events.CategoryOther, StartDate: reviewed.startDate,
			StartsAt: &startsAt, EndDate: &reviewed.endDate, EndsAt: &endsAt,
			TimePrecision: events.TimePrecisionTimed, Timezone: "Asia/Kolkata", VenueName: &venue,
			Status: events.StatusScheduled, Language: []string{}, ImageURL: &reviewed.imageURL, ObservedAt: observedAt,
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

func assertBIECPersistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID, runID uuid.UUID, completedAt time.Time) {
	t.Helper()
	var status string
	var accepted, quarantined int
	if err := pool.QueryRow(ctx, `SELECT status, accepted_count, quarantined_count FROM collection_runs WHERE id = $1`, runID).Scan(&status, &accepted, &quarantined); err != nil {
		t.Fatal(err)
	}
	if status != "published" || accepted != 9 || quarantined != 0 {
		t.Fatalf("BIEC run status/accepted/quarantined = %q/%d/%d", status, accepted, quarantined)
	}
	rows, err := pool.Query(ctx, `
		SELECT occurrence.source_identity, version.title, version.source_url, version.starts_at,
			version.venue_name, version.category, version.image_url,
			version.canonical_record->'source_event_id' = 'null'::jsonb,
			version.is_free IS NULL AND version.price_min_minor IS NULL AND version.price_max_minor IS NULL
				AND version.currency IS NULL AND version.venue_address IS NULL
				AND version.registration_url IS NULL AND version.registration_state IS NULL
				AND version.age_note IS NULL AND version.accessibility_note IS NULL
				AND cardinality(version.languages) = 0
		FROM event_occurrences occurrence
		JOIN event_versions version ON version.id = occurrence.current_version_id
		WHERE occurrence.source_id = $1
		ORDER BY version.starts_at, version.title`, sourceID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	titles := make([]string, 0, 9)
	for rows.Next() {
		var identity, title, sourceURL, venue, category, imageURL string
		var startsAt time.Time
		var nativeIDNull, unknownsPreserved bool
		if err := rows.Scan(&identity, &title, &sourceURL, &startsAt, &venue, &category, &imageURL, &nativeIDNull, &unknownsPreserved); err != nil {
			t.Fatal(err)
		}
		wantIdentity, err := events.Identity(events.IdentityInput{
			SourceID: sourceID, Title: title, SourceURL: sourceURL, OccurrenceTime: startsAt, VenueKey: venue,
		})
		if err != nil {
			t.Fatal(err)
		}
		if identity != wantIdentity || venue != "Bangalore International Exhibition Centre" || category != "other" ||
			!strings.HasPrefix(imageURL, "https://www.biec.in/images/events/") || !nativeIDNull || !unknownsPreserved {
			t.Fatalf("BIEC persisted record = %s/%s/%s/%s/%v/%v", title, identity, venue, imageURL, nativeIDNull, unknownsPreserved)
		}
		titles = append(titles, title)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	wantTitles := make([]string, len(biecReviewedOccurrences))
	for index, reviewed := range biecReviewedOccurrences {
		wantTitles[index] = reviewed.title
	}
	slices.Sort(wantTitles)
	gotTitles := append([]string(nil), titles...)
	slices.Sort(gotTitles)
	if !slices.Equal(gotTitles, wantTitles) {
		t.Fatalf("BIEC persisted titles = %v, want %v", gotTitles, wantTitles)
	}
	var healthyAt time.Time
	if err := pool.QueryRow(ctx, `SELECT last_healthy_at FROM sources WHERE id = $1`, sourceID).Scan(&healthyAt); err != nil {
		t.Fatal(err)
	}
	if !healthyAt.Equal(completedAt) {
		t.Fatalf("BIEC last_healthy_at = %s, want %s", healthyAt, completedAt)
	}
}

func assertBIECPublicAPI(t *testing.T, pool *pgxpool.Pool, asOf time.Time, want int) {
	t.Helper()
	server := &Server{events: postgres.NewEvents(pool), logger: slog.Default(), now: func() time.Time { return asOf }}
	feed := httptest.NewRecorder()
	server.Handler().ServeHTTP(feed, httptest.NewRequest(http.MethodGet, "/v1/events?city=bengaluru&limit=20", nil))
	if feed.Code != http.StatusOK {
		t.Fatalf("BIEC feed status = %d, body = %s", feed.Code, feed.Body.String())
	}
	var page eventPageDTO
	if err := json.Unmarshal(feed.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != want || page.Meta.ResultCount != want || page.Meta.SourceCount != 1 || page.NextCursor != nil {
		t.Fatalf("BIEC public page items/results/sources/cursor = %d/%d/%d/%v", len(page.Items), page.Meta.ResultCount, page.Meta.SourceCount, page.NextCursor)
	}
	for _, item := range page.Items {
		if item.City.Slug != "bengaluru" || item.Source.Slug != "biec" || item.Source.Host != "www.biec.in" ||
			item.Category != "other" || item.Timing.Precision != "timed" || item.Timing.Timezone != "Asia/Kolkata" ||
			item.Status != "scheduled" || item.Venue == nil || item.Venue.Name != "Bangalore International Exhibition Centre" ||
			item.Venue.Address != nil || item.Pricing.IsFree != nil || item.Pricing.MinimumMinor != nil ||
			item.Pricing.MaximumMinor != nil || item.Pricing.Currency != nil || item.Registration.URL != nil ||
			item.Registration.State != nil || item.ImageURL == nil || !strings.HasPrefix(*item.ImageURL, "https://www.biec.in/images/events/") ||
			item.AgeNote != nil || item.AccessibilityNote != nil || len(item.Language) != 0 {
			t.Fatalf("BIEC public event lost reviewed facts/nullability: %+v", item)
		}
	}
	first := page.Items[0]
	for path, content := range map[string]string{
		"/v1/events/" + first.ID:          "application/json",
		"/v1/events/" + first.ID + ".ics": "BEGIN:VCALENDAR",
		"/v1/sources/biec/summary":        "application/json",
	} {
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK || (content == "BEGIN:VCALENDAR" && !strings.Contains(response.Body.String(), content)) {
			t.Fatalf("GET %s = %d, body = %s", path, response.Code, response.Body.String())
		}
	}
}
