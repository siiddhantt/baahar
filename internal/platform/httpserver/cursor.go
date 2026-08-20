package httpserver

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/events"
)

type cursorCodec struct {
	key []byte
}

type cursorPayload struct {
	Version      int      `json:"v"`
	City         string   `json:"city"`
	Window       string   `json:"window"`
	Categories   []string `json:"categories"`
	ExplicitFree bool     `json:"free"`
	AsOf         string   `json:"as_of"`
	SortAt       string   `json:"sort_at"`
	OccurrenceID string   `json:"occurrence_id"`
}

func newCursorCodec(secret string) (cursorCodec, error) {
	if len(secret) < 32 {
		return cursorCodec{}, errors.New("cursor secret must be at least 32 bytes")
	}
	return cursorCodec{key: []byte(secret)}, nil
}

type decodedCursor struct {
	Boundary events.CursorBoundary
	AsOf     time.Time
}

func (codec cursorCodec) Encode(query feedRequest, boundary events.CursorBoundary, asOf time.Time) (string, error) {
	if asOf.IsZero() {
		return "", errors.New("cursor as-of time is required")
	}
	payload := cursorPayload{
		Version:      2,
		City:         query.City,
		Window:       string(query.Window),
		Categories:   sortedCategories(query.Categories),
		ExplicitFree: query.ExplicitFree,
		AsOf:         asOf.UTC().Format(time.RFC3339Nano),
		SortAt:       boundary.SortAt.UTC().Format(time.RFC3339Nano),
		OccurrenceID: boundary.OccurrenceID.String(),
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("encode cursor: %w", err)
	}
	signature := codec.sign(encoded)
	return base64.RawURLEncoding.EncodeToString(encoded) + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func (codec cursorCodec) Decode(value string, query feedRequest) (decodedCursor, error) {
	parts := strings.Split(value, ".")
	if len(parts) != 2 {
		return decodedCursor{}, errors.New("cursor has invalid format")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return decodedCursor{}, errors.New("cursor has invalid encoding")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(signature, codec.sign(payloadBytes)) {
		return decodedCursor{}, errors.New("cursor signature is invalid")
	}
	var payload cursorPayload
	decoder := json.NewDecoder(strings.NewReader(string(payloadBytes)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		return decodedCursor{}, errors.New("cursor payload is invalid")
	}
	if payload.Version != 2 || payload.City != query.City || payload.Window != string(query.Window) || payload.ExplicitFree != query.ExplicitFree || !equalStrings(payload.Categories, sortedCategories(query.Categories)) {
		return decodedCursor{}, errors.New("cursor does not match the current filters")
	}
	asOf, err := time.Parse(time.RFC3339Nano, payload.AsOf)
	if err != nil || asOf.IsZero() {
		return decodedCursor{}, errors.New("cursor as-of time is invalid")
	}
	sortAt, err := time.Parse(time.RFC3339Nano, payload.SortAt)
	if err != nil {
		return decodedCursor{}, errors.New("cursor time is invalid")
	}
	occurrenceID, err := uuid.Parse(payload.OccurrenceID)
	if err != nil {
		return decodedCursor{}, errors.New("cursor occurrence is invalid")
	}
	return decodedCursor{
		Boundary: events.CursorBoundary{SortAt: sortAt.UTC(), OccurrenceID: occurrenceID},
		AsOf:     asOf.UTC(),
	}, nil
}

func (codec cursorCodec) sign(payload []byte) []byte {
	digest := hmac.New(sha256.New, codec.key)
	_, _ = digest.Write(payload)
	return digest.Sum(nil)
}

func sortedCategories(categories []events.Category) []string {
	result := make([]string, len(categories))
	for index, category := range categories {
		result[index] = string(category)
	}
	sort.Strings(result)
	return result
}

func equalStrings(left, right []string) bool {
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
