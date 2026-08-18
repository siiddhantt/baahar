package httpserver

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSSetsVaryForEveryOriginAndAllowsOnlyConfiguredOrigin(t *testing.T) {
	server := &Server{webOrigin: "https://baahar.example", logger: slog.Default()}
	handler := server.middleware(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
	}))
	for _, test := range []struct {
		name            string
		origin          string
		wantAllowOrigin string
	}{
		{name: "allowed", origin: "https://baahar.example", wantAllowOrigin: "https://baahar.example"},
		{name: "disallowed", origin: "https://attacker.example"},
		{name: "no origin"},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/v1/cities", nil)
			if test.origin != "" {
				request.Header.Set("Origin", test.origin)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if got := response.Header().Get("Vary"); got != "Origin" {
				t.Fatalf("Vary = %q, want Origin", got)
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != test.wantAllowOrigin {
				t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, test.wantAllowOrigin)
			}
		})
	}
}
