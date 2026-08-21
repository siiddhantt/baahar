package openai

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

const defaultEndpoint = "https://api.openai.com/v1/responses"

type Config struct {
	APIKey   string
	Model    string
	Endpoint string
	Client   *http.Client
}

type Interpreter struct {
	apiKey   string
	model    string
	endpoint string
	client   *http.Client
}

func New(config Config) (*Interpreter, error) {
	if strings.TrimSpace(config.APIKey) == "" {
		return nil, errors.New("OpenAI API key is required")
	}
	if strings.TrimSpace(config.Model) == "" {
		return nil, errors.New("OpenAI model is required")
	}
	if config.Endpoint == "" {
		config.Endpoint = defaultEndpoint
	}
	if config.Client == nil {
		config.Client = &http.Client{Timeout: 8 * time.Second}
	}
	return &Interpreter{
		apiKey: strings.TrimSpace(config.APIKey), endpoint: config.Endpoint,
		model: strings.TrimSpace(config.Model), client: config.Client,
	}, nil
}

type responseRequest struct {
	Model           string       `json:"model"`
	Store           bool         `json:"store"`
	Instructions    string       `json:"instructions"`
	Input           string       `json:"input"`
	Text            responseText `json:"text"`
	MaxOutputTokens int          `json:"max_output_tokens"`
}

type responseText struct {
	Format responseFormat `json:"format"`
}

type responseFormat struct {
	Type   string         `json:"type"`
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

type responseEnvelope struct {
	Status string `json:"status"`
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
}

type intentPayload struct {
	Window         string   `json:"window"`
	Categories     []string `json:"categories"`
	ExplicitlyFree bool     `json:"explicitly_free"`
	Venue          *string  `json:"venue"`
}

func (interpreter *Interpreter) Interpret(ctx context.Context, query string, scope ask.Context) (ask.Intent, error) {
	requestBody := responseRequest{
		Model: interpreter.model, Store: false, Input: strings.TrimSpace(query), MaxOutputTokens: 300,
		Instructions: instructions(scope),
		Text: responseText{Format: responseFormat{
			Type: "json_schema", Name: "baahar_event_intent", Strict: true, Schema: intentSchema(scope.Venues),
		}},
	}
	encoded, err := json.Marshal(requestBody)
	if err != nil {
		return ask.Intent{}, fmt.Errorf("encode OpenAI request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, interpreter.endpoint, bytes.NewReader(encoded))
	if err != nil {
		return ask.Intent{}, fmt.Errorf("create OpenAI request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+interpreter.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := interpreter.client.Do(request)
	if err != nil {
		return ask.Intent{}, fmt.Errorf("request OpenAI response: %w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64*1024))
	if err != nil {
		return ask.Intent{}, fmt.Errorf("read OpenAI response: %w", err)
	}
	if response.StatusCode != http.StatusOK {
		return ask.Intent{}, fmt.Errorf("OpenAI response status %d", response.StatusCode)
	}
	var envelope responseEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil || envelope.Status != "completed" {
		return ask.Intent{}, errors.New("OpenAI response was not completed")
	}
	output := ""
	for _, item := range envelope.Output {
		if item.Type != "message" {
			continue
		}
		for _, content := range item.Content {
			if content.Type == "output_text" {
				output = content.Text
				break
			}
		}
	}
	if output == "" {
		return ask.Intent{}, errors.New("OpenAI response contained no structured output")
	}
	var parsed intentPayload
	decoder := json.NewDecoder(strings.NewReader(output))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&parsed); err != nil {
		return ask.Intent{}, fmt.Errorf("decode OpenAI intent: %w", err)
	}
	intent := ask.Intent{
		Window: events.Window(parsed.Window), ExplicitlyFree: parsed.ExplicitlyFree, Assisted: true,
	}
	for _, category := range parsed.Categories {
		intent.Categories = append(intent.Categories, events.Category(category))
	}
	if parsed.Venue != nil {
		intent.Venue = *parsed.Venue
	}
	if err := ask.Validate(intent, scope); err != nil {
		return ask.Intent{}, err
	}
	return intent, nil
}

func instructions(scope ask.Context) string {
	venues, _ := json.Marshal(ask.SortedVenueNames(scope.Venues))
	return fmt.Sprintf(`Turn one short discovery request into Baahar filters for %s. Use only the supported categories arts, talks, workshops, theatre, music, books, community, other and only an exact venue from this JSON list: %s. Choose upcoming when no time window is stated. Set explicitly_free only when the user clearly asks for free entry. Do not answer the user, invent events, broaden a venue, or add facts. Current local time is %s.`, scope.CityName, venues, scope.Now.Format(time.RFC3339))
}

func intentSchema(venues []string) map[string]any {
	venueEnum := make([]any, 0, len(venues)+1)
	venueEnum = append(venueEnum, nil)
	for _, venue := range ask.SortedVenueNames(venues) {
		venueEnum = append(venueEnum, venue)
	}
	return map[string]any{
		"type": "object", "additionalProperties": false,
		"required": []string{"window", "categories", "explicitly_free", "venue"},
		"properties": map[string]any{
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
