package collections

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
)

// TransportError identifies a Bright delivery-envelope violation without
// weakening the canonical collector schema.
type TransportError struct {
	RecordIndex int
	Cause       error
}

func (err *TransportError) Error() string {
	return fmt.Sprintf("record %d: %v", err.RecordIndex, err.Cause)
}

func (err *TransportError) Unwrap() error {
	return err.Cause
}

// CanonicalizeBrightDataset removes Bright's documented per-row input envelope
// only after proving that it is identical to the reviewed collection input.
// All remaining fields pass unchanged to the authoritative schema validator.
func CanonicalizeBrightDataset(dataset []byte, expectedInput json.RawMessage) ([]byte, error) {
	trimmed := bytes.TrimSpace(dataset)
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return nil, errors.New("Bright dataset must be a JSON array")
	}
	expected, err := decodeJSONValue(expectedInput)
	if err != nil {
		return nil, fmt.Errorf("decode reviewed collection input: %w", err)
	}
	if _, ok := expected.(map[string]any); !ok {
		return nil, errors.New("reviewed collection input must be a JSON object")
	}

	decoder := json.NewDecoder(bytes.NewReader(dataset))
	var records []json.RawMessage
	if err := decoder.Decode(&records); err != nil {
		return nil, fmt.Errorf("decode Bright dataset: %w", err)
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return nil, err
	}
	canonical := make([]json.RawMessage, len(records))
	for index, raw := range records {
		fields, err := decodeStrictObject(raw)
		if err != nil {
			return nil, &TransportError{RecordIndex: index, Cause: err}
		}
		input, exists := fields["input"]
		if !exists {
			return nil, &TransportError{RecordIndex: index, Cause: errors.New("Bright input envelope is missing")}
		}
		actual, err := decodeJSONValue(input)
		if err != nil {
			return nil, &TransportError{RecordIndex: index, Cause: fmt.Errorf("decode Bright input envelope: %w", err)}
		}
		if !reflect.DeepEqual(actual, expected) {
			return nil, &TransportError{RecordIndex: index, Cause: errors.New("Bright input envelope does not match reviewed collection input")}
		}
		delete(fields, "input")
		encoded, err := json.Marshal(fields)
		if err != nil {
			return nil, &TransportError{RecordIndex: index, Cause: fmt.Errorf("encode canonical validation view: %w", err)}
		}
		canonical[index] = encoded
	}
	view, err := json.Marshal(canonical)
	if err != nil {
		return nil, fmt.Errorf("encode canonical dataset view: %w", err)
	}
	return view, nil
}

func decodeStrictObject(raw json.RawMessage) (map[string]json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	opening, err := decoder.Token()
	if err != nil {
		return nil, fmt.Errorf("decode object: %w", err)
	}
	if delimiter, ok := opening.(json.Delim); !ok || delimiter != '{' {
		return nil, errors.New("Bright dataset record must be an object")
	}
	fields := make(map[string]json.RawMessage)
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, fmt.Errorf("decode object key: %w", err)
		}
		name, ok := token.(string)
		if !ok {
			return nil, errors.New("Bright dataset object key must be a string")
		}
		if _, exists := fields[name]; exists {
			return nil, fmt.Errorf("duplicate object field %q", name)
		}
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			return nil, fmt.Errorf("decode object field %q: %w", name, err)
		}
		fields[name] = value
	}
	closing, err := decoder.Token()
	if err != nil {
		return nil, fmt.Errorf("close object: %w", err)
	}
	if delimiter, ok := closing.(json.Delim); !ok || delimiter != '}' {
		return nil, errors.New("Bright dataset record is not a complete object")
	}
	if err := ensureTransportEnd(decoder); err != nil {
		return nil, err
	}
	return fields, nil
}

func decodeJSONValue(raw json.RawMessage) (any, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	if err := ensureTransportEnd(decoder); err != nil {
		return nil, err
	}
	return value, nil
}

func ensureTransportEnd(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); errors.Is(err, io.EOF) {
		return nil
	} else if err != nil {
		return err
	}
	return errors.New("JSON contains more than one value")
}
