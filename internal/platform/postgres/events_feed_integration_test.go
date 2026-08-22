package postgres

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/events"
	"github.com/siiddhantt/baahar/internal/sources"
)

func TestEventFeedExcludesEndedPreservesOngoingAndPaginatesStableTies(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	asOf := time.Date(2026, time.August, 19, 12, 0, 0, 0, location)
	observedAt := asOf.Add(-time.Hour)
	endedStart := time.Date(2026, time.August, 19, 9, 0, 0, 0, location)
	endedEnd := time.Date(2026, time.August, 19, 10, 0, 0, 0, location)
	ongoingStart := time.Date(2026, time.August, 19, 11, 0, 0, 0, location)
	ongoingEnd := time.Date(2026, time.August, 19, 13, 0, 0, 0, location)
	tiedStart := time.Date(2026, time.August, 19, 15, 0, 0, 0, location)
	tiedEnd := tiedStart.Add(time.Hour)
	tomorrowStart := time.Date(2026, time.August, 20, 9, 0, 0, 0, location)
	tomorrowEnd := tomorrowStart.Add(time.Hour)

	candidates := []collections.Candidate{
		feedTimedCandidate(t, source, "ended", "Ended today", endedStart, endedEnd, observedAt),
		feedTimedCandidate(t, source, "ongoing", "Ongoing now", ongoingStart, ongoingEnd, observedAt),
		feedDateCandidate(t, source, "all-day", "All day today", asOf, observedAt),
		feedTimedCandidate(t, source, "tie-a", "Same start A", tiedStart, tiedEnd, observedAt),
		feedTimedCandidate(t, source, "tie-b", "Same start B", tiedStart, tiedEnd, observedAt),
		feedTimedCandidate(t, source, "tomorrow", "Tomorrow", tomorrowStart, tomorrowEnd, observedAt),
	}
	runID := validatingRun(t, ctx, pool, source.ID, len(candidates), observedAt)
	if err := NewPublication(pool).Publish(ctx, runID, source, healthyDatasetWithTracking(false, candidates...), observedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}

	repository := NewEvents(pool)
	full, err := repository.List(ctx, events.FeedQuery{
		CitySlug: "bengaluru", Window: events.WindowUpcoming, AsOf: asOf, Limit: 60,
	})
	if err != nil {
		t.Fatal(err)
	}
	if full.ResultCount != 5 || len(full.Items) != 5 || full.Next != nil {
		t.Fatalf("full upcoming page count/items/next = %d/%d/%v, want 5/5/nil", full.ResultCount, len(full.Items), full.Next)
	}
	if !full.AsOf.Equal(asOf) {
		t.Fatalf("feed as-of = %s, want %s", full.AsOf, asOf)
	}
	titles := feedTitles(full.Items)
	for _, forbidden := range []string{"Ended today"} {
		if containsString(titles, forbidden) {
			t.Fatalf("ended occurrence leaked into upcoming feed: %v", titles)
		}
	}
	for _, required := range []string{"All day today", "Ongoing now", "Tomorrow"} {
		if !containsString(titles, required) {
			t.Fatalf("required current occurrence %q missing from feed: %v", required, titles)
		}
	}
	if len(full.Venues) != 2 || full.Venues[0] != "Tomorrow Hall" || full.Venues[1] != "Town Hall" {
		t.Fatalf("venue facets = %v", full.Venues)
	}
	venuePage, err := repository.List(ctx, events.FeedQuery{
		CitySlug: "bengaluru", Window: events.WindowUpcoming, AsOf: asOf, Venue: "Tomorrow Hall", Limit: 60,
	})
	if err != nil {
		t.Fatal(err)
	}
	if venuePage.ResultCount != 1 || len(venuePage.Items) != 1 || venuePage.Items[0].Version.Title != "Tomorrow" || len(venuePage.Venues) != 2 {
		t.Fatalf("venue-filtered page = count %d, titles %v, facets %v", venuePage.ResultCount, feedTitles(venuePage.Items), venuePage.Venues)
	}

	var tied []events.PublicOccurrence
	for _, occurrence := range full.Items {
		if occurrence.Version.Title == "Same start A" || occurrence.Version.Title == "Same start B" {
			tied = append(tied, occurrence)
		}
	}
	if len(tied) != 2 || tied[0].ID.String() >= tied[1].ID.String() {
		t.Fatalf("same-start UUID tie order = %v", occurrenceIDs(tied))
	}

	pageQuery := events.FeedQuery{
		CitySlug: "bengaluru", Window: events.WindowUpcoming, AsOf: asOf, Limit: 2,
	}
	var paged []events.PublicOccurrence
	for {
		page, err := repository.List(ctx, pageQuery)
		if err != nil {
			t.Fatal(err)
		}
		if page.ResultCount != full.ResultCount {
			t.Fatalf("page result count = %d, want %d", page.ResultCount, full.ResultCount)
		}
		paged = append(paged, page.Items...)
		if page.Next == nil {
			break
		}
		pageQuery.After = page.Next
	}
	if got, want := occurrenceIDs(paged), occurrenceIDs(full.Items); !equalUUIDs(got, want) {
		t.Fatalf("paged occurrence IDs = %v, want gapless/non-duplicated %v", got, want)
	}

	today, err := repository.List(ctx, events.FeedQuery{
		CitySlug: "bengaluru", Window: events.WindowToday, AsOf: asOf, Limit: 60,
	})
	if err != nil {
		t.Fatal(err)
	}
	if containsString(feedTitles(today.Items), "Ended today") || containsString(feedTitles(today.Items), "Tomorrow") {
		t.Fatalf("today feed crossed request-time/day boundaries: %v", feedTitles(today.Items))
	}
}

