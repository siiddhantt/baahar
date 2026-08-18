package collections

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPrepareBICDataset(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	record, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	record = addFixtureFields(t, record, map[string]json.RawMessage{
		"source_event_id": json.RawMessage(`"12345"`),
	})
	dataset := append([]byte{'['}, record...)
	dataset = append(dataset, ']')
	pattern := `^[0-9]+$`
	prepared, err := PrepareDataset(dataset, SourcePolicy{
		ID:                   uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		CitySlug:             "bengaluru",
		CanonicalHost:        "bangaloreinternationalcentre.org",
		SchemaVersion:        "event-occurrence/v1",
		SourceEventIDPattern: &pattern,
		RecordLimit:          100,
		ObservationEarliest:  time.Date(2026, time.August, 18, 11, 0, 0, 0, time.UTC),
		ObservationLatest:    time.Date(2026, time.August, 18, 13, 0, 0, 0, time.UTC),
	}, validator)
	if err != nil {
		t.Fatal(err)
	}
	if prepared.HealthCode != "" || len(prepared.Candidates) != 1 || len(prepared.Quarantined) != 0 {
		t.Fatalf("unexpected preparation result: %+v", prepared)
	}
	if prepared.Candidates[0].Version.IsFree != nil {
		t.Fatal("missing BIC price must remain unknown")
	}
}

func TestEmptyDatasetIsUnhealthy(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	prepared, err := PrepareDataset([]byte("[]"), SourcePolicy{RecordLimit: 100}, validator)
	if err != nil {
		t.Fatal(err)
	}
	if prepared.HealthCode != "empty_output" {
		t.Fatalf("health code = %q, want empty_output", prepared.HealthCode)
	}
}

func TestSourceEventIDPolicies(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	record, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	pattern := `^[0-9]+$`
	bic := SourcePolicy{
		ID:                   uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		CitySlug:             "bengaluru",
		CanonicalHost:        "bangaloreinternationalcentre.org",
		SchemaVersion:        "event-occurrence/v1",
		SourceEventIDPattern: &pattern,
		RecordLimit:          100,
		ObservationEarliest:  time.Date(2026, time.August, 18, 11, 0, 0, 0, time.UTC),
		ObservationLatest:    time.Date(2026, time.August, 18, 13, 0, 0, 0, time.UTC),
	}
	for name, test := range map[string]struct {
		value json.RawMessage
		valid bool
	}{
		"numeric ID":     {value: json.RawMessage(`"12345"`), valid: true},
		"null ID":        {value: json.RawMessage("null")},
		"non-numeric ID": {value: json.RawMessage(`"not-a-native-bic-id"`)},
	} {
		t.Run("BIC "+name, func(t *testing.T) {
			prepared := prepareSourceIDRecord(t, validator, record, test.value, bic)
			assertPreparationValidity(t, prepared, test.valid)
		})
	}

	jagriti := SourcePolicy{
		ID:                  uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"),
		CitySlug:            "bengaluru",
		CanonicalHost:       "www.jagrititheatre.com",
		SchemaVersion:       "event-occurrence/v1",
		RecordLimit:         50,
		ObservationEarliest: time.Date(2026, time.August, 18, 11, 0, 0, 0, time.UTC),
		ObservationLatest:   time.Date(2026, time.August, 18, 13, 0, 0, 0, time.UTC),
	}
	jagritiRecord := addFixtureFields(t, record, map[string]json.RawMessage{
		"source_url":  json.RawMessage(`"https://www.jagrititheatre.com/example-production"`),
		"source_host": json.RawMessage(`"www.jagrititheatre.com"`),
	})
	for name, test := range map[string]struct {
		value json.RawMessage
		valid bool
	}{
		"null ID":     {value: json.RawMessage("null"), valid: true},
		"non-null ID": {value: json.RawMessage(`"shared-booking-id"`)},
	} {
		t.Run("Jagriti "+name, func(t *testing.T) {
			prepared := prepareSourceIDRecord(t, validator, jagritiRecord, test.value, jagriti)
			assertPreparationValidity(t, prepared, test.valid)
		})
	}
}

func prepareSourceIDRecord(
	t *testing.T,
	validator *CollectorValidator,
	record []byte,
	sourceEventID json.RawMessage,
	policy SourcePolicy,
) PreparedDataset {
	t.Helper()
	record = addFixtureFields(t, record, map[string]json.RawMessage{"source_event_id": sourceEventID})
	dataset := append(append([]byte{'['}, record...), ']')
	prepared, err := PrepareDataset(dataset, policy, validator)
	if err != nil {
		t.Fatal(err)
	}
	return prepared
}

func assertPreparationValidity(t *testing.T, prepared PreparedDataset, valid bool) {
	t.Helper()
	if valid {
		if prepared.HealthCode != "" || len(prepared.Candidates) != 1 || len(prepared.Quarantined) != 0 {
			t.Fatalf("valid source-ID policy result = %+v", prepared)
		}
		return
	}
	if prepared.HealthCode != "no_valid_records" || len(prepared.Candidates) != 0 || len(prepared.Quarantined) != 1 {
		t.Fatalf("invalid source-ID policy result = %+v", prepared)
	}
}

func TestRecordCountBaseline(t *testing.T) {
	prepared := PreparedDataset{Candidates: make([]Candidate, 1)}
	if got := ApplyRecordCountBaseline(prepared, []int{17, 16}); got.HealthCode != "" {
		t.Fatalf("two baselines should not gate launch, got %q", got.HealthCode)
	}
	if got := ApplyRecordCountBaseline(prepared, []int{16, 17, 18}); got.HealthCode != "record_count_deviation" {
		t.Fatalf("one row against stable baseline should freeze, got %q", got.HealthCode)
	}
	prepared.Candidates = make([]Candidate, 9)
	if got := ApplyRecordCountBaseline(prepared, []int{16, 17, 18}); got.HealthCode != "" || !got.TrackAbsence {
		t.Fatalf("normal count churn should pass and activate absence tracking, got %+v", got)
	}
}
