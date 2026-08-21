package httpserver

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/ask"
	"github.com/siiddhantt/baahar/internal/events"
)

func TestAskBaaharUsesValidatedIntentForDeterministicEventQuery(t *testing.T) {
	now := time.Date(2026, time.August, 21, 10, 0, 0, 0, time.UTC)
	reader := &askHTTPReader{}
	server := &Server{
		events: reader, ask: fixedAskInterpreter{}, askLimiter: newAskRateLimiter(8, time.Minute),
		now: func() time.Time { return now }, logger: slog.Default(),
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/ask", strings.NewReader(`{"city":"bengaluru","query":"free music this weekend at BIEC"}`))
	server.Handler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if len(reader.queries) != 2 {
		t.Fatalf("queries = %d, want base and result", len(reader.queries))
	}
	result := reader.queries[1]
	if result.CitySlug != "bengaluru" || result.Window != events.WindowWeekend || !result.ExplicitFree || result.Venue != "BIEC" || len(result.Categories) != 1 || result.Categories[0] != events.CategoryMusic {
		t.Fatalf("result query = %+v", result)
	}
	if !strings.Contains(recorder.Body.String(), `"result_count":1`) || !strings.Contains(recorder.Body.String(), `"assisted":true`) {
		t.Fatalf("body = %s", recorder.Body.String())
	}
}

func TestVisitorKeyUsesTheTrustedProxyClientAddress(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/v1/ask", nil)
	request.RemoteAddr = "127.0.0.1:8081"
	request.Header.Set("X-Forwarded-For", "198.51.100.8, 203.0.113.12")
	if got := visitorKey(request); got != "203.0.113.12" {
		t.Fatalf("visitor key = %q", got)
	}

	request.RemoteAddr = "192.0.2.20:41800"
	if got := visitorKey(request); got != "192.0.2.20" {
		t.Fatalf("direct visitor key = %q", got)
	}
}

func TestAskRateLimiterStaysBounded(t *testing.T) {
	limiter := newAskRateLimiter(8, time.Minute)
	now := time.Date(2026, time.August, 21, 10, 0, 0, 0, time.UTC)
	for index := range 4096 {
		if !limiter.Allow(string(rune(index+1)), now) {
			t.Fatalf("visitor %d was unexpectedly rejected", index)
		}
	}
	if limiter.Allow("one-too-many", now) {
		t.Fatal("limiter accepted an unbounded visitor bucket")
	}
	if !limiter.Allow("after-expiry", now.Add(time.Minute)) {
		t.Fatal("limiter did not clear expired visitor buckets")
	}
}

type fixedAskInterpreter struct{}

func (fixedAskInterpreter) Interpret(context.Context, string, ask.Context) (ask.Intent, error) {
	return ask.Intent{
		Window: events.WindowWeekend, Categories: []events.Category{events.CategoryMusic},
		ExplicitlyFree: true, Venue: "BIEC", Assisted: true,
	}, nil
}

type askHTTPReader struct {
	queries []events.FeedQuery
}

func (reader *askHTTPReader) List(_ context.Context, query events.FeedQuery) (events.FeedPage, error) {
	reader.queries = append(reader.queries, query)
	page := events.FeedPage{
		City:   events.City{Slug: "bengaluru", Name: "Bengaluru", Timezone: "Asia/Kolkata", Accent: "rain"},
		Venues: []string{"BIEC", "Town Hall"}, AsOf: query.AsOf, ResultCount: 1,
	}
	if len(reader.queries) == 2 {
		page.Items = []events.PublicOccurrence{{
			ID:   uuid.MustParse("11111111-1111-4111-8111-111111111111"),
			City: page.City,
			Version: events.Version{
				Title: "A verified plan", Category: events.CategoryMusic, StartDate: time.Date(2026, 8, 23, 0, 0, 0, 0, time.FixedZone("IST", 19800)),
				TimePrecision: events.TimePrecisionDate, Timezone: "Asia/Kolkata", Status: events.StatusScheduled,
			},
		}}
	}
	return page, nil
}

func (*askHTTPReader) ListCities(context.Context) ([]events.City, error) { return nil, nil }
func (*askHTTPReader) Get(context.Context, uuid.UUID, time.Time, time.Time) (events.PublicOccurrence, error) {
	return events.PublicOccurrence{}, events.ErrNotFound
}
func (*askHTTPReader) ListChanges(context.Context, uuid.UUID) ([]events.PublicChange, error) {
	return nil, events.ErrNotFound
}
func (*askHTTPReader) SourceSummary(context.Context, string, time.Time) (events.SourceSummary, error) {
	return events.SourceSummary{}, events.ErrNotFound
}
