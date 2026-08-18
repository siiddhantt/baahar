package httpserver

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/events"
	"github.com/siddhantk232/baahar/internal/sources"
)

type EventReader interface {
	ListCities(context.Context) ([]events.City, error)
	List(context.Context, events.FeedQuery) (events.FeedPage, error)
	Get(context.Context, uuid.UUID, time.Time, time.Time) (events.PublicOccurrence, error)
	ListChanges(context.Context, uuid.UUID) ([]events.PublicChange, error)
	SourceSummary(context.Context, string, time.Time) (events.SourceSummary, error)
}

type RunReader interface {
	ListBySource(context.Context, uuid.UUID, int) ([]collections.Run, error)
}

type OperatorStore interface {
	ListSources(context.Context, time.Time) ([]sources.OperatorSource, error)
	QueueCollection(context.Context, uuid.UUID, string, string, string, time.Time) (collections.Run, error)
	QueueReplay(context.Context, uuid.UUID, string, string, string, time.Time) (collections.Run, error)
	AcknowledgeIncident(context.Context, uuid.UUID, string, string, time.Time) (sources.Incident, error)
}

type Config struct {
	WebOrigin     string
	OperatorToken string
	CursorSecret  string
	Events        EventReader
	Runs          RunReader
	Operator      OperatorStore
	Logger        *slog.Logger
	Now           func() time.Time
}

type Server struct {
	webOrigin     string
	operatorToken string
	cursors       cursorCodec
	events        EventReader
	runs          RunReader
	operator      OperatorStore
	logger        *slog.Logger
	now           func() time.Time
}

type traceContextKey struct{}

func New(config Config) (*Server, error) {
	if config.Events == nil || config.Runs == nil || config.Operator == nil {
		return nil, errors.New("event, run, and operator stores are required")
	}
	if len(config.OperatorToken) < 24 {
		return nil, errors.New("operator token must be at least 24 bytes")
	}
	cursors, err := newCursorCodec(config.CursorSecret)
	if err != nil {
		return nil, err
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	if config.Now == nil {
		config.Now = time.Now
	}
	return &Server{
		webOrigin:     strings.TrimSuffix(config.WebOrigin, "/"),
		operatorToken: config.OperatorToken,
		cursors:       cursors,
		events:        config.Events,
		runs:          config.Runs,
		operator:      config.Operator,
		logger:        config.Logger,
		now:           config.Now,
	}, nil
}

func (server *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/cities", server.handleCities)
	mux.HandleFunc("GET /v1/events", server.handleEvents)
	mux.HandleFunc("GET /v1/events/{occurrence_id}/changes", server.handleEventChanges)
	mux.HandleFunc("GET /v1/events/{occurrence_id}", server.handleEventRoute)
	mux.HandleFunc("GET /v1/sources/{source_slug}/summary", server.handleSourceSummary)
	mux.HandleFunc("GET /v1/operator/sources", server.handleOperatorSources)
	mux.HandleFunc("GET /v1/operator/sources/{source_id}/runs", server.handleCollectionRuns)
	mux.HandleFunc("POST /v1/operator/sources/{source_id}/runs", server.handleTriggerCollection)
	mux.HandleFunc("POST /v1/operator/runs/{run_id}/replay", server.handleReplayCollection)
	mux.HandleFunc("POST /v1/operator/incidents/{incident_id}/acknowledge", server.handleAcknowledgeIncident)
	return server.middleware(mux)
}

func (server *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		traceID := uuid.Must(uuid.NewV7()).String()
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		writer.Header().Set("Referrer-Policy", "no-referrer")
		writer.Header().Set("X-Frame-Options", "DENY")
		writer.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		writer.Header().Set("X-Request-ID", traceID)
		if server.webOrigin != "" {
			writer.Header().Add("Vary", "Origin")
		}
		if origin := request.Header.Get("Origin"); origin != "" && origin == server.webOrigin {
			writer.Header().Set("Access-Control-Allow-Origin", origin)
			writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Idempotency-Key, Content-Type")
			writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		}
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		if request.Method == http.MethodPost {
			request.Body = http.MaxBytesReader(writer, request.Body, 1024)
		}
		ctx := context.WithValue(request.Context(), traceContextKey{}, traceID)
		defer func() {
			if recovered := recover(); recovered != nil {
				server.logger.ErrorContext(ctx, "HTTP panic recovered", "trace_id", traceID, "panic", fmt.Sprint(recovered))
				writeProblem(writer, request, http.StatusInternalServerError, "internal_error", "Internal server error", "The request could not be completed.")
			}
		}()
		next.ServeHTTP(writer, request.WithContext(ctx))
	})
}

func (server *Server) requireOperator(writer http.ResponseWriter, request *http.Request) bool {
	header := request.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		writer.Header().Set("WWW-Authenticate", "Bearer")
		writeProblem(writer, request, http.StatusUnauthorized, "operator_auth_required", "Operator authentication required", "Provide the operator bearer token.")
		return false
	}
	provided := strings.TrimPrefix(header, "Bearer ")
	if len(provided) != len(server.operatorToken) || subtle.ConstantTimeCompare([]byte(provided), []byte(server.operatorToken)) != 1 {
		writer.Header().Set("WWW-Authenticate", "Bearer")
		writeProblem(writer, request, http.StatusUnauthorized, "operator_auth_invalid", "Operator authentication failed", "The operator bearer token is invalid.")
		return false
	}
	return true
}

func writeJSON(writer http.ResponseWriter, request *http.Request, status int, value any, cacheControl string) {
	content, err := json.Marshal(value)
	if err != nil {
		writeProblem(writer, request, http.StatusInternalServerError, "response_encoding_failed", "Internal server error", "The response could not be encoded.")
		return
	}
	digest := sha256.Sum256(content)
	etag := `"` + hex.EncodeToString(digest[:]) + `"`
	if cacheControl != "" {
		writer.Header().Set("Cache-Control", cacheControl)
	}
	writer.Header().Set("ETag", etag)
	if etagMatches(request.Header.Get("If-None-Match"), etag) {
		writer.WriteHeader(http.StatusNotModified)
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write(content)
}

func writeProblem(writer http.ResponseWriter, request *http.Request, status int, code, title, detail string) {
	content, _ := json.Marshal(problemDTO{
		Type:     "https://baahar.app/problems/" + code,
		Title:    title,
		Status:   status,
		Detail:   detail,
		Instance: request.URL.Path,
		Code:     code,
	})
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	writer.WriteHeader(status)
	_, _ = writer.Write(content)
}

func etagMatches(header, current string) bool {
	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == current || candidate == "W/"+current {
			return true
		}
	}
	return false
}

func traceID(request *http.Request) string {
	value, _ := request.Context().Value(traceContextKey{}).(string)
	return value
}
