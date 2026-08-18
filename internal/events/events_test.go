package events

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

var kolkata = mustLocation("Asia/Kolkata")

func TestIdentityUsesStableSourceIDAndOccurrence(t *testing.T) {
	sourceID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	start := time.Date(2026, time.August, 20, 18, 30, 0, 0, kolkata)
	first, err := Identity(IdentityInput{
		SourceID:       sourceID,
		SourceEventID:  " BIC-123 ",
		Title:          "Old title",
		SourceURL:      "https://example.com/old",
		OccurrenceTime: start,
		VenueKey:       "old venue",
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := Identity(IdentityInput{
		SourceID:       sourceID,
		SourceEventID:  "bic-123",
		Title:          "Completely corrected title",
		SourceURL:      "https://example.com/new",
		OccurrenceTime: start,
		VenueKey:       "new venue",
	})
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatalf("stable source ID must take precedence: %q != %q", first, second)
	}

	later, err := Identity(IdentityInput{SourceID: sourceID, SourceEventID: "bic-123", OccurrenceTime: start.Add(time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	if later != first {
		t.Fatal("a corrected start time must not create a new identity")
	}
	differentPerformance, err := Identity(IdentityInput{SourceID: sourceID, SourceEventID: "bic-123-performance-2", OccurrenceTime: start.Add(time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	if differentPerformance == first {
		t.Fatal("distinct stable performance IDs must have distinct identities")
	}
}

func TestDerivedIdentityCanonicalizesURL(t *testing.T) {
	input := IdentityInput{
		SourceID:       uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d"),
		Title:          "An Evening of Music",
		SourceURL:      "HTTPS://Example.COM/events/show/?b=2&a=1#tickets",
		OccurrenceTime: time.Date(2026, time.August, 20, 0, 0, 0, 0, time.UTC),
		VenueKey:       "  Main   Hall ",
	}
	first, err := Identity(input)
	if err != nil {
		t.Fatal(err)
	}
	input.SourceURL = "https://example.com/events/show?a=1&b=2"
	input.VenueKey = "main hall"
	second, err := Identity(input)
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatalf("canonical equivalents produced different identities: %q != %q", first, second)
	}
}

func TestIdentityDerivedAndNativeInvariants(t *testing.T) {
	sourceID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	start := time.Date(2026, time.August, 20, 18, 30, 0, 0, kolkata)
	base := IdentityInput{
		SourceID:       sourceID,
		Title:          "Classical Evening",
		SourceURL:      "https://example.com/calendar",
		OccurrenceTime: start,
		VenueKey:       "Main Hall",
	}
	baseIdentity, err := Identity(base)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name      string
		mutate    func(IdentityInput) IdentityInput
		wantEqual bool
	}{
		{
			name: "same listing row facts normalize title",
			mutate: func(input IdentityInput) IdentityInput {
				input.Title = "  classical   EVENING "
				return input
			},
			wantEqual: true,
		},
		{
			name: "different title at same time and venue",
			mutate: func(input IdentityInput) IdentityInput {
				input.Title = "Poetry Evening"
				return input
			},
			wantEqual: false,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			identity, err := Identity(test.mutate(base))
			if err != nil {
				t.Fatal(err)
			}
			if (identity == baseIdentity) != test.wantEqual {
				t.Fatalf("identity equality = %v, want %v", identity == baseIdentity, test.wantEqual)
			}
		})
	}

	nativeFirst, err := Identity(IdentityInput{
		SourceID: sourceID, SourceEventID: "stable-42", Title: "Old title", OccurrenceTime: start,
	})
	if err != nil {
		t.Fatal(err)
	}
	nativeEdited, err := Identity(IdentityInput{
		SourceID: sourceID, SourceEventID: "stable-42", Title: "New title", OccurrenceTime: start.Add(3 * time.Hour),
	})
	if err != nil {
		t.Fatal(err)
	}
	if nativeFirst != nativeEdited {
		t.Fatal("native identity changed across title/time corrections")
	}

	if _, err := Identity(IdentityInput{SourceID: sourceID, SourceURL: base.SourceURL, OccurrenceTime: start}); err == nil {
		t.Fatal("derived identity accepted a missing title")
	}
}

func TestCanonicalizeURLDoesNotDoubleEncodeEscapes(t *testing.T) {
	got, err := canonicalizeURL("https://example.com/events/a%20show/")
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://example.com/events/a%20show" {
		t.Fatalf("canonical URL = %q, want one escaped space", got)
	}
}

func TestPriceRequiresExplicitPaidState(t *testing.T) {
	version := validTimedVersion()
	maximum := int64(50_000)
	version.Price = &Money{MinMinor: 25_000, MaxMinor: &maximum, Currency: "INR"}
	if err := version.Validate(); err == nil {
		t.Fatal("known price with unknown free state must be rejected")
	}
	paid := false
	version.IsFree = &paid
	if err := version.Validate(); err != nil {
		t.Fatalf("explicit paid state should validate: %v", err)
	}
	free := true
	version.IsFree = &free
	if err := version.Validate(); err == nil {
		t.Fatal("free event with a known price must be rejected")
	}
}

func TestFingerprintIgnoresCosmeticNormalization(t *testing.T) {
	first := validTimedVersion()
	second := first
	second.Title = "  An   Evening   of Music "
	second.SourceURL = "https://BANGALOREINTERNATIONALCENTRE.ORG/event/music/?b=2&a=1#top"
	second.Languages = []string{"Kannada", "English"}
	first.Languages = []string{"english", "kannada"}

	firstFingerprint, err := Fingerprint(first)
	if err != nil {
		t.Fatal(err)
	}
	secondFingerprint, err := Fingerprint(second)
	if err != nil {
		t.Fatal(err)
	}
	if firstFingerprint != secondFingerprint {
		t.Fatalf("cosmetic changes changed fingerprint: %q != %q", firstFingerprint, secondFingerprint)
	}
}

func TestMaterialDiff(t *testing.T) {
	current := validTimedVersion()
	candidate := current
	candidate.Title = "An Evening of Music — Bengaluru"
	if change := MaterialDiff(current, candidate); change.Material() {
		t.Fatalf("title-only correction should not be a public material change: %v", change.Fields)
	}

	later := candidate.StartsAt.Add(30 * time.Minute)
	candidate.StartsAt = &later
	closed := RegistrationClosed
	candidate.RegistrationState = &closed
	change := MaterialDiff(current, candidate)
	want := []ChangedField{FieldStart, FieldRegistrationState}
	if strings.Join(fieldsToStrings(change.Fields), ",") != strings.Join(fieldsToStrings(want), ",") {
		t.Fatalf("fields = %v, want %v", change.Fields, want)
	}
}

func TestRangeForWindowAndOverlap(t *testing.T) {
	tests := []struct {
		name      string
		now       time.Time
		window    Window
		wantStart string
		wantEnd   string
	}{
		{"today", time.Date(2026, time.August, 18, 11, 0, 0, 0, kolkata), WindowToday, "2026-08-18", "2026-08-19"},
		{"tomorrow", time.Date(2026, time.August, 18, 11, 0, 0, 0, kolkata), WindowTomorrow, "2026-08-19", "2026-08-20"},
		{"next weekend", time.Date(2026, time.August, 18, 11, 0, 0, 0, kolkata), WindowWeekend, "2026-08-22", "2026-08-24"},
		{"current weekend Saturday", time.Date(2026, time.August, 22, 11, 0, 0, 0, kolkata), WindowWeekend, "2026-08-22", "2026-08-24"},
		{"current weekend Sunday", time.Date(2026, time.August, 23, 11, 0, 0, 0, kolkata), WindowWeekend, "2026-08-22", "2026-08-24"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := RangeForWindow(test.now, "Asia/Kolkata", test.window)
			if err != nil {
				t.Fatal(err)
			}
			if got.Start.Format(time.DateOnly) != test.wantStart || got.End.Format(time.DateOnly) != test.wantEnd {
				t.Fatalf("range = %s..%s, want %s..%s", got.Start, got.End, test.wantStart, test.wantEnd)
			}
		})
	}

	weekend, _ := RangeForWindow(time.Date(2026, time.August, 18, 11, 0, 0, 0, kolkata), "Asia/Kolkata", WindowWeekend)
	version := validDateVersion(time.Date(2026, time.August, 21, 0, 0, 0, 0, kolkata), time.Date(2026, time.August, 22, 0, 0, 0, 0, kolkata))
	if !OverlapsWindow(version, weekend) {
		t.Fatal("multi-day event overlapping Saturday must appear in weekend")
	}
}

func TestCalendarTimedAndAllDay(t *testing.T) {
	id := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d")
	generatedAt := time.Date(2026, time.August, 18, 10, 0, 0, 0, time.UTC)
	timed := validTimedVersion()
	venue := "BIC, Hall 1"
	timed.VenueName = &venue
	timed.Title = "Music; stories, and more"

	calendar, err := Calendar(Occurrence{ID: id, Version: timed}, generatedAt)
	if err != nil {
		t.Fatal(err)
	}
	value := string(calendar)
	for _, required := range []string{
		"UID:019c5d13-c392-79d2-9012-3ed4242f771d@baahar.app\r\n",
		"DTSTART:20260820T130000Z\r\n",
		"SUMMARY:Music\\; stories\\, and more\r\n",
		"LOCATION:BIC\\, Hall 1\r\n",
	} {
		if !strings.Contains(value, required) {
			t.Errorf("calendar missing %q:\n%s", required, value)
		}
	}
	if !strings.HasSuffix(value, "END:VCALENDAR\r\n") {
		t.Fatal("calendar must use CRLF and terminate the final line")
	}

	allDay := validDateVersion(time.Date(2026, time.August, 20, 0, 0, 0, 0, kolkata), time.Date(2026, time.August, 22, 0, 0, 0, 0, kolkata))
	calendar, err = Calendar(Occurrence{ID: id, Version: allDay}, generatedAt)
	if err != nil {
		t.Fatal(err)
	}
	value = string(calendar)
	if !strings.Contains(value, "DTSTART;VALUE=DATE:20260820\r\n") || !strings.Contains(value, "DTEND;VALUE=DATE:20260823\r\n") {
		t.Fatalf("all-day bounds are not RFC 5545 exclusive-end dates:\n%s", value)
	}
}

func validTimedVersion() Version {
	startDate := time.Date(2026, time.August, 20, 0, 0, 0, 0, kolkata)
	startsAt := time.Date(2026, time.August, 20, 18, 30, 0, 0, kolkata)
	return Version{
		Title:         "An Evening of Music",
		Category:      CategoryMusic,
		SourceURL:     "https://bangaloreinternationalcentre.org/event/music?a=1&b=2",
		StartDate:     startDate,
		StartsAt:      &startsAt,
		TimePrecision: TimePrecisionTimed,
		Timezone:      "Asia/Kolkata",
		Status:        StatusScheduled,
		ObservedAt:    time.Date(2026, time.August, 18, 8, 0, 0, 0, time.UTC),
	}
}

func validDateVersion(start, end time.Time) Version {
	return Version{
		Title:         "Art exhibition",
		Category:      CategoryArts,
		SourceURL:     "https://example.com/exhibition",
		StartDate:     start,
		EndDate:       &end,
		TimePrecision: TimePrecisionDate,
		Timezone:      "Asia/Kolkata",
		Status:        StatusScheduled,
		ObservedAt:    time.Date(2026, time.August, 18, 8, 0, 0, 0, time.UTC),
	}
}

func fieldsToStrings(fields []ChangedField) []string {
	values := make([]string, len(fields))
	for index, field := range fields {
		values[index] = string(field)
	}
	return values
}

func mustLocation(name string) *time.Location {
	location, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return location
}
