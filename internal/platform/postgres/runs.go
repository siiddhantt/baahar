package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/collections"
)

type Runs struct {
	pool *pgxpool.Pool
}

func NewRuns(pool *pgxpool.Pool) *Runs {
	return &Runs{pool: pool}
}

func (runs *Runs) Find(ctx context.Context, runID uuid.UUID) (collections.Run, error) {
	row := runs.pool.QueryRow(ctx, runSelect+` WHERE id = $1`, runID)
	run, err := scanRun(row)
	if err != nil {
		return collections.Run{}, err
	}
	return run, nil
}

func (runs *Runs) ListBySource(ctx context.Context, sourceID uuid.UUID, limit int) ([]collections.Run, error) {
	if limit < 1 || limit > 100 {
		return nil, errors.New("run list limit must be between 1 and 100")
	}
	rows, err := runs.pool.Query(ctx, runSelect+`
		WHERE source_id = $1
		ORDER BY triggered_at DESC, id DESC
		LIMIT $2`, sourceID, limit)
	if err != nil {
		return nil, fmt.Errorf("list collection runs: %w", err)
	}
	defer rows.Close()
	result := make([]collections.Run, 0, limit)
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, run)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read collection runs: %w", err)
	}
	return result, nil
}

func (runs *Runs) RecentPublishedCounts(ctx context.Context, sourceID uuid.UUID, limit int) ([]int, error) {
	if limit < 3 || limit > 20 {
		return nil, errors.New("baseline run limit must be between 3 and 20")
	}
	rows, err := runs.pool.Query(ctx, `
		SELECT received_count
		FROM collection_runs
		WHERE source_id = $1 AND status = 'published'
		  AND COALESCE((health_summary->>'validation_only')::boolean, false) = false
		ORDER BY completed_at DESC, id DESC
		LIMIT $2`, sourceID, limit)
	if err != nil {
		return nil, fmt.Errorf("read source health baseline: %w", err)
	}
	defer rows.Close()
	counts := make([]int, 0, limit)
	for rows.Next() {
		var count int
		if err := rows.Scan(&count); err != nil {
			return nil, fmt.Errorf("scan source health baseline: %w", err)
		}
		counts = append(counts, count)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read source health baseline rows: %w", err)
	}
	return counts, nil
}

func (runs *Runs) AttachCollection(ctx context.Context, runID uuid.UUID, externalCollectionID string) error {
	result, err := runs.pool.Exec(ctx, `
		UPDATE collection_runs
		SET external_collection_id = $2, status = 'collecting'
		WHERE id = $1 AND status = 'triggering'`, runID, externalCollectionID)
	if err != nil {
		return fmt.Errorf("attach external collection: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("collection run is no longer awaiting trigger reconciliation")
	}
	return nil
}

func (runs *Runs) BeginTrigger(ctx context.Context, runID uuid.UUID) error {
	result, err := runs.pool.Exec(ctx, `
		UPDATE collection_runs SET status = 'triggering'
		WHERE id = $1 AND status = 'queued'`, runID)
	if err != nil {
		return fmt.Errorf("record collection trigger intent: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("collection run is no longer queued")
	}
	return nil
}

func (runs *Runs) BeginValidation(ctx context.Context, runID uuid.UUID, objectKey, sha256 string, bytes int64, receivedCount int) error {
	result, err := runs.pool.Exec(ctx, `
		UPDATE collection_runs
		SET status = 'validating', raw_object_key = $2, raw_sha256 = $3, raw_bytes = $4,
			received_count = $5
		WHERE id = $1 AND status = 'collecting'`, runID, objectKey, sha256, bytes, receivedCount)
	if err != nil {
		return fmt.Errorf("begin run validation: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("collection run is no longer collecting")
	}
	return nil
}

func (runs *Runs) BeginReplayValidation(ctx context.Context, runID uuid.UUID, objectKey, sha256 string, bytes int64, receivedCount int) error {
	result, err := runs.pool.Exec(ctx, `
		UPDATE collection_runs
		SET status = 'validating', raw_object_key = $2, raw_sha256 = $3, raw_bytes = $4,
			received_count = $5
		WHERE id = $1 AND status = 'queued'`, runID, objectKey, sha256, bytes, receivedCount)
	if err != nil {
		return fmt.Errorf("begin replay validation: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("replay run is no longer queued")
	}
	return nil
}

const runSelect = `
	SELECT id, source_id, prior_run_id, external_collection_id, trace_id, status,
		triggered_at, completed_at, raw_object_key, raw_sha256, raw_bytes,
		received_count, accepted_count, quarantined_count, health_summary, error_code
	FROM collection_runs`

type runScanner interface {
	Scan(...any) error
}

func scanRun(scanner runScanner) (collections.Run, error) {
	var run collections.Run
	err := scanner.Scan(
		&run.ID,
		&run.SourceID,
		&run.PriorRunID,
		&run.ExternalCollectionID,
		&run.TraceID,
		&run.Status,
		&run.TriggeredAt,
		&run.CompletedAt,
		&run.RawObjectKey,
		&run.RawSHA256,
		&run.RawBytes,
		&run.ReceivedCount,
		&run.AcceptedCount,
		&run.QuarantinedCount,
		&run.HealthSummary,
		&run.ErrorCode,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return collections.Run{}, pgx.ErrNoRows
		}
		return collections.Run{}, fmt.Errorf("scan collection run: %w", err)
	}
	return run, nil
}
