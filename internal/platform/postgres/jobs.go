package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siddhantk232/baahar/internal/collections"
)

type Jobs struct {
	pool *pgxpool.Pool
}

func NewJobs(pool *pgxpool.Pool) *Jobs {
	return &Jobs{pool: pool}
}

func (jobs *Jobs) Enqueue(ctx context.Context, job collections.Job) (collections.Job, error) {
	_, err := jobs.pool.Exec(ctx, `
		INSERT INTO jobs (id, kind, dedupe_key, payload, status, available_at, attempt, max_attempts)
		VALUES ($1, $2, $3, $4, 'ready', $5, 0, $6)
		ON CONFLICT (kind, dedupe_key) DO NOTHING`,
		job.ID, job.Kind, job.DedupeKey, job.Payload, job.AvailableAt, job.MaxAttempts,
	)
	if err != nil {
		return collections.Job{}, fmt.Errorf("enqueue %s job: %w", job.Kind, err)
	}
	stored, err := jobs.findByDedupe(ctx, job.Kind, job.DedupeKey)
	if err != nil {
		return collections.Job{}, err
	}
	return stored, nil
}

func (jobs *Jobs) Claim(ctx context.Context, workerID string, limit int, leaseUntil time.Time, now time.Time) ([]collections.Job, error) {
	if workerID == "" {
		return nil, errors.New("worker ID is required")
	}
	if limit < 1 || limit > 100 {
		return nil, errors.New("job claim limit must be between 1 and 100")
	}
	if !leaseUntil.After(now) {
		return nil, errors.New("job lease must end after claim time")
	}
	rows, err := jobs.pool.Query(ctx, `
		WITH candidates AS (
			SELECT id
			FROM jobs
			WHERE attempt < max_attempts
			  AND available_at <= $1
			  AND (status = 'ready' OR (status = 'leased' AND leased_until <= $1))
			ORDER BY available_at, id
			FOR UPDATE SKIP LOCKED
			LIMIT $2
		)
		UPDATE jobs AS job
		SET status = 'leased',
			attempt = job.attempt + 1,
			leased_by = $3,
			leased_until = $4
		FROM candidates
		WHERE job.id = candidates.id
		RETURNING job.id, job.kind, job.dedupe_key, job.payload, job.status, job.available_at,
			job.attempt, job.max_attempts, job.leased_by, job.leased_until, job.last_error_code,
			job.created_at, job.completed_at`, now, limit, workerID, leaseUntil)
	if err != nil {
		return nil, fmt.Errorf("claim jobs: %w", err)
	}
	defer rows.Close()
	claimed := make([]collections.Job, 0, limit)
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		claimed = append(claimed, job)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read claimed jobs: %w", err)
	}
	return claimed, nil
}

func (jobs *Jobs) Complete(ctx context.Context, jobID uuid.UUID, workerID string, completedAt time.Time) error {
	result, err := jobs.pool.Exec(ctx, `
		UPDATE jobs
		SET status = 'completed', completed_at = $3, leased_by = NULL, leased_until = NULL
		WHERE id = $1 AND status = 'leased' AND leased_by = $2`, jobID, workerID, completedAt)
	if err != nil {
		return fmt.Errorf("complete job: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("job lease is no longer owned by this worker")
	}
	return nil
}

func (jobs *Jobs) Retry(ctx context.Context, jobID uuid.UUID, workerID, errorCode string, availableAt time.Time) error {
	result, err := jobs.pool.Exec(ctx, `
		UPDATE jobs
		SET status = CASE WHEN attempt >= max_attempts THEN 'dead' ELSE 'ready' END,
			available_at = CASE WHEN attempt >= max_attempts THEN available_at ELSE $4 END,
			last_error_code = $3,
			leased_by = NULL,
			leased_until = NULL
		WHERE id = $1 AND status = 'leased' AND leased_by = $2`, jobID, workerID, errorCode, availableAt)
	if err != nil {
		return fmt.Errorf("retry job: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("job lease is no longer owned by this worker")
	}
	return nil
}

func (jobs *Jobs) Dead(ctx context.Context, jobID uuid.UUID, workerID, errorCode string) error {
	result, err := jobs.pool.Exec(ctx, `
		UPDATE jobs
		SET status = 'dead', last_error_code = $3, leased_by = NULL, leased_until = NULL
		WHERE id = $1 AND status = 'leased' AND leased_by = $2`, jobID, workerID, errorCode)
	if err != nil {
		return fmt.Errorf("mark job dead: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("job lease is no longer owned by this worker")
	}
	return nil
}

func (jobs *Jobs) findByDedupe(ctx context.Context, kind, dedupeKey string) (collections.Job, error) {
	row := jobs.pool.QueryRow(ctx, `
		SELECT id, kind, dedupe_key, payload, status, available_at, attempt, max_attempts,
			leased_by, leased_until, last_error_code, created_at, completed_at
		FROM jobs
		WHERE kind = $1 AND dedupe_key = $2`, kind, dedupeKey)
	job, err := scanJob(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return collections.Job{}, errors.New("enqueued job could not be reconciled")
		}
		return collections.Job{}, err
	}
	return job, nil
}

type jobScanner interface {
	Scan(...any) error
}

func scanJob(scanner jobScanner) (collections.Job, error) {
	var job collections.Job
	err := scanner.Scan(
		&job.ID,
		&job.Kind,
		&job.DedupeKey,
		&job.Payload,
		&job.Status,
		&job.AvailableAt,
		&job.Attempt,
		&job.MaxAttempts,
		&job.LeasedBy,
		&job.LeasedUntil,
		&job.LastErrorCode,
		&job.CreatedAt,
		&job.CompletedAt,
	)
	if err != nil {
		return collections.Job{}, fmt.Errorf("scan job: %w", err)
	}
	return job, nil
}