func feedTimedCandidate(
	t *testing.T,
	source sources.Config,
	sourceEventID, title string,
	startsAt, endsAt, observedAt time.Time,
) collections.Candidate {
	t.Helper()
	venue := "Town Hall"
	if sourceEventID == "tomorrow" {
		venue = "Tomorrow Hall"
	}
	startDate := time.Date(startsAt.Year(), startsAt.Month(), startsAt.Day(), 0, 0, 0, 0, startsAt.Location())
	endDate := time.Date(endsAt.Year(), endsAt.Month(), endsAt.Day(), 0, 0, 0, 0, endsAt.Location())
	return feedCandidate(t, source, sourceEventID, events.Version{
		Title: title, Category: events.CategoryArts,
		SourceURL: "https://bangaloreinternationalcentre.org/event/" + sourceEventID,
		StartDate: startDate, EndDate: &endDate, StartsAt: &startsAt, EndsAt: &endsAt,
		TimePrecision: events.TimePrecisionTimed, Timezone: "Asia/Kolkata",
		VenueName: &venue,
		Status:    events.StatusScheduled, Languages: []string{}, ObservedAt: observedAt,
	})
}

func feedDateCandidate(
	t *testing.T,
	source sources.Config,
	sourceEventID, title string,
	date, observedAt time.Time,
) collections.Candidate {
	t.Helper()
	venue := "Town Hall"
	startDate := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	return feedCandidate(t, source, sourceEventID, events.Version{
		Title: title, Category: events.CategoryArts,
		SourceURL: "https://bangaloreinternationalcentre.org/event/" + sourceEventID,
		StartDate: startDate, TimePrecision: events.TimePrecisionDate, Timezone: "Asia/Kolkata",
		VenueName: &venue,
		Status:    events.StatusScheduled, Languages: []string{}, ObservedAt: observedAt,
	})
}

func feedCandidate(t *testing.T, source sources.Config, sourceEventID string, version events.Version) collections.Candidate {
	t.Helper()
	if err := version.Validate(); err != nil {
		t.Fatal(err)
	}
	identity, err := events.Identity(events.IdentityInput{SourceID: source.ID, SourceEventID: sourceEventID})
	if err != nil {
		t.Fatal(err)
	}
	fingerprint, err := events.Fingerprint(version)
	if err != nil {
		t.Fatal(err)
	}
	record, err := json.Marshal(map[string]string{"source_event_id": sourceEventID})
	if err != nil {
		t.Fatal(err)
	}
	return collections.Candidate{
		Identity: identity, Fingerprint: fingerprint, Slug: "feed-" + sourceEventID,
		Version: version, CanonicalRecord: record,
	}
}

func feedTitles(items []events.PublicOccurrence) []string {
	titles := make([]string, len(items))
	for index, occurrence := range items {
		titles[index] = occurrence.Version.Title
	}
	return titles
}

func occurrenceIDs(items []events.PublicOccurrence) []uuid.UUID {
	ids := make([]uuid.UUID, len(items))
	for index, occurrence := range items {
		ids[index] = occurrence.ID
	}
	return ids
}

func equalUUIDs(left, right []uuid.UUID) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
