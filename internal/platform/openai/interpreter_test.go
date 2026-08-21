package openai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/siiddhantt/baahar/internal/ask"
	"github.com/siiddhantt/baahar/internal/events"
)

func TestInterpreterUsesStatelessStrictStructuredOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("missing bearer key")
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["store"] != false || body["model"] != "test-model" {
			t.Fatalf("body = %#v", body)
		}
		text := body["text"].(map[string]any)
		format := text["format"].(map[string]any)
		if format["type"] != "json_schema" || format["strict"] != true {
			t.Fatalf("format = %#v", format)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"window\":\"weekend\",\"categories\":[\"music\"],\"explicitly_free\":true,\"venue\":\"BIEC\"}"}]}]}`))
	}))
	defer server.Close()

	interpreter, err := New(Config{APIKey: "test-key", Model: "test-model", Endpoint: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	intent, err := interpreter.Interpret(context.Background(), "free music at BIEC", ask.Context{
		CityName: "Bengaluru", Now: time.Now(), Venues: []string{"BIEC"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !intent.Assisted || intent.Window != events.WindowWeekend || intent.Venue != "BIEC" || !intent.ExplicitlyFree {
		t.Fatalf("intent = %+v", intent)
	}
}

func TestInterpreterRejectsVenueOutsideVerifiedContext(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"window\":\"upcoming\",\"categories\":[],\"explicitly_free\":false,\"venue\":\"Invented Hall\"}"}]}]}`))
	}))
	defer server.Close()
	interpreter, _ := New(Config{APIKey: "test-key", Model: "test-model", Endpoint: server.URL})
	if _, err := interpreter.Interpret(context.Background(), "near me", ask.Context{Venues: []string{"BIEC"}}); err == nil {
		t.Fatal("unknown venue was accepted")
	}
}
