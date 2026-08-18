package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siddhantk232/baahar/internal/sources"
)

type SourceConfigs struct {
	pool *pgxpool.Pool
}

func NewSourceConfigs(pool *pgxpool.Pool) *SourceConfigs {
	return &SourceConfigs{pool: pool}
}

func (configs *SourceConfigs) Get(ctx context.Context, sourceID uuid.UUID) (sources.Config, error) {
	var source sources.Config
	err := configs.pool.QueryRow(ctx, `
		SELECT s.id, s.city_id, c.slug, s.slug, s.canonical_host, s.collector_id,
			s.schema_version, s.collection_input, s.source_event_id_pattern, s.page_limit, s.record_limit, s.daily_run_limit,
			s.absence_threshold, s.publication_state, s.next_due_at
		FROM sources s
		JOIN cities c ON c.id = s.city_id
		WHERE s.id = $1 AND s.enabled`, sourceID).Scan(
		&source.ID,
		&source.CityID,
		&source.CitySlug,
		&source.Slug,
		&source.CanonicalHost,
		&source.CollectorID,
		&source.SchemaVersion,
		&source.CollectionInput,
		&source.SourceEventIDPattern,
		&source.PageLimit,
		&source.RecordLimit,
		&source.DailyRunLimit,
		&source.AbsenceThreshold,
		&source.PublicationState,
		&source.NextDueAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sources.Config{}, sources.ErrNotFound
		}
		return sources.Config{}, fmt.Errorf("get source config: %w", err)
	}
	return source, nil
}

func (configs *SourceConfigs) Due(ctx context.Context, now time.Time, limit int) ([]sources.Config, error) {
	if limit < 1 || limit > 100 {
		return nil, errors.New("due-source limit must be between 1 and 100")
	}
	rows, err := configs.pool.Query(ctx, `
		SELECT s.id, s.city_id, c.slug, s.slug, s.canonical_host, s.collector_id,
			s.schema_version, s.collection_input, s.source_event_id_pattern, s.page_limit, s.record_limit, s.daily_run_limit,
			s.absence_threshold, s.publication_state, s.next_due_at
		FROM sources s
		JOIN cities c ON c.id = s.city_id
		WHERE s.enabled
		  AND s.publication_state = 'active'
		  AND s.next_due_at <= $1
		  AND (
			SELECT COUNT(*)
			FROM collection_runs run
			WHERE run.source_id = s.id
			  AND run.triggered_at >= date_trunc('day', $1::timestamptz AT TIME ZONE c.timezone) AT TIME ZONE c.timezone
		  ) < s.daily_run_limit
		ORDER BY s.next_due_at, s.id
		LIMIT $2`, now, limit)
	if err != nil {
		return nil, fmt.Errorf("list due sources: %w", err)
	}
	defer rows.Close()
	result := make([]sources.Config, 0, limit)
	for rows.Next() {
		var source sources.Config
		if err := rows.Scan(
			&source.ID,
			&source.CityID,
			&source.CitySlug,
			&source.Slug,
			&source.CanonicalHost,
			&source.CollectorID,
			&source.SchemaVersion,
			&source.CollectionInput,
			&source.SourceEventIDPattern,
			&source.PageLimit,
			&source.RecordLimit,
			&source.DailyRunLimit,
			&source.AbsenceThreshold,
			&source.PublicationState,
			&source.NextDueAt,
		); err != nil {
			return nil, fmt.Errorf("scan due source: %w", err)
		}
		result = append(result, source)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read due sources: %w", err)
	}
	return result, nil
}
