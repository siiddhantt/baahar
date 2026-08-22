package httpserver

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/siiddhantt/baahar/internal/ask"
	"github.com/siiddhantt/baahar/internal/events"
)

func (server *Server) handleAsk(writer http.ResponseWriter, request *http.Request) {
	if !server.askLimiter.Allow(visitorKey(request), server.now()) {
		writer.Header().Set("Retry-After", "60")
		writeProblem(writer, request, http.StatusTooManyRequests, "ask_rate_limited", "Mau needs a breather", "Try another request in a minute.")
		return
	}
	var input askRequestDTO
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_ask_request", "Mau could not read that", "Send a city and one short request.")
		return
	}
	input.City = strings.TrimSpace(input.City)
	input.Query = strings.TrimSpace(input.Query)
	if !slugPattern.MatchString(input.City) || len(input.City) > 80 || input.Query == "" || len([]rune(input.Query)) > ask.MaximumQueryLength {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_ask_request", "Mau could not read that", "Use an available city and a request of 280 characters or fewer.")
		return
	}
	now := server.now().UTC()
	cities, err := server.events.ListCities(request.Context())
	if err != nil {
		server.internalError(writer, request, "prepare Mau", err)
		return
	}
	scope := ask.Context{CurrentCity: input.City, Now: now, Cities: make([]ask.CityScope, 0, len(cities))}
	currentCityAvailable := false
	for _, city := range cities {
		if city.Slug == input.City {
			currentCityAvailable = true
		}
		base, listErr := server.events.List(request.Context(), events.FeedQuery{
			CitySlug: city.Slug, Window: events.WindowUpcoming, AsOf: now, Limit: 1,
		})
		if listErr != nil {
			server.internalError(writer, request, "prepare Mau city", listErr)
			return
		}
		scope.Cities = append(scope.Cities, ask.CityScope{
			Slug: base.City.Slug, Name: base.City.Name, Timezone: base.City.Timezone, Venues: base.Venues,
		})
	}
	if !currentCityAvailable {
		writeProblem(writer, request, http.StatusNotFound, "city_not_available", "City is not available", "This city is not currently published.")
		return
	}
	intent, err := server.ask.Interpret(request.Context(), input.Query, scope)
	if err == nil {
		err = ask.Validate(intent, scope)
	}
	if err != nil {
		server.logger.WarnContext(request.Context(), "interpret Mau request", "trace_id", traceID(request), "error", err)
		writeProblem(writer, request, http.StatusServiceUnavailable, "ask_unavailable", "Mau is having a quiet moment", "Try again shortly. Your event board is still available.")
		return
	}
	page, err := server.events.List(request.Context(), events.FeedQuery{
		CitySlug: intent.City, Window: intent.Window, AsOf: now, Categories: intent.Categories,
		ExplicitFree: intent.ExplicitlyFree, Venue: intent.Venue, Limit: 6,
	})
	if err != nil {
		server.internalError(writer, request, "query Mau results", err)
		return
	}
	items := make([]eventDTO, len(page.Items))
	for index, occurrence := range page.Items {
		items[index] = presentEvent(occurrence)
	}
	categories := make([]string, len(intent.Categories))
	for index, category := range intent.Categories {
		categories[index] = string(category)
	}
	var venue *string
	if intent.Venue != "" {
		value := intent.Venue
		venue = &value
	}
	writeJSON(writer, request, http.StatusOK, askResultDTO{
		Interpretation: askInterpretationDTO{
			City: intent.City, Window: string(intent.Window), Categories: categories, ExplicitlyFree: intent.ExplicitlyFree,
			Venue: venue,
		},
		Items: items, ResultCount: page.ResultCount, AsOf: page.AsOf,
	}, "no-store")
}

type askVisit struct {
	Count int
	Reset time.Time
}

type askRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]askVisit
	limit    int
	window   time.Duration
}

func newAskRateLimiter(limit int, window time.Duration) *askRateLimiter {
	return &askRateLimiter{visitors: make(map[string]askVisit), limit: limit, window: window}
}

func (limiter *askRateLimiter) Allow(key string, now time.Time) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	visit, known := limiter.visitors[key]
	if !known && len(limiter.visitors) >= 4096 {
		for visitor, candidate := range limiter.visitors {
			if !now.Before(candidate.Reset) {
				delete(limiter.visitors, visitor)
			}
		}
		if len(limiter.visitors) >= 4096 {
			return false
		}
	}
	if visit.Reset.IsZero() || !now.Before(visit.Reset) {
		limiter.visitors[key] = askVisit{Count: 1, Reset: now.Add(limiter.window)}
		return true
	}
	if visit.Count >= limiter.limit {
		return false
	}
	visit.Count++
	limiter.visitors[key] = visit
	return true
}

func visitorKey(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil && net.ParseIP(host) != nil {
		if net.ParseIP(host).IsLoopback() {
			forwarded := strings.Split(request.Header.Get("X-Forwarded-For"), ",")
			for index := len(forwarded) - 1; index >= 0; index-- {
				candidate := strings.TrimSpace(forwarded[index])
				if net.ParseIP(candidate) != nil {
					return candidate
				}
			}
		}
		return host
	}
	if request.RemoteAddr != "" {
		return request.RemoteAddr
	}
	return "unknown"
}
