package brightdata

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTriggerUsesCustomCollectorBatchContract(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/dca/trigger" {
			t.Fatalf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
		if request.URL.Query().Get("collector") != "c_example" {
			t.Fatalf("collector query = %q", request.URL.Query().Get("collector"))
		}
		if request.Header.Get("Authorization") != "Bearer test-token" || request.Header.Get("Content-Type") != "application/json" {
			t.Fatal("missing Bright Data request headers")
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		if string(body) != `[{"url":"https://example.com/events"}]` {
			t.Fatalf("trigger body = %s", body)
		}
		writer.WriteHeader(http.StatusCreated)
		_, _ = writer.Write([]byte(`{"collection_id":"d_batch/example"}`))
	}))
	defer server.Close()
	client, err := Open(Config{BaseURL: server.URL, Token: "test-token", Client: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	collectionID, err := client.Trigger(context.Background(), "c_example", json.RawMessage(`{"url":"https://example.com/events"}`))
	if err != nil {
		t.Fatal(err)
	}
	if collectionID != "d_batch/example" {
		t.Fatalf("collection ID = %q", collectionID)
	}
}

func TestTriggerRejectsVendorErrorOnSuccessfulHTTPStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("x-brd-error", "collector failed")
		_, _ = writer.Write([]byte(`{"collection_id":"d_ignored"}`))
	}))
	defer server.Close()
	client, err := Open(Config{BaseURL: server.URL, Token: "test-token", Client: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Trigger(context.Background(), "c_example", json.RawMessage(`{"url":"https://example.com"}`))
	var upstream *Error
	if !errors.As(err, &upstream) || upstream.Status != http.StatusOK || upstream.Retryable {
		t.Fatalf("vendor error = %v", err)
	}
}

func TestDatasetTreatsEmptyAcceptedResponseAsPending(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/dca/dataset" || request.URL.Query().Get("id") != "d_batch/example" {
			t.Fatalf("unexpected request URL: %s", request.URL.String())
		}
		if request.Header.Get("Authorization") != "Bearer test-token" {
			t.Fatal("missing bearer token")
		}
		writer.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()
	client, err := Open(Config{BaseURL: server.URL, Token: "test-token", Client: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	content, ready, err := client.Dataset(context.Background(), "d_batch/example")
	if err != nil {
		t.Fatal(err)
	}
	if ready || content != nil {
		t.Fatalf("pending response = (%q, %v), want (nil, false)", content, ready)
	}
}

func TestDatasetTreatsCollectorProgressStatusesAsPending(t *testing.T) {
	for _, status := range []string{"building", "collecting", "running", "queued", "pending"} {
		t.Run(status, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				_, _ = writer.Write([]byte(`{"status":"` + status + `"}`))
			}))
			defer server.Close()
			client, err := Open(Config{BaseURL: server.URL, Token: "test-token", Client: server.Client()})
			if err != nil {
				t.Fatal(err)
			}
			content, ready, err := client.Dataset(context.Background(), "d_batch/example")
			if err != nil {
				t.Fatal(err)
			}
			if ready || content != nil {
				t.Fatalf("pending response = (%q, %v), want (nil, false)", content, ready)
			}
		})
	}
}

func TestDatasetReturnsExactReadyBytes(t *testing.T) {
	want := []byte("[\r\n  {\"title\":\"ಬೆಂಗಳೂರು\"}\r\n]\n")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write(want)
	}))
	defer server.Close()
	client, err := Open(Config{BaseURL: server.URL, Token: "test-token", Client: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	got, ready, err := client.Dataset(context.Background(), "collection-without-fixed-prefix")
	if err != nil {
		t.Fatal(err)
	}
	if !ready || !bytes.Equal(got, want) {
		t.Fatalf("ready dataset = (%q, %v)", got, ready)
	}
}
