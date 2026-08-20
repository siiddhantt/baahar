package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	"github.com/siiddhantt/baahar/internal/sources"
)

var pianoManReviewedIDs = strings.Fields(`
	4461 4610 4693 4428 4561 4663 4576 4581 4608 4626 4653 4569 4603 4617 4556 4592
	4612 4486 4557 4622 4459 4674 4567 4582 4660 4562 4587 4618 4682 4630 4639 4601
	4652 4695 4615 4654 4691 4634 4688 4647 4563 4648 4680 4628 4635 4619 4694 4689
	4655 4636 4692 4676 4658 4690 4675 4445 4558 4607 4496 4574 4606 4621 4662 4664
`)

var prithviReviewedIDs = strings.Fields(`
	723 722 709 710 749 711 712 754 724 725 750 753 734 735 736 759 737 738 778 779
	771 772 773 764 765 766 767 768 790 786 788 787 776 777 780 781 782 783 784 785
	760 761 762 763 791 769 770 774 775
`)

func TestPianoManProductionShapePublishesDelhiEndToEnd(t *testing.T) {
	ctx, pool := expandedCityIntegrationPool(t, "piano")
	source, err := postgres.NewSourceConfigs(pool).Get(ctx, uuid.MustParse("7129ebd4-8cc9-524f-85bd-f9cde8b6d7b3"))
	if err != nil {
		t.Fatal(err)
	}
	observedAt := time.Date(2026, time.August, 20, 18, 3, 10, 616000000, time.UTC)
	location := mustKolkata(t)
	venue := "The Piano Man Eldeco Centre, Saket"
	address := "Eldeco Centre, Hauz Rani, Malviya Nagar, New Delhi, Delhi 110017"
	price := int64(99900)
	currency := "INR"
	paid := false
	records := make([]collections.CollectorRecord, len(pianoManReviewedIDs))
	for index, id := range pianoManReviewedIDs {
		date := time.Date(2026, time.August, 21, 0, 0, 0, 0, location).AddDate(0, 0, index).Format(time.DateOnly)
		detailURL := "https://www.thepianoman.in/event/detail/2/reviewed-delhi-event-" + id
		imageURL := "https://www.thepianoman.in/admin/uploads/events/image_3_" + id + ".jpeg"
		category := events.CategoryMusic
		switch {
		case index >= 48 && index < 61:
			category = events.CategoryOther
		case index >= 61 && index < 63:
			category = events.CategoryArts
		case index == 63:
			category = events.CategoryTheatre
		}
		records[index] = collections.CollectorRecord{
			SchemaVersion: "event-occurrence/v1", SourceEventID: &pianoManReviewedIDs[index],
			SourceURL: detailURL, SourceHost: "www.thepianoman.in", CitySlug: "delhi",
			Title: "Reviewed Piano Man event " + id, Category: category, StartDate: date,
			TimePrecision: events.TimePrecisionDate, Timezone: "Asia/Kolkata", VenueName: &venue,
			VenueAddress: &address, IsFree: &paid, PriceMinMinor: &price, Currency: &currency,
			RegistrationURL: &detailURL, Status: events.StatusScheduled, Language: []string{},
			ImageURL: &imageURL, ObservedAt: observedAt,
		}
	}
	publishExpandedCityDataset(t, ctx, pool, source, records, observedAt)
	assertExpandedCityPersistence(t, ctx, pool, source.ID, pianoManReviewedIDs, "delhi")
	assertExpandedCityPublicAPI(t, pool, observedAt.Add(time.Minute), expandedCityExpectation{
		city: "delhi", cityName: "Delhi", accent: "monument", source: "the-piano-man",
		host: "www.thepianoman.in", count: 64,
	})
}

