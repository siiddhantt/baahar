package httpserver

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/siddhantk232/baahar/internal/events"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type feedRequest struct {
	City         string
	Window       events.Window
	Categories   []events.Category
	ExplicitFree bool
	Cursor       string
	Limit        int
}

func (server *Server) handleCities(writer http.ResponseWriter, request *http.Request) {
	cities, err := server.events.ListCities(request.Context())
	if err != nil {
		server.internalError(writer, request, "list cities", err)
		return
	}
	items := make([]cityDTO, len(cities))
	for index, city := range cities {
		items[index] = presentCity(city)
	}
	writeJSON(writer, request, http.StatusOK, struct {
		Items []cityDTO `json:"items"`
	}{Items: items}, "public, max-age=300, stale-while-revalidate=3600")
}

func (server *Server) handleEvents(writer http.ResponseWriter, request *http.Request) {
	parsed, err := parseFeedRequest(request)
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_feed_query", "Invalid event filters", err.Error())
		return
	}
	asOf := server.now().UTC()
	query := events.FeedQuery{
		CitySlug:     parsed.City,
		Window:       parsed.Window,
		AsOf:         asOf,
		Categories:   parsed.Categories,
		ExplicitFree: parsed.ExplicitFree,
		Limit:        parsed.Limit,
	}
	if parsed.Cursor != "" {
		decoded, err := server.cursors.Decode(parsed.Cursor, parsed)
		if err != nil {
			writeProblem(writer, request, http.StatusBadRequest, "invalid_cursor", "Invalid page cursor", err.Error())
			return
		}
		query.After = &decoded.Boundary
		query.AsOf = decoded.AsOf
	}
	page, err := server.events.List(request.Context(), query)
	if err != nil {
		if errors.Is(err, events.ErrNotFound) {
			writeProblem(writer, request, http.StatusNotFound, "city_not_available", "City is not available", "This city is not currently published.")
			return
		}
		server.internalError(writer, request, "list events", err)
		return
	}
	items := make([]eventDTO, len(page.Items))
	for index, occurrence := range page.Items {
		items[index] = presentEvent(occurrence)
	}
	var nextCursor *string
	if page.Next != nil {
		value, err := server.cursors.Encode(parsed, *page.Next, page.AsOf)
		if err != nil {
			server.internalError(writer, request, "encode feed cursor", err)
			return
		}
		nextCursor = &value
	}
	writeJSON(writer, request, http.StatusOK, eventPageDTO{
		Items:      items,
		NextCursor: nextCursor,
		Meta: eventMetaDTO{
			City:          presentCity(page.City),
			Window:        string(parsed.Window),
			ResultCount:   page.ResultCount,
			SourceCount:   page.SourceCount,
			LastCheckedAt: page.LastCheckedAt,
			PageSize:      len(items),
			HasMore:       page.Next != nil,
			AsOf:          page.AsOf,
		},
	}, "public, max-age=60, stale-while-revalidate=300")
}

func (server *Server) handleEventRoute(writer http.ResponseWriter, request *http.Request) {
	rawID := request.PathValue("occurrence_id")
	if strings.HasSuffix(rawID, ".ics") {
		server.handleCalendar(writer, request, strings.TrimSuffix(rawID, ".ics"))
		return
	}
	occurrenceID, err := uuid.Parse(rawID)
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_occurrence_id", "Invalid event ID", "The event ID must be a UUID.")
		return
	}
	now := server.now().UTC()
	occurrence, err := server.events.Get(request.Context(), occurrenceID, now, now.Add(-48*time.Hour))
	if err != nil {
		server.eventReadError(writer, request, "get event", err)
		return
	}
	writeJSON(writer, request, http.StatusOK, presentEvent(occurrence), "public, max-age=300, stale-while-revalidate=1800")
}

func (server *Server) handleCalendar(writer http.ResponseWriter, request *http.Request, rawID string) {
	occurrenceID, err := uuid.Parse(rawID)
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_occurrence_id", "Invalid event ID", "The event ID must be a UUID.")
		return
	}
	now := server.now().UTC()
	occurrence, err := server.events.Get(request.Context(), occurrenceID, now, now.Add(-48*time.Hour))
	if err != nil {
		server.eventReadError(writer, request, "get event calendar", err)
		return
	}
	calendar, err := events.Calendar(events.Occurrence{ID: occurrence.ID, Version: occurrence.Version}, now)
	if err != nil {
		server.internalError(writer, request, "create event calendar", err)
		return
	}
	writer.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=1800")
	writer.Header().Set("Content-Disposition", `attachment; filename="baahar-event-`+occurrence.ID.String()+`.ics"`)
	writer.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(calendar)
}

