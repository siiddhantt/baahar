package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/siiddhantt/baahar/internal/platform/httpserver"
	"github.com/siiddhantt/baahar/internal/platform/postgres"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	databaseURL := requiredEnvironment(logger, "BAAHAR_DATABASE_URL")
	pool, err := postgres.Open(ctx, postgres.PoolConfig{
		URL:              databaseURL,
		MaximumOpenConns: 20,
		StatementTimeout: 5 * time.Second,
	})
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	eventRepository := postgres.NewEvents(pool)
	runRepository := postgres.NewRuns(pool)
	operatorRepository := postgres.NewOperator(pool)
	application, err := httpserver.New(httpserver.Config{
		WebOrigin:     requiredEnvironment(logger, "BAAHAR_WEB_ORIGIN"),
		OperatorToken: requiredEnvironment(logger, "BAAHAR_OPERATOR_TOKEN"),
		CursorSecret:  requiredEnvironment(logger, "BAAHAR_CURSOR_SECRET"),
		Events:        eventRepository,
		Runs:          runRepository,
		Operator:      operatorRepository,
		Logger:        logger,
	})
	if err != nil {
		logger.Error("HTTP server configuration failed", "error", err)
		os.Exit(1)
	}
	address := os.Getenv("BAAHAR_HTTP_ADDR")
	if address == "" {
		address = ":8080"
	}
	server := &http.Server{
		Addr:              address,
		Handler:           application.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serveErrors := make(chan error, 1)
	go func() {
		logger.Info("API listening", "address", address)
		serveErrors <- server.ListenAndServe()
	}()
	select {
	case err := <-serveErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("API stopped unexpectedly", "error", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("API shutdown failed", "error", err)
			os.Exit(1)
		}
		logger.Info("API stopped")
	}
}

func requiredEnvironment(logger *slog.Logger, name string) string {
	value := os.Getenv(name)
	if value == "" {
		logger.Error("required environment variable is missing", "name", name)
		os.Exit(1)
	}
	return value
}
