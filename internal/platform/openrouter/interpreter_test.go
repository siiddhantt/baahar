package openrouter

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/siiddhantt/baahar/internal/ask"
	"github.com/siiddhantt/baahar/internal/events"
)

func TestInterpreterUsesProviderFallbacksAndStrictStructuredOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer test-key" || request.Header.Get("HTTP-Referer") != "https://baahar.example" || request.Header.Get("X-Title") != "Baahar" {
			t.Fatal("missing server-side OpenRouter headers")
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		models := body["models"].([]any)
		if len(models) != 2 || models[0] != "cheap-model" || models[1] != "fallback-model" {
			t.Fatalf("models = %#v", models)
		}
		provider := body["provider"].(map[string]any)
		if provider["require_parameters"] != true || provider["allow_fallbacks"] != true || provider["data_collection"] != "deny" {
			t.Fatalf("provider = %#v", provider)
		}
		format := body["response_format"].(map[string]any)
		schema := format["json_schema"].(map[string]any)
		if format["type"] != "json_schema" || schema["strict"] != true {
			t.Fatalf("response format = %#v", format)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"choices":[{"message":{"content":"{\"window\":\"weekend\",\"categories\":[\"music\"],\"explicitly_free\":true,\"venue\":\"BIEC\"}"}}]}`))
	}))
	defer server.Close()

	interpreter, err := New(Config{
		APIKey: "test-key", Models: []string{"cheap-model", "fallback-model"}, Endpoint: server.URL,
		SiteURL: "https://baahar.example", SiteName: "Baahar",
	})
	if err != nil {
		t.Fatal(err)
	}
	intent, err := interpreter.Interpret(context.Background(), "free music at BIEC", ask.Context{
		CityName: "Bengaluru", Timezone: "Asia/Kolkata", Now: time.Now(), Venues: []string{"BIEC"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if intent.Window != events.WindowWeekend || intent.Venue != "BIEC" || !intent.ExplicitlyFree {
		t.Fatalf("intent = %+v", intent)
	}
}

func TestInterpreterRejectsUnverifiedOutputWithoutKeywordFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"choices":[{"message":{"content":"{\"window\":\"upcoming\",\"categories\":[],\"explicitly_free\":false,\"venue\":\"Invented Hall\"}"}}]}`))
	}))
	defer server.Close()
	interpreter, err := New(Config{APIKey: "test-key", Models: []string{"test-model"}, Endpoint: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	_, err = interpreter.Interpret(context.Background(), "free music this weekend", ask.Context{Venues: []string{"BIEC"}})
	if !errors.Is(err, ask.ErrUnavailable) {
		t.Fatalf("error = %v, want unavailable", err)
	}
}

func TestUnavailableProviderDoesNotLeakItsResponseBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusUnauthorized)
		_, _ = writer.Write([]byte(`{"error":"secret account detail"}`))
	}))
	defer server.Close()
	interpreter, _ := New(Config{APIKey: "test-key", Models: []string{"test-model"}, Endpoint: server.URL})
	_, err := interpreter.Interpret(context.Background(), "music", ask.Context{})
	if !errors.Is(err, ask.ErrUnavailable) || errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v", err)
	}
	if err != nil && strings.Contains(err.Error(), "secret account detail") {
		t.Fatalf("provider body leaked: %v", err)
	}
}
