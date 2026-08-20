package httpserver

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/events"
)

func TestCursorRoundTripPreservesAnchorAndBindsFilters(t *testing.T) {
	codec, err := newCursorCodec("cursor-secret-that-is-long-enough-for-tests")
	if err != nil {
		t.Fatal(err)
	}
	request := feedRequest{
		City:         "mysuru",
		Window:       events.WindowUpcoming,
		Categories:   []events.Category{events.CategoryMusic, events.CategoryArts},
		ExplicitFree: true,
	}
	asOf := time.Date(2026, time.August, 19, 12, 30, 45, 123, time.FixedZone("IST", 5*60*60+30*60))
	boundary := events.CursorBoundary{
		SortAt:       time.Date(2026, time.August, 22, 8, 0, 0, 0, time.UTC),
		OccurrenceID: uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d"),
	}

	encoded, err := codec.Encode(request, boundary, asOf)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := codec.Decode(encoded, request)
	if err != nil {
		t.Fatal(err)
	}
	if !decoded.AsOf.Equal(asOf) || decoded.Boundary != boundary {
		t.Fatalf("decoded cursor = %+v, want as-of %s and boundary %+v", decoded, asOf, boundary)
	}
	request.Limit = 60
	if _, err := codec.Decode(encoded, request); err != nil {
		t.Fatalf("cursor should permit changing the page size: %v", err)
	}

	request.Window = events.WindowToday
	if _, err := codec.Decode(encoded, request); err == nil {
		t.Fatal("cursor was accepted with a different window")
	}
}
