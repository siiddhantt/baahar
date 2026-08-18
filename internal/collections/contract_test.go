package collections

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestBICExampleSatisfiesEmbeddedCollectorContract(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	fixture, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := validator.ValidateRecord(fixture); err != nil {
		t.Fatal(err)
	}
}

func TestCollectorContractRejectsInventedFreePrice(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	record := []byte(`{
  "schema_version":"event-occurrence/v1",
  "source_url":"https://bangaloreinternationalcentre.org/events/example/",
  "source_host":"bangaloreinternationalcentre.org",
  "city_slug":"bengaluru",
  "title":"Example",
  "category":"talks",
  "start_date":"2026-08-18",
  "starts_at":"2026-08-18T18:30:00+05:30",
  "end_date":null,
  "ends_at":null,
  "time_precision":"timed",
  "timezone":"Asia/Kolkata",
  "venue_name":null,
  "venue_address":null,
  "is_free":true,
  "price_min_minor":100,
  "price_max_minor":null,
  "currency":"INR",
  "registration_url":null,
  "registration_state":null,
  "status":"scheduled",
  "language":[],
  "age_note":null,
  "accessibility_note":null,
  "image_url":null,
  "observed_at":"2026-08-18T12:00:00Z"
}`)
	if err := validator.ValidateRecord(record); err == nil {
		t.Fatal("free record with a positive price must fail the collector contract")
	}
}

func TestCollectorContractRequiresExplicitSourceEventID(t *testing.T) {
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	fixture, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	var record map[string]json.RawMessage
	if err := json.Unmarshal(fixture, &record); err != nil {
		t.Fatal(err)
	}
	record["source_event_id"] = json.RawMessage("null")
	withNull, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	if err := validator.ValidateRecord(withNull); err != nil {
		t.Fatalf("explicit null source_event_id must satisfy the collector contract: %v", err)
	}

	delete(record, "source_event_id")
	missing, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	if err := validator.ValidateRecord(missing); err == nil {
		t.Fatal("missing source_event_id must fail the collector contract")
	}
}
