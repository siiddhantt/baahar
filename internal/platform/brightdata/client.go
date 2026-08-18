package brightdata

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const maximumResponseBytes = 64 << 20

var collectorIDPattern = regexp.MustCompile(`^c_[A-Za-z0-9_-]+$`)

type Config struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

type Client struct {
	baseURL *url.URL
	token   string
	http    *http.Client
}

type Error struct {
	Code      string
	Retryable bool
	Status    int
}

func (err *Error) Error() string {
	return fmt.Sprintf("Bright Data request failed with %s (%d)", err.Code, err.Status)
}

func Open(config Config) (*Client, error) {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.brightdata.com"
	}
	baseURL, err := url.Parse(config.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse Bright Data base URL: %w", err)
	}
	if (baseURL.Scheme != "http" && baseURL.Scheme != "https") || baseURL.Host == "" || baseURL.RawQuery != "" || baseURL.User != nil {
		return nil, errors.New("Bright Data base URL must be an HTTP(S) origin")
	}
	baseURL.Path = strings.TrimSuffix(baseURL.Path, "/")
	if strings.TrimSpace(config.Token) == "" {
		return nil, errors.New("Bright Data API token is required")
	}
	if config.Client == nil {
		config.Client = &http.Client{Timeout: 30 * time.Second}
	}
	return &Client{baseURL: baseURL, token: config.Token, http: config.Client}, nil
}

func (client *Client) Trigger(ctx context.Context, collectorID string, input json.RawMessage) (string, error) {
	if !collectorIDPattern.MatchString(collectorID) {
		return "", errors.New("invalid Bright Data collector ID")
	}
	if !json.Valid(input) || len(bytes.TrimSpace(input)) == 0 || bytes.TrimSpace(input)[0] != '{' {
		return "", errors.New("Bright Data collector input must be a JSON object")
	}
	endpoint := client.resolve("/dca/trigger")
	query := endpoint.Query()
	query.Set("collector", collectorID)
	query.Set("queue_next", "1")
	query.Set("no_downloads", "1")
	query.Set("deadline", "10m")
	endpoint.RawQuery = query.Encode()
	body := make([]byte, 0, len(input)+2)
	body = append(body, '[')
	body = append(body, input...)
	body = append(body, ']')
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create Bright Data trigger request: %w", err)
	}
	client.authorize(request)
	request.Header.Set("Content-Type", "application/json")
	response, err := client.http.Do(request)
	if err != nil {
		return "", fmt.Errorf("trigger Bright Data collector: %w", err)
	}
	defer response.Body.Close()
	if vendorErrorHeader(response) || response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", responseError(response)
	}
	content, err := readBounded(response.Body, 16<<10)
	if err != nil {
		return "", fmt.Errorf("read Bright Data trigger response: %w", err)
	}
	var result struct {
		CollectionID string `json:"collection_id"`
	}
	if err := json.Unmarshal(content, &result); err != nil {
		return "", fmt.Errorf("decode Bright Data trigger response: %w", err)
	}
	if !validCollectionID(result.CollectionID) {
		return "", errors.New("Bright Data trigger returned an invalid collection ID")
	}
	return result.CollectionID, nil
}

func (client *Client) Dataset(ctx context.Context, collectionID string) ([]byte, bool, error) {
	if !validCollectionID(collectionID) {
		return nil, false, errors.New("invalid Bright Data collection ID")
	}
	endpoint := client.resolve("/dca/dataset")
	query := endpoint.Query()
	query.Set("id", collectionID)
	endpoint.RawQuery = query.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, false, fmt.Errorf("create Bright Data dataset request: %w", err)
	}
	client.authorize(request)
	response, err := client.http.Do(request)
	if err != nil {
		return nil, false, fmt.Errorf("download Bright Data dataset: %w", err)
	}
	defer response.Body.Close()
	if vendorErrorHeader(response) || response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, false, responseError(response)
	}
	content, err := readBounded(response.Body, maximumResponseBytes)
	if err != nil {
		return nil, false, fmt.Errorf("read Bright Data dataset: %w", err)
	}
	trimmed := bytes.TrimSpace(content)
	if len(trimmed) == 0 {
		return nil, false, nil
	}
	if trimmed[0] == '[' {
		if !json.Valid(trimmed) {
			return nil, false, errors.New("Bright Data dataset is invalid JSON")
		}
		return content, true, nil
	}
	var status struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(trimmed, &status); err != nil {
		return nil, false, errors.New("Bright Data dataset status is invalid")
	}
	switch strings.ToLower(status.Status) {
	case "building", "collecting", "running", "queued", "pending":
		return nil, false, nil
	default:
		return nil, false, fmt.Errorf("Bright Data dataset returned terminal status %q", status.Status)
	}
}

func validCollectionID(value string) bool {
	if value == "" || len(value) > 512 || strings.TrimSpace(value) != value {
		return false
	}
	for _, character := range value {
		if character < 0x21 || character == 0x7f {
			return false
		}
	}
	return true
}

func (client *Client) resolve(path string) *url.URL {
	copy := *client.baseURL
	copy.Path = strings.TrimSuffix(copy.Path, "/") + path
	return &copy
}

func (client *Client) authorize(request *http.Request) {
	request.Header.Set("Authorization", "Bearer "+client.token)
	request.Header.Set("Accept", "application/json")
}

func responseError(response *http.Response) error {
	_, _ = readBounded(response.Body, 8<<10)
	code := "http_error"
	switch response.StatusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		code = "authentication_failed"
	case http.StatusNotFound:
		code = "collector_not_found"
	case http.StatusUnprocessableEntity:
		code = "input_rejected"
	case http.StatusTooManyRequests:
		code = "rate_limited"
	default:
		if response.StatusCode >= 500 {
			code = "upstream_unavailable"
		}
	}
	retryable := response.StatusCode == http.StatusTooManyRequests || response.StatusCode == http.StatusInternalServerError || response.StatusCode == http.StatusBadGateway || response.StatusCode == http.StatusServiceUnavailable || response.StatusCode == http.StatusGatewayTimeout
	return &Error{
		Code:      code,
		Retryable: retryable,
		Status:    response.StatusCode,
	}
}

func vendorErrorHeader(response *http.Response) bool {
	return response.Header.Get("x-brd-error") != "" || response.Header.Get("x-luminati-error") != ""
}

func readBounded(reader io.Reader, limit int64) ([]byte, error) {
	content, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > limit {
		return nil, fmt.Errorf("response exceeds %d-byte limit", limit)
	}
	return content, nil
}
