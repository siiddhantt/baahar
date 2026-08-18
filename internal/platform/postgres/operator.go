package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/sources"
)

type Operator struct {
	pool *pgxpool.Pool
}

func NewOperator(pool *pgxpool.Pool) *Operator {
	return &Operator{pool: pool}
}

func (operator *Operator) ListSources(ctx context.Context, freshnessTime time.Time) ([]sources.OperatorSource, error) {
	rows, err := operator.pool.Query(ctx, `
		SELECT
			s.id, s.slug, s.display_name, s.official_url,
			c.id, c.slug, c.display_name, c.timezone, c.accent,
			CASE WHEN s.last_healthy_at IS NOT NULL
				AND s.last_healthy_at + make_interval(secs => s.freshness_ttl_seconds) >= $1
				THEN 'fresh' ELSE 'stale' END,
			s.last_healthy_at, s.collector_id, s.publication_state, s.next_due_at
		FROM sources s
		JOIN cities c ON c.id = s.city_id
		ORDER BY c.display_name, s.display_name, s.id`, freshnessTime)
	if err != nil {
		return nil, fmt.Errorf("list operator sources: %w", err)
	}
	defer rows.Close()
	result := make([]sources.OperatorSource, 0)
	for rows.Next() {
		var source sources.OperatorSource
		err := rows.Scan(
			&source.ID,
			&source.Slug,
			&source.Name,
			&source.OfficialURL,
			&source.City.ID,
			&source.City.Slug,
			&source.City.Name,
			&source.City.Timezone,
			&source.City.Accent,
			&source.Freshness,
			&source.LastHealthyAt,
			&source.CollectorID,
			&source.PublicationState,
			&source.NextDueAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan operator source: %w", err)
		}
		result = append(result, source)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read operator sources: %w", err)
	}
	rows.Close()
	for index := range result {
		latest, err := scanRun(operator.pool.QueryRow(ctx, runSelect+`
			WHERE source_id = $1
			ORDER BY triggered_at DESC, id DESC
			LIMIT 1`, result[index].ID))
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return nil, err
		}
		result[index].LatestRun = &latest
	}
	return result, nil
}