func TestPrithviProductionShapePublishesMumbaiEndToEnd(t *testing.T) {
	ctx, pool := expandedCityIntegrationPool(t, "prithvi")
	source, err := postgres.NewSourceConfigs(pool).Get(ctx, uuid.MustParse("7bb2b2bf-66bb-5cfe-8269-ea811552d9c7"))
	if err != nil {
		t.Fatal(err)
	}
	observedAt := time.Date(2026, time.August, 20, 17, 26, 23, 967000000, time.UTC)
	location := mustKolkata(t)
	venue := "Prithvi Theatre"
	address := "20 Janki Kutir, Juhu Church Road, Mumbai, Maharashtra 400049, India"
	currency := "INR"
	open := events.RegistrationOpen
	age := "10yrs"
	records := make([]collections.CollectorRecord, len(prithviReviewedIDs))
	for index, id := range prithviReviewedIDs {
		start := time.Date(2026, time.August, 21, 17, 0, 0, 0, location).AddDate(0, 0, index)
		end := start.Add(90 * time.Minute)
		date := start.Format(time.DateOnly)
		registrationURL := "https://in.bookmyshow.com/plays/reviewed-prithvi-event/ET" + id
		imageURL := "https://in.bmscdn.com/Events/moviecard/reviewed-prithvi-event-" + id + ".jpg"
		category := events.CategoryTheatre
		switch {
		case index >= 44 && index < 46:
			category = events.CategoryMusic
		case index >= 46 && index < 48:
			category = events.CategoryArts
		case index == 48:
			category = events.CategoryTalks
		}
		free := index < 4
		var price *int64
		var recordCurrency *string
		if !free {
			value := int64(50000)
			price = &value
			recordCurrency = &currency
		}
		records[index] = collections.CollectorRecord{
			SchemaVersion: "event-occurrence/v1", SourceEventID: &prithviReviewedIDs[index],
			SourceURL: "https://prithvitheatre.org/booktickets", SourceHost: "prithvitheatre.org",
			CitySlug: "mumbai", Title: "Reviewed Prithvi performance " + id, Category: category,
			StartDate: date, StartsAt: &start, EndDate: &date, EndsAt: &end,
			TimePrecision: events.TimePrecisionTimed, Timezone: "Asia/Kolkata", VenueName: &venue,
			VenueAddress: &address, IsFree: &free, PriceMinMinor: price, Currency: recordCurrency,
			RegistrationURL: &registrationURL, RegistrationState: &open, Status: events.StatusScheduled,
			Language: []string{"Hindi"}, AgeNote: &age, ImageURL: &imageURL, ObservedAt: observedAt,
		}
	}
	publishExpandedCityDataset(t, ctx, pool, source, records, observedAt)
	assertExpandedCityPersistence(t, ctx, pool, source.ID, prithviReviewedIDs, "mumbai")
	assertExpandedCityPublicAPI(t, pool, observedAt.Add(time.Minute), expandedCityExpectation{
		city: "mumbai", cityName: "Mumbai", accent: "coast", source: "prithvi-theatre",
		host: "prithvitheatre.org", count: 49,
	})
}

