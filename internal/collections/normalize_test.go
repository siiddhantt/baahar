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
	dataset := append([]byte{'['}, record...)
	dataset = append(dataset, ']')
	prepared, err := PrepareDataset(dataset, SourcePolicy{
		ID:                  uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"),
		CitySlug:            "bengaluru",
		CanonicalHost:       "bangaloreinternationalcentre.org",
		SchemaVersion:       "event-occurrence/v1",
		RecordLimit:         100,
		ObservationEarliest: time.Date(2026, time.August, 18, 11, 0, 0, 0, time.UTC),
		ObservationLatest:   time.Date(2026, time.August, 18, 13, 0, 0, 0, time.UTC),
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

func TestBICSourceEventIDPolicyRejectsFallbackIdentity(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	record, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if err := json.Unmarshal(record, &value); err != nil {
		t.Fatal(err)
	}
	value["source_event_id"] = "not-a-native-bic-id"
	record, err = json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	pattern := `^[0-9]+$`
	prepared, err := PrepareDataset(append(append([]byte{'['}, record...), ']'), SourcePolicy{
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
	if prepared.HealthCode != "no_valid_records" || len(prepared.Quarantined) != 1 {
		t.Fatalf("unexpected source-ID policy result: %+v", prepared)
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
