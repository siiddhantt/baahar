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
			s.last_healthy_at, s.collector_id, s.schema_version, s.publication_state, s.next_due_at
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
			&source.SchemaVersion,
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
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			result[index].LatestRun = &latest
		}

		incident, err := latestOpenIncident(operator.pool.QueryRow(ctx, `
			SELECT id, source_id, collection_run_id, health_code, state, opened_at, acknowledged_at
			FROM operator_incidents
			WHERE source_id = $1 AND state = 'open'
			ORDER BY opened_at DESC, id DESC
			LIMIT 1`, result[index].ID))
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return nil, err
		}
		result[index].ActiveIncident = &incident
	}
	return result, nil
}

type incidentScanner interface {
	Scan(...any) error
}

func latestOpenIncident(scanner incidentScanner) (sources.Incident, error) {
	var incident sources.Incident
	if err := scanner.Scan(
		&incident.ID,
		&incident.SourceID,
		&incident.RunID,
		&incident.Code,
		&incident.State,
		&incident.CreatedAt,
		&incident.AcknowledgedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sources.Incident{}, pgx.ErrNoRows
		}
		return sources.Incident{}, fmt.Errorf("scan active source incident: %w", err)
	}
	return incident, nil
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

func (operator *Operator) CreateSourceAlias(
	ctx context.Context,
	sourceID uuid.UUID,
	incomingIdentity string,
	occurrenceID uuid.UUID,
	reason string,
	idempotencyKey string,
	actor string,
	traceID string,
	now time.Time,
) (sources.IdentityAlias, error) {
	tx, err := operator.pool.Begin(ctx)
	if err != nil {
		return sources.IdentityAlias{}, fmt.Errorf("begin source alias review: %w", err)
	}
	defer tx.Rollback(ctx)
	if alias, err := findAliasByIdempotency(ctx, tx, sourceID, idempotencyKey); err == nil {
		if alias.IncomingIdentity != incomingIdentity || alias.OccurrenceID != occurrenceID || alias.Reason != reason {
			return sources.IdentityAlias{}, sources.ErrConflict
		}
		return alias, tx.Commit(ctx)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return sources.IdentityAlias{}, err
	}
	var fallbackIdentity bool
	if err := tx.QueryRow(ctx, `
		SELECT source_event_id_pattern IS NULL FROM sources WHERE id = $1 FOR UPDATE`, sourceID).Scan(&fallbackIdentity); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sources.IdentityAlias{}, sources.ErrNotFound
		}
		return sources.IdentityAlias{}, fmt.Errorf("validate alias source policy: %w", err)
	}
	if !fallbackIdentity {
		return sources.IdentityAlias{}, sources.ErrConflict
	}
	var targetMergedInto *uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT merged_into_occurrence_id
		FROM event_occurrences
		WHERE id = $1 AND source_id = $2
		FOR UPDATE`, occurrenceID, sourceID).Scan(&targetMergedInto); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sources.IdentityAlias{}, sources.ErrNotFound
		}
		return sources.IdentityAlias{}, fmt.Errorf("validate alias occurrence ownership: %w", err)
	}
	if targetMergedInto != nil {
		return sources.IdentityAlias{}, sources.ErrConflict
	}
	if existing, err := findAliasByIdentity(ctx, tx, sourceID, incomingIdentity); err == nil {
		if existing.OccurrenceID != occurrenceID || existing.Reason != reason {
			return sources.IdentityAlias{}, sources.ErrConflict
		}
		if err := tx.Commit(ctx); err != nil {
			return sources.IdentityAlias{}, fmt.Errorf("commit reconciled source alias: %w", err)
		}
		return existing, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return sources.IdentityAlias{}, fmt.Errorf("find existing source alias: %w", err)
	}
	var mergedOccurrenceID *uuid.UUID
	var primaryID uuid.UUID
	var primaryMergedInto *uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id, merged_into_occurrence_id
		FROM event_occurrences
		WHERE source_id = $1 AND source_identity = $2
		FOR UPDATE`, sourceID, incomingIdentity).Scan(&primaryID, &primaryMergedInto); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return sources.IdentityAlias{}, fmt.Errorf("check alias primary identity: %w", err)
	} else if err == nil {
		if primaryID == occurrenceID || primaryMergedInto != nil {
			return sources.IdentityAlias{}, sources.ErrConflict
		}
		var hasDependants bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM event_occurrences
				WHERE merged_into_occurrence_id = $1
			)`, primaryID).Scan(&hasDependants); err != nil {
			return sources.IdentityAlias{}, fmt.Errorf("check occurrence merge dependants: %w", err)
		}
		if hasDependants {
			return sources.IdentityAlias{}, sources.ErrConflict
		}
		if _, err := tx.Exec(ctx, `
			UPDATE event_occurrences
			SET merged_into_occurrence_id = $2, merged_at = $3, visible = false, updated_at = $3
			WHERE id = $1`, primaryID, occurrenceID, now); err != nil {
			return sources.IdentityAlias{}, fmt.Errorf("merge duplicate occurrence: %w", err)
		}
		mergedOccurrenceID = &primaryID
	}
	result, err := tx.Exec(ctx, `
		INSERT INTO source_aliases (
			source_id, old_identity, occurrence_id, merged_occurrence_id, reason, idempotency_key, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT DO NOTHING`,
		sourceID, incomingIdentity, occurrenceID, mergedOccurrenceID, reason, idempotencyKey, now)
	if err != nil {
		return sources.IdentityAlias{}, fmt.Errorf("create source alias: %w", err)
	}
	if result.RowsAffected() == 0 {
		alias, err := findAliasByIdempotency(ctx, tx, sourceID, idempotencyKey)
		if errors.Is(err, pgx.ErrNoRows) {
			alias, err = findAliasByIdentity(ctx, tx, sourceID, incomingIdentity)
		}
		if err != nil {
			return sources.IdentityAlias{}, fmt.Errorf("reconcile source alias: %w", err)
		}
		if alias.IncomingIdentity != incomingIdentity || alias.OccurrenceID != occurrenceID || alias.Reason != reason {
			return sources.IdentityAlias{}, sources.ErrConflict
		}
		if err := tx.Commit(ctx); err != nil {
			return sources.IdentityAlias{}, fmt.Errorf("commit reconciled source alias: %w", err)
		}
		return alias, nil
	}
	if err := recordAudit(ctx, tx, actor, "create_source_alias", "event_occurrence", occurrenceID, traceID, now); err != nil {
		return sources.IdentityAlias{}, err
	}
	alias := sources.IdentityAlias{
		SourceID: sourceID, IncomingIdentity: incomingIdentity,
		OccurrenceID: occurrenceID, MergedOccurrenceID: mergedOccurrenceID, Reason: reason, CreatedAt: now,
	}
	if err := tx.Commit(ctx); err != nil {
		return sources.IdentityAlias{}, fmt.Errorf("commit source alias: %w", err)
	}
	return alias, nil
}

func findAliasByIdempotency(ctx context.Context, tx pgx.Tx, sourceID uuid.UUID, key string) (sources.IdentityAlias, error) {
	return scanAlias(tx.QueryRow(ctx, `
		SELECT source_id, old_identity, occurrence_id, merged_occurrence_id, reason, created_at
		FROM source_aliases WHERE source_id = $1 AND idempotency_key = $2`, sourceID, key))
}

func findAliasByIdentity(ctx context.Context, tx pgx.Tx, sourceID uuid.UUID, identity string) (sources.IdentityAlias, error) {
	return scanAlias(tx.QueryRow(ctx, `
		SELECT source_id, old_identity, occurrence_id, merged_occurrence_id, reason, created_at
		FROM source_aliases WHERE source_id = $1 AND old_identity = $2`, sourceID, identity))
}

func scanAlias(row pgx.Row) (sources.IdentityAlias, error) {
	var alias sources.IdentityAlias
	if err := row.Scan(&alias.SourceID, &alias.IncomingIdentity, &alias.OccurrenceID, &alias.MergedOccurrenceID, &alias.Reason, &alias.CreatedAt); err != nil {
		return sources.IdentityAlias{}, err
	}
	return alias, nil
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
