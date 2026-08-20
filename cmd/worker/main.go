package main

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/platform/brightdata"
	"github.com/siiddhantt/baahar/internal/platform/postgres"
	objectstore "github.com/siiddhantt/baahar/internal/platform/s3"
	"github.com/siiddhantt/baahar/internal/worker"
)

const jobLease = 15 * time.Minute

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := postgres.Open(ctx, postgres.PoolConfig{
		URL:              requiredEnvironment(logger, "BAAHAR_DATABASE_URL"),
		MaximumOpenConns: 10,
		StatementTimeout: 30 * time.Second,
	})
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	objects, err := objectstore.Open(objectstore.Config{
		Endpoint:  requiredEnvironment(logger, "BAAHAR_OBJECT_ENDPOINT"),
		AccessKey: requiredEnvironment(logger, "BAAHAR_OBJECT_ACCESS_KEY"),
		SecretKey: requiredEnvironment(logger, "BAAHAR_OBJECT_SECRET_KEY"),
		Bucket:    requiredEnvironment(logger, "BAAHAR_OBJECT_BUCKET"),
		Region:    os.Getenv("BAAHAR_OBJECT_REGION"),
		PathStyle: environmentBool(logger, "BAAHAR_OBJECT_PATH_STYLE", true),
	})
	if err != nil {
		logger.Error("object-store configuration failed", "error", err)
		os.Exit(1)
	}
	if err := objects.EnsureBucket(ctx); err != nil {
		logger.Error("object-store startup failed", "error", err)
		os.Exit(1)
	}
	bright, err := brightdata.Open(brightdata.Config{
		BaseURL: os.Getenv("BRIGHT_DATA_API_BASE_URL"),
		Token:   requiredEnvironment(logger, "BRIGHT_DATA_API_TOKEN"),
	})
	if err != nil {
		logger.Error("Bright Data configuration failed", "error", err)
		os.Exit(1)
	}
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		logger.Error("collector contract startup failed", "error", err)
		os.Exit(1)
	}
	sourceConfigs := postgres.NewSourceConfigs(pool)
	runs := postgres.NewRuns(pool)
	publication := postgres.NewPublication(pool)
	jobs := postgres.NewJobs(pool)
	operator := postgres.NewOperator(pool)
	processor := &worker.Processor{
		Bright:      bright,
		Objects:     objects,
		Sources:     sourceConfigs,
		Runs:        runs,
		Publication: publication,
		Validator:   validator,
	}
	workerID := workerIdentity()
	logger.Info("worker started", "worker_id", workerID)
	scheduleDue(ctx, logger, sourceConfigs, operator)
	scheduleTicker := time.NewTicker(30 * time.Second)
	defer scheduleTicker.Stop()
	pollTimer := time.NewTimer(0)
	defer pollTimer.Stop()
	for {
		select {
		case <-ctx.Done():
			logger.Info("worker stopped", "worker_id", workerID)
			return
		case <-scheduleTicker.C:
			scheduleDue(ctx, logger, sourceConfigs, operator)
		case <-pollTimer.C:
			processAvailable(ctx, logger, workerID, jobs, publication, processor)
			pollTimer.Reset(2 * time.Second)
		}
	}
}

func scheduleDue(ctx context.Context, logger *slog.Logger, configs *postgres.SourceConfigs, operator *postgres.Operator) {
	now := time.Now().UTC()
	due, err := configs.Due(ctx, now, 10)
	if err != nil {
		logger.Error("source scheduling failed", "error", err)
		return
	}
	for _, source := range due {
		if source.NextDueAt == nil {
			continue
		}
		idempotencyKey := "schedule-" + strconv.FormatInt(source.NextDueAt.UTC().Unix(), 10)
		_, err := operator.QueueCollection(ctx, source.ID, idempotencyKey, "scheduler", uuid.Must(uuid.NewV7()).String(), now)
		if err != nil {
			logger.Error("source enqueue failed", "source_id", source.ID, "error", err)
		}
	}
}

func processAvailable(
	ctx context.Context,
	logger *slog.Logger,
	workerID string,
	jobs *postgres.Jobs,
	publication *postgres.Publication,
	processor *worker.Processor,
) {
	now := time.Now().UTC()
	claimed, err := jobs.Claim(ctx, workerID, 1, now.Add(jobLease), now)
	if err != nil {
		logger.Error("job claim failed", "error", err)
		return
	}
	for _, job := range claimed {
		jobCtx, cancel := context.WithTimeout(ctx, 12*time.Minute)
		err := processor.Process(jobCtx, job)
		cancel()
		if err == nil {
			if err := jobs.Complete(ctx, job.ID, workerID, time.Now().UTC()); err != nil {
				logger.Error("job completion failed", "job_id", job.ID, "error", err)
			}
			continue
		}
		if errors.Is(err, context.Canceled) && ctx.Err() != nil {
			return
		}
		processingError := &worker.ProcessingError{Code: "unexpected_worker_error", Retryable: true, Cause: err}
		var classified *worker.ProcessingError
		if errors.As(err, &classified) {
			processingError = classified
		}
		logger.Error("job processing failed",
			"job_id", job.ID,
			"run_id", processingError.RunID,
			"source_id", processingError.SourceID,
			"code", processingError.Code,
			"attempt", job.Attempt,
			"error", processingError.Cause,
		)
		if processingError.Retryable && job.Attempt < job.MaxAttempts {
			delay := retryDelay(job.Attempt)
			if err := jobs.Retry(ctx, job.ID, workerID, processingError.Code, time.Now().UTC().Add(delay)); err != nil {
				logger.Error("job retry scheduling failed", "job_id", job.ID, "error", err)
			}
			continue
		}
		if processingError.RunID != uuid.Nil && processingError.SourceID != uuid.Nil {
			if err := publication.Fail(ctx, processingError.RunID, processingError.SourceID, processingError.Code, time.Now().UTC()); err != nil {
				logger.Error("failed run recording failed", "run_id", processingError.RunID, "error", err)
				continue
			}
		}
		if err := jobs.Dead(ctx, job.ID, workerID, processingError.Code); err != nil {
			logger.Error("dead job recording failed", "job_id", job.ID, "error", err)
		}
	}
}

func retryDelay(attempt int) time.Duration {
	exponent := min(attempt-1, 6)
	base := 5 * time.Second * time.Duration(1<<exponent)
	return base + time.Duration(rand.IntN(1000))*time.Millisecond
}

func workerIdentity() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "worker"
	}
	return host + "-" + strconv.Itoa(os.Getpid())
}

func requiredEnvironment(logger *slog.Logger, name string) string {
	value := os.Getenv(name)
	if value == "" {
		logger.Error("required environment variable is missing", "name", name)
		os.Exit(1)
	}
	return value
}

func environmentBool(logger *slog.Logger, name string, fallback bool) bool {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		logger.Error("environment variable must be true or false", "name", name)
		os.Exit(1)
	}
	return value
}
