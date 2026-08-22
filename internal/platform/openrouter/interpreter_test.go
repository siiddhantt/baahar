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
		_, _ = writer.Write([]byte(`{"choices":[{"message":{"content":"{\"city\":\"bengaluru\",\"window\":\"weekend\",\"categories\":[\"music\"],\"explicitly_free\":true,\"venue\":\"BIEC\"}"}}]}`))
	}))
	defer server.Close()

	interpreter, err := New(Config{
		APIKey: "test-key", Models: []string{"cheap-model", "fallback-model"}, Endpoint: server.URL,
		SiteURL: "https://baahar.example", SiteName: "Baahar",
	})
	if err != nil {
		t.Fatal(err)
	}
	if interpreter.client.Timeout != defaultClientTimeout {
		t.Fatalf("provider timeout = %s, want %s", interpreter.client.Timeout, defaultClientTimeout)
	}
	intent, err := interpreter.Interpret(context.Background(), "free music at BIEC", testScope())
	if err != nil {
		t.Fatal(err)
	}
	if intent.City != "bengaluru" || intent.Window != events.WindowWeekend || intent.Venue != "BIEC" || !intent.ExplicitlyFree {
		t.Fatalf("intent = %+v", intent)
	}
}

func TestInterpreterCanSelectAnotherSupportedCityFromNaturalLanguage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var body struct {
			Messages []message `json:"messages"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if len(body.Messages) != 2 || !strings.Contains(body.Messages[0].Content, `"slug":"varanasi"`) || !strings.Contains(body.Messages[0].Content, `Current city slug: "bengaluru"`) {
			t.Fatalf("system prompt did not bind supported and current cities: %#v", body.Messages)
		}
		for _, rule := range []string{`"this weekend" or "weekend" to weekend`, "Leave categories empty", "Never infer categories from a city or venue"} {
			if !strings.Contains(body.Messages[0].Content, rule) {
				t.Fatalf("system prompt is missing constraint %q", rule)
			}
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"choices":[{"message":{"content":"{\"city\":\"varanasi\",\"window\":\"upcoming\",\"categories\":[],\"explicitly_free\":false,\"venue\":null}"}}]}`))
	}))
	defer server.Close()
	interpreter, err := New(Config{APIKey: "test-key", Models: []string{"test-model"}, Endpoint: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	intent, err := interpreter.Interpret(context.Background(), "are there any events in varanasi?", testScope())
	if err != nil {
		t.Fatal(err)
	}
	if intent.City != "varanasi" || intent.Window != events.WindowUpcoming || len(intent.Categories) != 0 || intent.Venue != "" {
		t.Fatalf("intent = %+v", intent)
	}
}

func TestInterpreterRejectsUnverifiedOutputWithoutKeywordFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"choices":[{"message":{"content":"{\"city\":\"bengaluru\",\"window\":\"upcoming\",\"categories\":[],\"explicitly_free\":false,\"venue\":\"Invented Hall\"}"}}]}`))
	}))
	defer server.Close()
	interpreter, err := New(Config{APIKey: "test-key", Models: []string{"test-model"}, Endpoint: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	_, err = interpreter.Interpret(context.Background(), "free music this weekend", testScope())
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
	_, err := interpreter.Interpret(context.Background(), "music", testScope())
	if !errors.Is(err, ask.ErrUnavailable) || errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v", err)
	}
	if err != nil && strings.Contains(err.Error(), "secret account detail") {
		t.Fatalf("provider body leaked: %v", err)
	}
}

func testScope() ask.Context {
	return ask.Context{
		CurrentCity: "bengaluru",
		Now:         time.Date(2026, time.August, 22, 10, 0, 0, 0, time.UTC),
		Cities: []ask.CityScope{
			{Slug: "bengaluru", Name: "Bengaluru", Timezone: "Asia/Kolkata", Venues: []string{"BIEC"}},
			{Slug: "varanasi", Name: "Varanasi", Timezone: "Asia/Kolkata", Venues: []string{"BHU Campus"}},
		},
	}
}