func (server *Server) handleEventChanges(writer http.ResponseWriter, request *http.Request) {
	occurrenceID, err := uuid.Parse(request.PathValue("occurrence_id"))
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_occurrence_id", "Invalid event ID", "The event ID must be a UUID.")
		return
	}
	changes, err := server.events.ListChanges(request.Context(), occurrenceID)
	if err != nil {
		server.eventReadError(writer, request, "list event changes", err)
		return
	}
	items := make([]eventChangeDTO, len(changes))
	for index, change := range changes {
		items[index] = eventChangeDTO{ID: change.ID.String(), Kind: change.Kind, ChangedFields: change.ChangedFields, ChangedAt: change.ChangedAt}
	}
	writeJSON(writer, request, http.StatusOK, struct {
		Items []eventChangeDTO `json:"items"`
	}{Items: items}, "public, max-age=300, stale-while-revalidate=1800")
}

func (server *Server) handleSourceSummary(writer http.ResponseWriter, request *http.Request) {
	slug := request.PathValue("source_slug")
	if len(slug) > 80 || !slugPattern.MatchString(slug) {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_source_slug", "Invalid source", "The source slug is invalid.")
		return
	}
	summary, err := server.events.SourceSummary(request.Context(), slug, server.now().UTC())
	if err != nil {
		server.eventReadError(writer, request, "get source summary", err)
		return
	}
	writeJSON(writer, request, http.StatusOK, sourceSummaryDTO{
		Slug:          summary.Source.Slug,
		Name:          summary.Source.Name,
		OfficialURL:   summary.Source.OfficialURL,
		City:          presentCity(summary.City),
		Freshness:     summary.Source.Freshness,
		LastHealthyAt: summary.Source.LastHealthyAt,
	}, "public, max-age=60, stale-while-revalidate=300")
}

func parseFeedRequest(request *http.Request) (feedRequest, error) {
	query := request.URL.Query()
	city := query.Get("city")
	if len(city) > 80 || !slugPattern.MatchString(city) {
		return feedRequest{}, errors.New("city must be a valid city slug")
	}
	window := events.Window(query.Get("window"))
	if window == "" {
		window = events.WindowUpcoming
	}
	if window != events.WindowUpcoming && window != events.WindowToday && window != events.WindowTomorrow && window != events.WindowWeekend {
		return feedRequest{}, errors.New("window must be upcoming, today, tomorrow, or weekend")
	}
	categories, err := parseCategories(query.Get("category"))
	if err != nil {
		return feedRequest{}, err
	}
	explicitFree := false
	if raw := query.Get("free"); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			return feedRequest{}, errors.New("free must be true or false")
		}
		explicitFree = value
	}
	limit := 24
	if raw := query.Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 60 {
			return feedRequest{}, errors.New("limit must be between 1 and 60")
		}
		limit = value
	}
	cursor := query.Get("cursor")
	if len(cursor) > 1024 {
		return feedRequest{}, errors.New("cursor is too long")
	}
	return feedRequest{City: city, Window: window, Categories: categories, ExplicitFree: explicitFree, Cursor: cursor, Limit: limit}, nil
}

func parseCategories(raw string) ([]events.Category, error) {
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	if len(parts) > 8 {
		return nil, errors.New("at most eight categories are allowed")
	}
	seen := make(map[events.Category]bool, len(parts))
	result := make([]events.Category, 0, len(parts))
	for _, part := range parts {
		category := events.Category(part)
		switch category {
		case events.CategoryArts, events.CategoryTalks, events.CategoryWorkshops, events.CategoryTheatre, events.CategoryMusic, events.CategoryBooks, events.CategoryCommunity, events.CategoryOther:
		default:
			return nil, errors.New("category contains an unsupported value")
		}
		if seen[category] {
			return nil, errors.New("category values must be unique")
		}
		seen[category] = true
		result = append(result, category)
	}
	return result, nil
}

func (server *Server) eventReadError(writer http.ResponseWriter, request *http.Request, operation string, err error) {
	if errors.Is(err, events.ErrNotFound) {
		writeProblem(writer, request, http.StatusNotFound, "event_not_found", "Event not found", "No current verified event matches this request.")
		return
	}
	server.internalError(writer, request, operation, err)
}

func (server *Server) internalError(writer http.ResponseWriter, request *http.Request, operation string, err error) {
	server.logger.ErrorContext(request.Context(), operation, "trace_id", traceID(request), "error", err)
	writeProblem(writer, request, http.StatusInternalServerError, "internal_error", "Internal server error", "The request could not be completed.")
}
