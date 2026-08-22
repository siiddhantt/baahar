package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/siiddhantt/baahar/internal/ask"
	"github.com/siiddhantt/baahar/internal/events"
)

const (
	defaultEndpoint      = "https://openrouter.ai/api/v1/chat/completions"
	defaultClientTimeout = 12 * time.Second
)

var DefaultModels = []string{
	"qwen/qwen3-30b-a3b-instruct-2507",
	"openai/gpt-5.4-nano",
}

type Config struct {
	APIKey   string
	Models   []string
	Endpoint string
	SiteURL  string
	SiteName string
	Client   *http.Client
}

type Interpreter struct {
	apiKey   string
	models   []string
	endpoint string
	siteURL  string
	siteName string
	client   *http.Client
}

func New(config Config) (*Interpreter, error) {
	if strings.TrimSpace(config.APIKey) == "" {
		return nil, errors.New("OpenRouter API key is required")
	}
	models := cleanModels(config.Models)
	if len(models) == 0 {
		return nil, errors.New("at least one OpenRouter model is required")
	}
	if config.Endpoint == "" {
		config.Endpoint = defaultEndpoint
	}
	if config.Client == nil {
		config.Client = &http.Client{Timeout: defaultClientTimeout}
	}
	return &Interpreter{
		apiKey: strings.TrimSpace(config.APIKey), models: models, endpoint: config.Endpoint,
		siteURL: strings.TrimSpace(config.SiteURL), siteName: strings.TrimSpace(config.SiteName), client: config.Client,
	}, nil
}

