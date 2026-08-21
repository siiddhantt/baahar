package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/events"
)

func TestEventFeedDefaultsToUpcomingAndReusesCursorAnchor(t *testing.T) {
	firstNow := time.Date(2026, time.August, 19, 9, 0, 0, 0, time.UTC)
	reader := &feedHTTPReader{}
	codec, err := newCursorCodec("cursor-secret-that-is-long-enough-for-tests")
	if err != nil {
		t.Fatal(err)
	}
	nowCalls := 0
	server := &Server{
		cursors: codec,
		events:  reader,
		now: func() time.Time {
			nowCalls++
			return firstNow.Add(time.Duration(nowCalls-1) * time.Hour)
		},
	}
	handler := server.Handler()

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/v1/events?city=mysuru&venue=Town%20Hall&limit=1", nil))
	if first.Code != http.StatusOK {
		t.Fatalf("first page status = %d, body = %s", first.Code, first.Body.String())
	}
	var firstPage eventPageDTO
	if err := json.Unmarshal(first.Body.Bytes(), &firstPage); err != nil {
		t.Fatal(err)
	}
	if firstPage.Meta.Window != string(events.WindowUpcoming) || firstPage.Meta.PageSize != 1 || !firstPage.Meta.HasMore || firstPage.NextCursor == nil {
		t.Fatalf("first page metadata = %+v, cursor = %v", firstPage.Meta, firstPage.NextCursor)
	}
	if !firstPage.Meta.AsOf.Equal(firstNow) {
		t.Fatalf("first page as_of = %s, want %s", firstPage.Meta.AsOf, firstNow)
	}

	second := httptest.NewRecorder()
	path := "/v1/events?city=mysuru&venue=Town%20Hall&limit=1&cursor=" + *firstPage.NextCursor
	handler.ServeHTTP(second, httptest.NewRequest(http.MethodGet, path, nil))
	if second.Code != http.StatusOK {
		t.Fatalf("second page status = %d, body = %s", second.Code, second.Body.String())
	}
	if len(reader.queries) != 2 {
		t.Fatalf("feed query count = %d, want 2", len(reader.queries))
	}
	if reader.queries[0].CitySlug != "mysuru" || reader.queries[0].Window != events.WindowUpcoming || reader.queries[0].Venue != "Town Hall" {
		t.Fatalf("first feed query = %+v", reader.queries[0])
	}
	if !reader.queries[1].AsOf.Equal(firstNow) {
		t.Fatalf("second page as-of = %s, want signed first-page anchor %s", reader.queries[1].AsOf, firstNow)
	}
	var secondPage eventPageDTO
	if err := json.Unmarshal(second.Body.Bytes(), &secondPage); err != nil {
		t.Fatal(err)
	}
	if secondPage.Meta.HasMore || secondPage.NextCursor != nil {
		t.Fatalf("terminal page has_more/cursor = %v/%v, want false/nil", secondPage.Meta.HasMore, secondPage.NextCursor)
	}
}

func TestParseCategoriesAcceptsCompleteConsumerTaxonomy(t *testing.T) {
	categories, err := parseCategories("arts,talks,workshops,theatre,music,books,community,other")
	if err != nil {
		t.Fatal(err)
	}
	if len(categories) != 8 || categories[2] != events.CategoryWorkshops {
		t.Fatalf("categories = %v", categories)
	}
}

type feedHTTPReader struct {
	queries []events.FeedQuery
}

func (reader *feedHTTPReader) List(_ context.Context, query events.FeedQuery) (events.FeedPage, error) {
	reader.queries = append(reader.queries, query)
	page := events.FeedPage{
		Items: []events.PublicOccurrence{{
			ID: uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771e"),
			Version: events.Version{
				Title: "A plan",
			},
		}},
		City: events.City{
			Slug: "mysuru", Name: "Mysuru", Timezone: "Asia/Kolkata", Accent: "palace",
		},
		AsOf:   query.AsOf,
		Venues: []string{"Town Hall", "Reading Room"},
	}
	if len(reader.queries) == 1 {
		page.Next = &events.CursorBoundary{
			SortAt:       time.Date(2026, time.August, 20, 12, 0, 0, 0, time.UTC),
			OccurrenceID: uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771d"),
		}
	}
	return page, nil
}

func (*feedHTTPReader) ListCities(context.Context) ([]events.City, error) {
	return nil, nil
}

func (*feedHTTPReader) Get(context.Context, uuid.UUID, time.Time, time.Time) (events.PublicOccurrence, error) {
	return events.PublicOccurrence{}, events.ErrNotFound
}

func (*feedHTTPReader) ListChanges(context.Context, uuid.UUID) ([]events.PublicChange, error) {
	return nil, events.ErrNotFound
}

func (*feedHTTPReader) SourceSummary(context.Context, string, time.Time) (events.SourceSummary, error) {
	return events.SourceSummary{}, events.ErrNotFound
}