func expandedCityIntegrationPool(t *testing.T, prefix string) (context.Context, *pgxpool.Pool) {
	t.Helper()
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL city-expansion test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := "baahar_" + prefix + "_http_" + uuid.NewString()[:8]
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

func publishExpandedCityDataset(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	source sources.Config,
	records []collections.CollectorRecord,
	observedAt time.Time,
) {
	t.Helper()
	transport := make([]map[string]json.RawMessage, len(records))
	for index, record := range records {
		canonical, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(canonical, &transport[index]); err != nil {
			t.Fatal(err)
		}
		transport[index]["input"] = append(json.RawMessage(nil), source.CollectionInput...)
	}
	raw, err := json.Marshal(transport)
	if err != nil {
		t.Fatal(err)
	}
	canonical, err := collections.CanonicalizeBrightDataset(raw, source.CollectionInput)
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
		LowCountRatioBPS:          source.LowCountRatioBPS, HighCountRatioBPS: source.HighCountRatioBPS,
		RegistrationHosts: source.RegistrationHosts, ImageHosts: source.ImageHosts,
		ObservationEarliest: observedAt.Add(-time.Minute), ObservationLatest: observedAt.Add(time.Minute),
	}, validator)
	if err != nil {
		t.Fatal(err)
	}
	if prepared.HealthCode != "" || len(prepared.Candidates) != len(records) || len(prepared.Quarantined) != 0 {
		t.Fatalf("prepared %s dataset = %+v", source.Slug, prepared)
	}
	runID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, 'validating', $4, $5)`, runID, source.ID, uuid.NewString(), observedAt, len(records)); err != nil {
		t.Fatal(err)
	}
	if err := postgres.NewPublication(pool).Publish(ctx, runID, source, prepared, observedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
}

func assertExpandedCityPersistence(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID uuid.UUID, wantIDs []string, city string) {
	t.Helper()
	rows, err := pool.Query(ctx, `
		SELECT version.canonical_record->>'source_event_id', occurrence.source_identity,
			version.canonical_record->>'city_slug', version.canonical_record ?& ARRAY[
				'source_event_id', 'starts_at', 'end_date', 'ends_at', 'venue_address',
				'is_free', 'price_min_minor', 'price_max_minor', 'currency', 'registration_state',
				'age_note', 'accessibility_note', 'image_url'
			]
		FROM event_occurrences occurrence
		JOIN event_versions version ON version.id = occurrence.current_version_id
		WHERE occurrence.source_id = $1`, sourceID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	gotIDs := make([]string, 0, len(wantIDs))
	for rows.Next() {
		var id, identity, gotCity string
		var keysPresent bool
		if err := rows.Scan(&id, &identity, &gotCity, &keysPresent); err != nil {
			t.Fatal(err)
		}
		wantIdentity, err := events.Identity(events.IdentityInput{SourceID: sourceID, SourceEventID: id})
		if err != nil {
			t.Fatal(err)
		}
		if identity != wantIdentity || gotCity != city || !keysPresent {
			t.Fatalf("persisted %s record = %q/%q/%v", id, identity, gotCity, keysPresent)
		}
		gotIDs = append(gotIDs, id)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	slices.Sort(gotIDs)
	expected := append([]string(nil), wantIDs...)
	slices.Sort(expected)
	if !slices.Equal(gotIDs, expected) {
		t.Fatalf("persisted IDs = %v, want %v", gotIDs, expected)
	}
}

type expandedCityExpectation struct {
	city, cityName, accent, source, host string
	count                                int
}

func assertExpandedCityPublicAPI(t *testing.T, pool *pgxpool.Pool, asOf time.Time, want expandedCityExpectation) {
	t.Helper()
	codec, err := newCursorCodec("expanded-city-integration-cursor-secret")
	if err != nil {
		t.Fatal(err)
	}
	server := &Server{events: postgres.NewEvents(pool), logger: slog.Default(), cursors: codec, now: func() time.Time { return asOf }}

	citiesResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(citiesResponse, httptest.NewRequest(http.MethodGet, "/v1/cities", nil))
	if citiesResponse.Code != http.StatusOK {
		t.Fatalf("cities status = %d, body = %s", citiesResponse.Code, citiesResponse.Body.String())
	}
	var cities struct {
		Items []cityDTO `json:"items"`
	}
	if err := json.Unmarshal(citiesResponse.Body.Bytes(), &cities); err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(cities.Items, func(city cityDTO) bool {
		return city.Slug == want.city && city.Name == want.cityName && city.Accent == want.accent
	}) {
		t.Fatalf("cities = %+v, missing %+v", cities.Items, want)
	}

	path := "/v1/events?city=" + want.city + "&limit=60"
	items := make([]eventDTO, 0, want.count)
	for {
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("feed %s = %d, body = %s", path, response.Code, response.Body.String())
		}
		var page eventPageDTO
		if err := json.Unmarshal(response.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		if page.Meta.ResultCount != want.count || page.Meta.SourceCount != 1 || page.Meta.City.Slug != want.city {
			t.Fatalf("feed metadata = %+v, want %+v", page.Meta, want)
		}
		items = append(items, page.Items...)
		if page.NextCursor == nil {
			break
		}
		path = "/v1/events?city=" + want.city + "&limit=60&cursor=" + url.QueryEscape(*page.NextCursor)
	}
	if len(items) != want.count {
		t.Fatalf("public %s items = %d, want %d", want.city, len(items), want.count)
	}
	for _, item := range items {
		if item.City.Slug != want.city || item.Source.Slug != want.source || item.Source.Host != want.host || item.Status != "scheduled" {
			t.Fatalf("public %s record lost source/city/status facts: %+v", want.city, item)
		}
	}
	first := items[0]
	for route, marker := range map[string]string{
		"/v1/events/" + first.ID:                  "application/json",
		"/v1/events/" + first.ID + ".ics":         "BEGIN:VCALENDAR",
		"/v1/sources/" + want.source + "/summary": "application/json",
	} {
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		if response.Code != http.StatusOK || (marker == "BEGIN:VCALENDAR" && !strings.Contains(response.Body.String(), marker)) {
			t.Fatalf("GET %s = %d, body = %s", route, response.Code, response.Body.String())
		}
	}
}

func mustKolkata(t *testing.T) *time.Location {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	return location
}

func TestReviewedProductionCountsStayPinned(t *testing.T) {
	if len(pianoManReviewedIDs) != 64 || len(prithviReviewedIDs) != 49 {
		t.Fatalf("reviewed production counts changed: Piano %d, Prithvi %d", len(pianoManReviewedIDs), len(prithviReviewedIDs))
	}
	if pianoManReviewedIDs[0] != "4461" || prithviReviewedIDs[0] != "723" {
		t.Fatalf("reviewed production identity anchors changed: Piano %s, Prithvi %s", pianoManReviewedIDs[0], prithviReviewedIDs[0])
	}
}
