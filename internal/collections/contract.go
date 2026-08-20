package collections

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/siiddhantt/baahar/contracts"
)

const collectorSchemaID = "https://baahar.app/contracts/collector-output.schema.json"

type CollectorValidator struct {
	schema *jsonschema.Schema
}

func NewCollectorValidator() (*CollectorValidator, error) {
	schemaBytes, err := contracts.Files.ReadFile("collector-output.schema.json")
	if err != nil {
		return nil, fmt.Errorf("read embedded collector contract: %w", err)
	}
	var schemaDocument any
	if err := json.Unmarshal(schemaBytes, &schemaDocument); err != nil {
		return nil, fmt.Errorf("decode embedded collector contract: %w", err)
	}
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	if err := compiler.AddResource(collectorSchemaID, schemaDocument); err != nil {
		return nil, fmt.Errorf("register collector contract: %w", err)
	}
	compiled, err := compiler.Compile(collectorSchemaID)
	if err != nil {
		return nil, fmt.Errorf("compile collector contract: %w", err)
	}
	return &CollectorValidator{schema: compiled}, nil
}

func (validator *CollectorValidator) ValidateRecord(record []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(record))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return fmt.Errorf("decode collector record: %w", err)
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return err
	}
	if err := validator.schema.Validate(value); err != nil {
		return fmt.Errorf("collector record does not satisfy %s: %w", collectorSchemaID, err)
	}
	return nil
}

func ensureJSONEnd(decoder *json.Decoder) error {
	var extra any
	err := decoder.Decode(&extra)
	if errors.Is(err, io.EOF) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("decode trailing collector data: %w", err)
	}
	return errors.New("collector record contains multiple JSON values")
}
