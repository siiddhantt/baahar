package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/siiddhantt/baahar/internal/collections"
)

func main() {
	var records []json.RawMessage
	if err := json.NewDecoder(os.Stdin).Decode(&records); err != nil {
		fmt.Fprintf(os.Stderr, "decode records: %v\n", err)
		os.Exit(1)
	}
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		fmt.Fprintf(os.Stderr, "compile collector schema: %v\n", err)
		os.Exit(1)
	}
	for index, record := range records {
		if err := validator.ValidateRecord(record); err != nil {
			fmt.Fprintf(os.Stderr, "record %d: %v\n", index, err)
			os.Exit(1)
		}
	}
}
