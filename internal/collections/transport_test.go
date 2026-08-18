package collections

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestCanonicalizeBrightDatasetRemovesOnlyVerifiedInput(t *testing.T) {
	record := collectorFixture(t)
	withInput := addFixtureFields(t, record, map[string]json.RawMessage{
		"input": json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}`),
	})
	view, err := CanonicalizeBrightDataset(
		append(append([]byte{'['}, withInput...), ']'),
		json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}`),
	)
	if err != nil {
		t.Fatal(err)
	}
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	var records []json.RawMessage
	if err := json.Unmarshal(view, &records); err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("canonical records = %d", len(records))
	}
	if err := validator.ValidateRecord(records[0]); err != nil {
		t.Fatalf("canonical view violates unchanged schema: %v", err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(records[0], &fields); err != nil {
		t.Fatal(err)
	}
	if _, exists := fields["input"]; exists {
		t.Fatal("Bright input envelope survived canonicalization")
	}
}

func TestCanonicalizeBrightDatasetFailsClosed(t *testing.T) {
	record := collectorFixture(t)
	expected := json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}`)
	for name, dataset := range map[string][]byte{
		"missing input": append(append([]byte{'['}, record...), ']'),
		"mismatched input": append(append([]byte{'['}, addFixtureFields(t, record, map[string]json.RawMessage{
			"input": json.RawMessage(`{"url":"https://attacker.invalid/events"}`),
		})...), ']'),
		"duplicate input": []byte(`[{"input":{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"},"input":{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}}]`),
	} {
		t.Run(name, func(t *testing.T) {
			_, err := CanonicalizeBrightDataset(dataset, expected)
			var transport *TransportError
			if !errors.As(err, &transport) || transport.RecordIndex != 0 {
				t.Fatalf("error = %v, want record-zero transport failure", err)
			}
		})
	}
}

func TestCanonicalViewDoesNotHideAnyOtherExtraField(t *testing.T) {
	record := addFixtureFields(t, collectorFixture(t), map[string]json.RawMessage{
		"input":      json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}`),
		"unexpected": json.RawMessage(`true`),
	})
	view, err := CanonicalizeBrightDataset(
		append(append([]byte{'['}, record...), ']'),
		json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}`),
	)
	if err != nil {
		t.Fatal(err)
	}
	var records []json.RawMessage
	if err := json.Unmarshal(view, &records); err != nil {
		t.Fatal(err)
	}
	validator, err := NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	if err := validator.ValidateRecord(records[0]); err == nil {
		t.Fatal("non-Bright extra field was hidden from the authoritative schema")
	}
}

func collectorFixture(t *testing.T) []byte {
	t.Helper()
	record, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	return record
}

func addFixtureFields(t *testing.T, record []byte, additions map[string]json.RawMessage) []byte {
	t.Helper()
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(record, &fields); err != nil {
		t.Fatal(err)
	}
	for name, value := range additions {
		fields[name] = value
	}
	encoded, err := json.Marshal(fields)
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}