type chatRequest struct {
	Models         []string       `json:"models"`
	Messages       []message      `json:"messages"`
	Temperature    int            `json:"temperature"`
	MaxTokens      int            `json:"max_tokens"`
	ResponseFormat responseFormat `json:"response_format"`
	Provider       provider       `json:"provider"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type       string     `json:"type"`
	JSONSchema jsonSchema `json:"json_schema"`
}

type jsonSchema struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

type provider struct {
	RequireParameters bool   `json:"require_parameters"`
	AllowFallbacks    bool   `json:"allow_fallbacks"`
	DataCollection    string `json:"data_collection"`
}

type chatEnvelope struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type intentPayload struct {
	City           string   `json:"city"`
	Window         string   `json:"window"`
	Categories     []string `json:"categories"`
	ExplicitlyFree bool     `json:"explicitly_free"`
	Venue          *string  `json:"venue"`
}

func (interpreter *Interpreter) Interpret(ctx context.Context, query string, scope ask.Context) (ask.Intent, error) {
	payload := chatRequest{
		Models: interpreter.models,
		Messages: []message{
			{Role: "system", Content: instructions(scope)},
			{Role: "user", Content: strings.TrimSpace(query)},
		},
		Temperature: 0,
		MaxTokens:   140,
		ResponseFormat: responseFormat{Type: "json_schema", JSONSchema: jsonSchema{
			Name: "baahar_event_intent", Strict: true, Schema: intentSchema(scope),
		}},
		Provider: provider{RequireParameters: true, AllowFallbacks: true, DataCollection: "deny"},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return ask.Intent{}, unavailable("encode request", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, interpreter.endpoint, bytes.NewReader(encoded))
	if err != nil {
		return ask.Intent{}, unavailable("create request", err)
	}
	request.Header.Set("Authorization", "Bearer "+interpreter.apiKey)
	request.Header.Set("Content-Type", "application/json")
	if interpreter.siteURL != "" {
		request.Header.Set("HTTP-Referer", interpreter.siteURL)
	}
	if interpreter.siteName != "" {
		request.Header.Set("X-Title", interpreter.siteName)
	}

	response, err := interpreter.client.Do(request)
	if err != nil {
		return ask.Intent{}, unavailable("request provider", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64*1024))
	if err != nil {
		return ask.Intent{}, unavailable("read provider response", err)
	}
	if response.StatusCode != http.StatusOK {
		return ask.Intent{}, unavailable(fmt.Sprintf("provider returned status %d", response.StatusCode), nil)
	}
	var envelope chatEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil || len(envelope.Choices) == 0 {
		return ask.Intent{}, unavailable("provider returned no completion", err)
	}
	output := strings.TrimSpace(envelope.Choices[0].Message.Content)
	if output == "" {
		return ask.Intent{}, unavailable("provider returned empty structured output", nil)
	}
	var parsed intentPayload
	decoder := json.NewDecoder(strings.NewReader(output))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&parsed); err != nil {
		return ask.Intent{}, unavailable("decode structured intent", err)
	}
	intent := ask.Intent{City: parsed.City, Window: events.Window(parsed.Window), ExplicitlyFree: parsed.ExplicitlyFree}
	for _, category := range parsed.Categories {
		intent.Categories = append(intent.Categories, events.Category(category))
	}
	if parsed.Venue != nil {
		intent.Venue = *parsed.Venue
	}
	if err := ask.Validate(intent, scope); err != nil {
		return ask.Intent{}, unavailable("validate structured intent", err)
	}
	return intent, nil
}

func cleanModels(values []string) []string {
	models := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			models = append(models, value)
			seen[value] = true
		}
	}
	return models
}

func unavailable(operation string, err error) error {
	if err == nil {
		return fmt.Errorf("%w: %s", ask.ErrUnavailable, operation)
	}
	return fmt.Errorf("%w: %s: %v", ask.ErrUnavailable, operation, err)
}

func instructions(scope ask.Context) string {
	cities := ask.SortedCities(scope.Cities)
	cityOptions := make([]map[string]any, 0, len(cities))
	for _, city := range cities {
		cityOptions = append(cityOptions, map[string]any{
			"slug": city.Slug, "name": city.Name, "venues": ask.SortedVenueNames(city.Venues),
		})
	}
	options, _ := json.Marshal(cityOptions)
	localNow := scope.Now
	if current, found := ask.FindCity(scope, scope.CurrentCity); found {
		if location, err := time.LoadLocation(current.Timezone); err == nil {
			localNow = scope.Now.In(location)
		}
	}
	return fmt.Sprintf(`Convert one short event-discovery request into filters for Baahar's verified city boards. Return only the requested JSON schema.

Supported cities and their exact venues: %s
Current city slug: %q
Current local time: %s

Preserve every constraint the user states:
- Choose a named supported city; otherwise use the current city.
- Map "today" to today, "tomorrow" to tomorrow, and "this weekend" or "weekend" to weekend. Use upcoming only when the user states no time window.
- Leave categories empty unless the user names or clearly asks for a kind of event. Never infer categories from a city or venue. The only categories are arts, talks, workshops, theatre, music, books, community, other.
- Use a venue only when it exactly matches a listed venue for the selected city.
- Set explicitly_free only when the user clearly asks for free entry.
- Never answer the user, invent events, broaden a venue, or add facts.`, options, scope.CurrentCity, localNow.Format(time.RFC3339))
}

func intentSchema(scope ask.Context) map[string]any {
	cities := ask.SortedCities(scope.Cities)
	cityEnum := make([]string, 0, len(cities))
	venueCount := 0
	for _, city := range cities {
		cityEnum = append(cityEnum, city.Slug)
		venueCount += len(city.Venues)
	}
	venueEnum := make([]any, 0, venueCount+1)
	venueEnum = append(venueEnum, nil)
	seenVenues := make(map[string]bool, venueCount)
	for _, city := range cities {
		for _, venue := range ask.SortedVenueNames(city.Venues) {
			if !seenVenues[venue] {
				venueEnum = append(venueEnum, venue)
				seenVenues[venue] = true
			}
		}
	}
	return map[string]any{
		"type": "object", "additionalProperties": false,
		"required": []string{"city", "window", "categories", "explicitly_free", "venue"},
		"properties": map[string]any{
			"city":   map[string]any{"type": "string", "enum": cityEnum},
			"window": map[string]any{"type": "string", "enum": []string{"upcoming", "today", "tomorrow", "weekend"}},
			"categories": map[string]any{
				"type": "array", "maxItems": 3, "uniqueItems": true,
				"items": map[string]any{"type": "string", "enum": []string{"arts", "talks", "workshops", "theatre", "music", "books", "community", "other"}},
			},
			"explicitly_free": map[string]any{"type": "boolean"},
			"venue":           map[string]any{"type": []string{"string", "null"}, "enum": venueEnum},
		},
	}
}