func (operator *Operator) QueueCollection(ctx context.Context, sourceID uuid.UUID, idempotencyKey, actor, traceID string, now time.Time) (collections.Run, error) {
	var exists bool
	if err := operator.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sources WHERE id = $1)`, sourceID).Scan(&exists); err != nil {
		return collections.Run{}, fmt.Errorf("check collection source: %w", err)
	}
	if !exists {
		return collections.Run{}, sources.ErrNotFound
	}
	payload := collections.CollectionJobPayload{RunID: uuid.Must(uuid.NewV7()), SourceID: sourceID}
	return operator.queueRun(ctx, "collect-source", sourceID.String()+":"+idempotencyKey, payload, nil, actor, traceID, now)
}

func (operator *Operator) QueueReplay(ctx context.Context, originalRunID uuid.UUID, idempotencyKey, actor, traceID string, now time.Time) (collections.Run, error) {
	var sourceID uuid.UUID
	var rawObjectKey *string
	var status collections.RunStatus
	err := operator.pool.QueryRow(ctx, `
		SELECT source_id, raw_object_key, status
		FROM collection_runs WHERE id = $1`, originalRunID).Scan(&sourceID, &rawObjectKey, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return collections.Run{}, sources.ErrNotFound
		}
		return collections.Run{}, fmt.Errorf("find replay source run: %w", err)
	}
	if rawObjectKey == nil {
		return collections.Run{}, errors.New("run has no immutable artifact to replay")
	}
	if status != collections.RunPublished && status != collections.RunRejected && status != collections.RunFailed {
		return collections.Run{}, errors.New("only a completed collection run can be replayed")
	}
	payload := collections.CollectionJobPayload{RunID: uuid.Must(uuid.NewV7()), SourceID: sourceID, OriginalRunID: &originalRunID}
	return operator.queueRun(ctx, "replay-run", originalRunID.String()+":"+idempotencyKey, payload, &originalRunID, actor, traceID, now)
}

func (operator *Operator) AcknowledgeIncident(ctx context.Context, incidentID uuid.UUID, actor, traceID string, now time.Time) (sources.Incident, error) {
	tx, err := operator.pool.Begin(ctx)
	if err != nil {
		return sources.Incident{}, fmt.Errorf("begin incident acknowledgement: %w", err)
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx, `
		UPDATE operator_incidents
		SET state = 'acknowledged', acknowledged_at = $2
		WHERE id = $1 AND state = 'open'`, incidentID, now)
	if err != nil {
		return sources.Incident{}, fmt.Errorf("acknowledge incident: %w", err)
	}
	if result.RowsAffected() == 1 {
		if err := recordAudit(ctx, tx, actor, "acknowledge_incident", "incident", incidentID, traceID, now); err != nil {
			return sources.Incident{}, err
		}
	}
	incident, err := findIncident(ctx, tx, incidentID)
	if err != nil {
		return sources.Incident{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return sources.Incident{}, fmt.Errorf("commit incident acknowledgement: %w", err)
	}
	return incident, nil
}

func (operator *Operator) queueRun(
	ctx context.Context,
	kind string,
	dedupeKey string,
	payload collections.CollectionJobPayload,
	priorRunID *uuid.UUID,
	actor string,
	traceID string,
	now time.Time,
) (collections.Run, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return collections.Run{}, fmt.Errorf("encode collection job: %w", err)
	}
	tx, err := operator.pool.Begin(ctx)
	if err != nil {
		return collections.Run{}, fmt.Errorf("begin collection enqueue: %w", err)
	}
	defer tx.Rollback(ctx)
	jobID := uuid.Must(uuid.NewV7())
	var insertedID *uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO jobs (id, kind, dedupe_key, payload, status, available_at, max_attempts)
		VALUES ($1, $2, $3, $4, 'ready', $5, 5)
		ON CONFLICT (kind, dedupe_key) DO NOTHING
		RETURNING id`, jobID, kind, dedupeKey, payloadJSON, now).Scan(&insertedID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return collections.Run{}, fmt.Errorf("enqueue collection job: %w", err)
	}
	if insertedID == nil {
		var existingPayload []byte
		if err := tx.QueryRow(ctx, `SELECT payload FROM jobs WHERE kind = $1 AND dedupe_key = $2`, kind, dedupeKey).Scan(&existingPayload); err != nil {
			return collections.Run{}, fmt.Errorf("reconcile collection job: %w", err)
		}
		if err := json.Unmarshal(existingPayload, &payload); err != nil {
			return collections.Run{}, fmt.Errorf("decode reconciled collection job: %w", err)
		}
	} else {
		_, err := tx.Exec(ctx, `
			INSERT INTO collection_runs (id, source_id, prior_run_id, trace_id, status, triggered_at)
			VALUES ($1, $2, $3, $4, 'queued', $5)`, payload.RunID, payload.SourceID, priorRunID, traceID, now)
		if err != nil {
			return collections.Run{}, fmt.Errorf("create queued collection run: %w", err)
		}
		if err := recordAudit(ctx, tx, actor, "queue_"+kind, "collection_run", payload.RunID, traceID, now); err != nil {
			return collections.Run{}, err
		}
	}
	run, err := scanRun(tx.QueryRow(ctx, runSelect+` WHERE id = $1`, payload.RunID))
	if err != nil {
		return collections.Run{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return collections.Run{}, fmt.Errorf("commit collection enqueue: %w", err)
	}
	return run, nil
}

func findIncident(ctx context.Context, tx pgx.Tx, incidentID uuid.UUID) (sources.Incident, error) {
	var incident sources.Incident
	err := tx.QueryRow(ctx, `
		SELECT id, source_id, collection_run_id, health_code, state, opened_at, acknowledged_at
		FROM operator_incidents
		WHERE id = $1`, incidentID).Scan(
		&incident.ID,
		&incident.SourceID,
		&incident.RunID,
		&incident.Code,
		&incident.State,
		&incident.CreatedAt,
		&incident.AcknowledgedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sources.Incident{}, sources.ErrNotFound
		}
		return sources.Incident{}, fmt.Errorf("find incident: %w", err)
	}
	return incident, nil
}

func recordAudit(ctx context.Context, tx pgx.Tx, actor, action, targetType string, targetID uuid.UUID, traceID string, now time.Time) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO operator_audit_log (id, actor, action, target_type, target_id, trace_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.Must(uuid.NewV7()), actor, action, targetType, targetID, traceID, now)
	if err != nil {
		return fmt.Errorf("record operator audit: %w", err)
	}
	return nil
}
