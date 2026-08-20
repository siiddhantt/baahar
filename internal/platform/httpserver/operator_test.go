package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/events"
	"github.com/siiddhantt/baahar/internal/sources"
)

func TestOperatorHTTPProjectsAndAcknowledgesActiveIncident(t *testing.T) {
	now := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)
	incident := sources.Incident{
		ID:        uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f7790"),
		SourceID:  uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		Code:      "empty_output",
		State:     "open",
		CreatedAt: now,
	}
	store := &operatorHTTPStore{incident: incident}
	server := &Server{
		operatorToken: "operator-token-with-enough-bytes",
		operator:      store,
		logger:        slog.Default(),
		now:           func() time.Time { return now },
	}
	handler := server.Handler()

	listed := performOperatorRequest(t, handler, http.MethodGet, "/v1/operator/sources")
	if listed.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", listed.Code, listed.Body.String())
	}
	var response struct {
		Items []operatorSourceDTO `json:"items"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Items) != 1 || response.Items[0].SchemaVersion != "event-occurrence/v1" || response.Items[0].ActiveIncident == nil {
		t.Fatalf("operator HTTP projection = %+v", response.Items)
	}
	if response.Items[0].ActiveIncident.ID != incident.ID.String() || response.Items[0].ActiveIncident.State != "open" {
		t.Fatalf("active incident DTO = %+v", response.Items[0].ActiveIncident)
	}

	acknowledged := performOperatorRequest(t, handler, http.MethodPost, "/v1/operator/incidents/"+incident.ID.String()+"/acknowledge")
	if acknowledged.Code != http.StatusOK {
		t.Fatalf("acknowledge status = %d, body = %s", acknowledged.Code, acknowledged.Body.String())
	}
	var acknowledgedDTO incidentDTO
	if err := json.Unmarshal(acknowledged.Body.Bytes(), &acknowledgedDTO); err != nil {
		t.Fatal(err)
	}
	if acknowledgedDTO.State != "acknowledged" || acknowledgedDTO.AcknowledgedAt == nil {
		t.Fatalf("acknowledged DTO = %+v", acknowledgedDTO)
	}

	listed = performOperatorRequest(t, handler, http.MethodGet, "/v1/operator/sources")
	if err := json.Unmarshal(listed.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Items[0].ActiveIncident != nil {
		t.Fatalf("acknowledged incident remained in operator projection: %+v", response.Items[0].ActiveIncident)
	}
}

func TestOperatorHTTPCreatesReviewedSourceAlias(t *testing.T) {
	now := time.Date(2026, time.August, 19, 12, 0, 0, 0, time.UTC)
	sourceID := uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f")
	occurrenceID := uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f7791")
	store := &operatorHTTPStore{}
	server := &Server{operatorToken: "operator-token-with-enough-bytes", operator: store, logger: slog.Default(), now: func() time.Time { return now }}
	body := []byte(`{"incoming_identity":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","occurrence_id":"019c5d13-c392-79d2-9012-3ed4242f7791","reason":"Official page corrected the performance time."}`)
	request := httptest.NewRequest(http.MethodPost, "/v1/operator/sources/"+sourceID.String()+"/aliases", bytes.NewReader(body))
	request.Header.Set("Authorization", "Bearer operator-token-with-enough-bytes")
	request.Header.Set("Idempotency-Key", "alias-review-0001")
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("create alias status = %d, body = %s", response.Code, response.Body.String())
	}
	var alias sourceAliasDTO
	if err := json.Unmarshal(response.Body.Bytes(), &alias); err != nil {
		t.Fatal(err)
	}
	if alias.SourceID != sourceID.String() || alias.OccurrenceID != occurrenceID.String() || alias.Reason == "" {
		t.Fatalf("alias response = %+v", alias)
	}
}

func performOperatorRequest(t *testing.T, handler http.Handler, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, nil)
	request.Header.Set("Authorization", "Bearer operator-token-with-enough-bytes")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

type operatorHTTPStore struct {
	incident sources.Incident
	acked    bool
}

func (store *operatorHTTPStore) ListSources(context.Context, time.Time) ([]sources.OperatorSource, error) {
	source := sources.OperatorSource{
		ID:            store.incident.SourceID,
		Slug:          "bic",
		Name:          "Bangalore International Centre",
		OfficialURL:   "https://bangaloreinternationalcentre.org/",
		City:          events.City{Slug: "bengaluru", Name: "Bengaluru", Timezone: "Asia/Kolkata", Accent: "rain"},
		Freshness:     "stale",
		CollectorID:   "c_msyr5ts21rq3nfjxrz",
		SchemaVersion: "event-occurrence/v1",
	}
	if !store.acked {
		incident := store.incident
		source.ActiveIncident = &incident
	}
	return []sources.OperatorSource{source}, nil
}

func (store *operatorHTTPStore) QueueCollection(context.Context, uuid.UUID, string, string, string, time.Time) (collections.Run, error) {
	return collections.Run{}, nil
}

func (store *operatorHTTPStore) QueueReplay(context.Context, uuid.UUID, string, string, string, time.Time) (collections.Run, error) {
	return collections.Run{}, nil
}

func (store *operatorHTTPStore) AcknowledgeIncident(_ context.Context, incidentID uuid.UUID, _, _ string, now time.Time) (sources.Incident, error) {
	incident := store.incident
	incident.ID = incidentID
	incident.State = "acknowledged"
	incident.AcknowledgedAt = &now
	store.incident = incident
	store.acked = true
	return incident, nil
}

func (store *operatorHTTPStore) CreateSourceAlias(_ context.Context, sourceID uuid.UUID, identity string, occurrenceID uuid.UUID, reason, _, _, _ string, now time.Time) (sources.IdentityAlias, error) {
	return sources.IdentityAlias{SourceID: sourceID, IncomingIdentity: identity, OccurrenceID: occurrenceID, Reason: reason, CreatedAt: now}, nil
}
