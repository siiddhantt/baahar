package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/sources"
)

const operatorActor = "operator-token"

var sourceIdentityPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (server *Server) handleOperatorSources(writer http.ResponseWriter, request *http.Request) {
	if !server.requireOperator(writer, request) {
		return
	}
	operatorSources, err := server.operator.ListSources(request.Context(), server.now().UTC())
	if err != nil {
		server.internalError(writer, request, "list operator sources", err)
		return
	}
	items := make([]operatorSourceDTO, len(operatorSources))
	for index, source := range operatorSources {
		items[index] = presentOperatorSource(source)
	}
	writeJSON(writer, request, http.StatusOK, struct {
		Items []operatorSourceDTO `json:"items"`
	}{Items: items}, "no-store")
}

func (server *Server) handleCollectionRuns(writer http.ResponseWriter, request *http.Request) {
	if !server.requireOperator(writer, request) {
		return
	}
	sourceID, ok := parseOperatorUUID(writer, request, "source_id")
	if !ok {
		return
	}
	runs, err := server.runs.ListBySource(request.Context(), sourceID, 100)
	if err != nil {
		server.internalError(writer, request, "list collection runs", err)
		return
	}
	items := make([]collectionRunDTO, len(runs))
	for index, run := range runs {
		items[index] = presentRun(run)
	}
	writeJSON(writer, request, http.StatusOK, struct {
		Items []collectionRunDTO `json:"items"`
	}{Items: items}, "no-store")
}

func (server *Server) handleTriggerCollection(writer http.ResponseWriter, request *http.Request) {
	if !server.requireOperator(writer, request) {
		return
	}
	sourceID, ok := parseOperatorUUID(writer, request, "source_id")
	if !ok {
		return
	}
	idempotencyKey, ok := requireIdempotencyKey(writer, request)
	if !ok {
		return
	}
	run, err := server.operator.QueueCollection(request.Context(), sourceID, idempotencyKey, operatorActor, traceID(request), server.now().UTC())
	if err != nil {
		server.operatorError(writer, request, "queue collection", err)
		return
	}
	writeJSON(writer, request, http.StatusAccepted, presentRun(run), "no-store")
}

func (server *Server) handleReplayCollection(writer http.ResponseWriter, request *http.Request) {
	if !server.requireOperator(writer, request) {
		return
	}
	runID, ok := parseOperatorUUID(writer, request, "run_id")
	if !ok {
		return
	}
	idempotencyKey, ok := requireIdempotencyKey(writer, request)
	if !ok {
		return
	}
	run, err := server.operator.QueueReplay(request.Context(), runID, idempotencyKey, operatorActor, traceID(request), server.now().UTC())
	if err != nil {
		server.operatorError(writer, request, "queue replay", err)
		return
	}
	writeJSON(writer, request, http.StatusAccepted, presentRun(run), "no-store")
}

func (server *Server) handleAcknowledgeIncident(writer http.ResponseWriter, request *http.Request) {
	if !server.requireOperator(writer, request) {
		return
	}
	incidentID, ok := parseOperatorUUID(writer, request, "incident_id")
	if !ok {
		return
	}
	incident, err := server.operator.AcknowledgeIncident(request.Context(), incidentID, operatorActor, traceID(request), server.now().UTC())
	if err != nil {
		server.operatorError(writer, request, "acknowledge incident", err)
		return
	}
	writeJSON(writer, request, http.StatusOK, presentIncident(incident), "no-store")
}

func (server *Server) handleCreateSourceAlias(writer http.ResponseWriter, request *http.Request) {
	if !server.requireOperator(writer, request) {
		return
	}
	sourceID, ok := parseOperatorUUID(writer, request, "source_id")
	if !ok {
		return
	}
	idempotencyKey, ok := requireIdempotencyKey(writer, request)
	if !ok {
		return
	}
	var body struct {
		IncomingIdentity string `json:"incoming_identity"`
		OccurrenceID     string `json:"occurrence_id"`
		Reason           string `json:"reason"`
	}
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_alias_request", "Invalid alias request", "Provide one reviewed incoming identity, occurrence ID, and reason.")
		return
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_alias_request", "Invalid alias request", "The request body must contain exactly one JSON object.")
		return
	}
	occurrenceID, err := uuid.Parse(body.OccurrenceID)
	if err != nil || !sourceIdentityPattern.MatchString(body.IncomingIdentity) || strings.TrimSpace(body.Reason) != body.Reason || utf8.RuneCountInString(body.Reason) < 1 || utf8.RuneCountInString(body.Reason) > 1000 {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_alias_request", "Invalid alias request", "The identity, occurrence ID, or review reason is invalid.")
		return
	}
	alias, err := server.operator.CreateSourceAlias(
		request.Context(), sourceID, body.IncomingIdentity, occurrenceID, body.Reason,
		idempotencyKey, operatorActor, traceID(request), server.now().UTC(),
	)
	if err != nil {
		server.operatorError(writer, request, "create source alias", err)
		return
	}
	writeJSON(writer, request, http.StatusCreated, presentSourceAlias(alias), "no-store")
}

func parseOperatorUUID(writer http.ResponseWriter, request *http.Request, name string) (uuid.UUID, bool) {
	value, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_operator_id", "Invalid identifier", "The route identifier must be a UUID.")
		return uuid.Nil, false
	}
	return value, true
}

func requireIdempotencyKey(writer http.ResponseWriter, request *http.Request) (string, bool) {
	value := request.Header.Get("Idempotency-Key")
	if len(value) < 16 || len(value) > 200 || strings.TrimSpace(value) != value {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_idempotency_key", "Invalid idempotency key", "Idempotency-Key must contain 16 to 200 non-padded characters.")
		return "", false
	}
	return value, true
}

func (server *Server) operatorError(writer http.ResponseWriter, request *http.Request, operation string, err error) {
	if errors.Is(err, sources.ErrNotFound) {
		writeProblem(writer, request, http.StatusNotFound, "operator_resource_not_found", "Resource not found", "The operator resource does not exist.")
		return
	}
	if errors.Is(err, sources.ErrConflict) {
		writeProblem(writer, request, http.StatusConflict, "source_alias_conflict", "Alias conflicts with reviewed state", "The incoming identity or idempotency key is already assigned differently.")
		return
	}
	server.internalError(writer, request, operation, err)
}
