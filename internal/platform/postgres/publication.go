package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/events"
	"github.com/siddhantk232/baahar/internal/sources"
)

type Publication struct {
	pool *pgxpool.Pool
}

func NewPublication(pool *pgxpool.Pool) *Publication {
	return &Publication{pool: pool}
}

func (publication *Publication) Publish(
	ctx context.Context,
	runID uuid.UUID,
	source sources.Config,
	prepared collections.PreparedDataset,
	completedAt time.Time,
) error {
	if prepared.HealthCode != "" || len(prepared.Candidates) == 0 {
		return errors.New("only a healthy non-empty dataset can be published")
	}
	tx, err := publication.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin publication: %w", err)
	}
	defer tx.Rollback(ctx)
	run, err := lockValidatingRun(ctx, tx, runID, source.ID)
	if err != nil {
		return err
	}
	if err := lockSourcePublication(ctx, tx, source.ID); err != nil {
		return err
	}
	if err := insertQuarantines(ctx, tx, runID, prepared.Quarantined); err != nil {
		return err
	}
	comparisonTime := run.TriggeredAt
	comparisonRunID := runID
	evidenceAt := completedAt
	if run.PriorRunID != nil {
		comparisonRunID = *run.PriorRunID
		var priorCompletedAt *time.Time
		if err := tx.QueryRow(ctx, `
			SELECT triggered_at, completed_at FROM collection_runs WHERE id = $1`, comparisonRunID).Scan(&comparisonTime, &priorCompletedAt); err != nil {
			return fmt.Errorf("read replay artifact time: %w", err)
		}
		if priorCompletedAt == nil {
			return errors.New("replay artifact run is not complete")
		}
		evidenceAt = *priorCompletedAt
	}
	newerTerminal, err := hasNewerTerminalRun(ctx, tx, source.ID, comparisonTime, comparisonRunID)
	if err != nil {
		return err
	}
	if newerTerminal {
		if err := finishValidationOnlyRun(ctx, tx, runID, prepared, completedAt); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit validation-only run: %w", err)
		}
		return nil
	}
	for _, candidate := range prepared.Candidates {
		if err := publishCandidate(ctx, tx, runID, source, candidate, completedAt); err != nil {
			return err
		}
	}
	if prepared.TrackAbsence && run.PriorRunID == nil {
		observationHorizon := prepared.Candidates[0].Version.ObservedAt
		for _, candidate := range prepared.Candidates[1:] {
			if candidate.Version.ObservedAt.After(observationHorizon) {
				observationHorizon = candidate.Version.ObservedAt
			}
		}
		if err := recordMissingObservations(ctx, tx, runID, source, observationHorizon); err != nil {
			return err
		}
	}
	healthSummary, _ := json.Marshal(map[string]int{
		"accepted":    len(prepared.Candidates),
		"quarantined": len(prepared.Quarantined),
	})
	result, err := tx.Exec(ctx, `
		UPDATE collection_runs
		SET status = 'published', completed_at = $2, accepted_count = $3,
			quarantined_count = $4, health_summary = $5, error_code = NULL
		WHERE id = $1 AND status = 'validating'`,
		runID, completedAt, len(prepared.Candidates), len(prepared.Quarantined), healthSummary)
	if err != nil {
		return fmt.Errorf("publish collection run: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("collection run is no longer validating")
	}
	_, err = tx.Exec(ctx, `
		UPDATE sources
		SET last_healthy_at = $2::timestamptz,
			next_due_at = $2::timestamptz + make_interval(secs => cadence_seconds),
			publication_state = 'active',
			updated_at = $3::timestamptz
		WHERE id = $1`, source.ID, evidenceAt, completedAt)
	if err != nil {
		return fmt.Errorf("mark source healthy: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit publication: %w", err)
	}
	return nil
}

func (publication *Publication) Reject(
	ctx context.Context,
	runID uuid.UUID,
	sourceID uuid.UUID,
	receivedCount int,
	prepared collections.PreparedDataset,
	completedAt time.Time,
) error {
	if prepared.HealthCode == "" {
		return errors.New("rejected dataset requires a health code")
	}
	tx, err := publication.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin rejected publication: %w", err)
	}
	defer tx.Rollback(ctx)
	run, err := lockValidatingRun(ctx, tx, runID, sourceID)
	if err != nil {
		return err
	}
	if err := lockSourcePublication(ctx, tx, sourceID); err != nil {
		return err
	}
	outOfOrder, err := hasNewerTerminalForRun(ctx, tx, sourceID, runID, run)
	if err != nil {
		return err
	}
	if err := insertQuarantines(ctx, tx, runID, prepared.Quarantined); err != nil {
		return err
	}
	health := map[string]any{
		"code":        prepared.HealthCode,
		"accepted":    len(prepared.Candidates),
		"quarantined": len(prepared.Quarantined),
	}
	if outOfOrder {
		health["out_of_order"] = true
	}
	healthSummary, _ := json.Marshal(health)
	result, err := tx.Exec(ctx, `
		UPDATE collection_runs
		SET status = 'rejected', completed_at = $2, received_count = $3,
			accepted_count = $4, quarantined_count = $5, health_summary = $6, error_code = $7
		WHERE id = $1 AND status = 'validating'`,
		runID, completedAt, receivedCount, len(prepared.Candidates), len(prepared.Quarantined), healthSummary, prepared.HealthCode)
	if err != nil {
		return fmt.Errorf("reject collection run: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("collection run is no longer validating")
	}
	if outOfOrder {
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit out-of-order rejected run: %w", err)
		}
		return nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE sources SET publication_state = 'frozen', updated_at = $2 WHERE id = $1`, sourceID, completedAt); err != nil {
		return fmt.Errorf("freeze source publication: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO operator_incidents (
			id, source_id, collection_run_id, health_code, state, summary, opened_at
		) VALUES ($1, $2, $3, $4, 'open', $5, $6)`,
		uuid.Must(uuid.NewV7()), sourceID, runID, prepared.HealthCode, string(healthSummary), completedAt); err != nil {
		return fmt.Errorf("create source incident: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit rejected publication: %w", err)
	}
	return nil
}

func (publication *Publication) Fail(ctx context.Context, runID, sourceID uuid.UUID, errorCode string, completedAt time.Time) error {
	tx, err := publication.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin failed run: %w", err)
	}
	defer tx.Rollback(ctx)
	var priorRunID *uuid.UUID
	var status string
	var triggeredAt time.Time
	if err := tx.QueryRow(ctx, `
		SELECT prior_run_id, status, triggered_at FROM collection_runs
		WHERE id = $1 AND source_id = $2 FOR UPDATE`, runID, sourceID).Scan(&priorRunID, &status, &triggeredAt); err != nil {
		return fmt.Errorf("lock failed collection run: %w", err)
	}
	if status == string(collections.RunPublished) || status == string(collections.RunRejected) || status == string(collections.RunFailed) {
		return nil
	}
	if err := lockSourcePublication(ctx, tx, sourceID); err != nil {
		return err
	}
	outOfOrder, err := hasNewerTerminalForRun(ctx, tx, sourceID, runID, lockedPublicationRun{
		PriorRunID: priorRunID, TriggeredAt: triggeredAt,
	})
	if err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `
		UPDATE collection_runs
		SET status = 'failed', completed_at = $3, error_code = $2,
			health_summary = jsonb_build_object('code', $2::text, 'out_of_order', $4::boolean)
		WHERE id = $1 AND status IN ('queued', 'collecting', 'validating')`, runID, errorCode, completedAt, outOfOrder)
	if err != nil {
		return fmt.Errorf("fail collection run: %w", err)
	}
	if result.RowsAffected() == 0 {
		return nil
	}
	if outOfOrder {
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit out-of-order failed run: %w", err)
		}
		return nil
	}
	if _, err := tx.Exec(ctx, `UPDATE sources SET publication_state = 'frozen', updated_at = $2 WHERE id = $1`, sourceID, completedAt); err != nil {
		return fmt.Errorf("freeze failed source: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO operator_incidents (
			id, source_id, collection_run_id, health_code, state, summary, opened_at
		) VALUES ($1, $2, $3, $4, 'open', $4, $5)`,
		uuid.Must(uuid.NewV7()), sourceID, runID, errorCode, completedAt); err != nil {
		return fmt.Errorf("create failed-run incident: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit failed run: %w", err)
	}
	return nil
}

func publishCandidate(
	ctx context.Context,
	tx pgx.Tx,
	runID uuid.UUID,
	source sources.Config,
	candidate collections.Candidate,
	publishedAt time.Time,
) error {
	var occurrenceID uuid.UUID
	var eventID uuid.UUID
	var currentVersionID *uuid.UUID
	var lastObservedAt time.Time
	err := tx.QueryRow(ctx, `
		SELECT id, event_id, current_version_id, last_observed_at
		FROM event_occurrences
		WHERE source_id = $1 AND source_identity = $2
		FOR UPDATE`, source.ID, candidate.Identity).Scan(&occurrenceID, &eventID, &currentVersionID, &lastObservedAt)
	newOccurrence := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !newOccurrence {
		return fmt.Errorf("find occurrence for publication: %w", err)
	}
	if newOccurrence {
		eventID = uuid.Must(uuid.NewV7())
		occurrenceID = uuid.Must(uuid.NewV7())
		if _, err := tx.Exec(ctx, `
			INSERT INTO events (id, city_id, slug, canonical_title, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $5)`, eventID, source.CityID, candidate.Slug, candidate.Version.Title, publishedAt); err != nil {
			return fmt.Errorf("create event: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO event_occurrences (
				id, event_id, source_id, source_identity, start_date, end_date, starts_at, ends_at,
				time_precision, timezone, first_observed_at, last_observed_at, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $12)`,
			occurrenceID, eventID, source.ID, candidate.Identity,
			candidate.Version.StartDate, candidate.Version.EndDate, candidate.Version.StartsAt,
			candidate.Version.EndsAt, candidate.Version.TimePrecision, candidate.Version.Timezone,
			candidate.Version.ObservedAt, publishedAt); err != nil {
			return fmt.Errorf("create event occurrence: %w", err)
		}
	}

	versionID, _, err := insertEventVersion(ctx, tx, occurrenceID, runID, candidate)
	if err != nil {
		return err
	}
	staleObservation := !newOccurrence && candidate.Version.ObservedAt.Before(lastObservedAt)
	if !newOccurrence && candidate.Version.ObservedAt.Equal(lastObservedAt) && currentVersionID != nil && *currentVersionID != versionID {
		staleObservation = true
	}
	transition := !staleObservation && (currentVersionID == nil || *currentVersionID != versionID)
	if transition {
		var change events.Change
		if currentVersionID != nil {
			current, err := storedVersion(ctx, tx, *currentVersionID)
			if err != nil {
				return err
			}
			change = events.MaterialDiff(current, candidate.Version)
			if change.Material() {
				kind := "updated"
				if candidate.Version.Status == events.StatusCancelled {
					kind = "cancelled"
				} else if candidate.Version.Status == events.StatusPostponed {
					kind = "postponed"
				}
				fields := make([]string, len(change.Fields))
				for index, field := range change.Fields {
					fields[index] = string(field)
				}
				if _, err := tx.Exec(ctx, `
					INSERT INTO event_changes (
						id, collection_run_id, occurrence_id, from_version_id, to_version_id, kind, changed_fields, created_at
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
					uuid.Must(uuid.NewV7()), runID, occurrenceID, currentVersionID, versionID, kind, fields, publishedAt); err != nil {
					return fmt.Errorf("record material event change: %w", err)
				}
			}
		}
		if _, err := tx.Exec(ctx, `
			UPDATE event_occurrences
			SET start_date = $2, end_date = $3, starts_at = $4, ends_at = $5,
				time_precision = $6, timezone = $7, current_version_id = $8,
				last_observed_at = $9, missing_observations = 0, visible = true, updated_at = $10
			WHERE id = $1`, occurrenceID, candidate.Version.StartDate, candidate.Version.EndDate,
			candidate.Version.StartsAt, candidate.Version.EndsAt, candidate.Version.TimePrecision,
			candidate.Version.Timezone, versionID, candidate.Version.ObservedAt, publishedAt); err != nil {
			return fmt.Errorf("advance current event version: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE events SET canonical_title = $2, updated_at = $3 WHERE id = $1`, eventID, candidate.Version.Title, publishedAt); err != nil {
			return fmt.Errorf("update event title: %w", err)
		}
		payload, _ := json.Marshal(map[string]string{
			"city":          source.CitySlug,
			"occurrence_id": occurrenceID.String(),
		})
		if _, err := tx.Exec(ctx, `
			INSERT INTO outbox (id, topic, aggregate_id, payload, created_at)
			VALUES ($1, 'event.published', $2, $3, $4)`, uuid.Must(uuid.NewV7()), occurrenceID, payload, publishedAt); err != nil {
			return fmt.Errorf("write publication outbox: %w", err)
		}
	} else if !staleObservation {
		if _, err := tx.Exec(ctx, `
			UPDATE event_occurrences
			SET last_observed_at = GREATEST(last_observed_at, $2), missing_observations = 0, visible = true, updated_at = $3
			WHERE id = $1`, occurrenceID, candidate.Version.ObservedAt, publishedAt); err != nil {
			return fmt.Errorf("refresh event observation: %w", err)
		}
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO source_observations (collection_run_id, occurrence_id, state, observed_at)
		VALUES ($1, $2, 'present', $3)
		ON CONFLICT (collection_run_id, occurrence_id) DO NOTHING`, runID, occurrenceID, candidate.Version.ObservedAt); err != nil {
		return fmt.Errorf("record source observation: %w", err)
	}
	return nil
}

func recordMissingObservations(ctx context.Context, tx pgx.Tx, runID uuid.UUID, source sources.Config, observedAt time.Time) error {
	rows, err := tx.Query(ctx, `
		SELECT occurrence.id
		FROM event_occurrences occurrence
		WHERE occurrence.source_id = $1
		  AND occurrence.current_version_id IS NOT NULL
		  AND NOT EXISTS (
			SELECT 1
			FROM source_observations observation
			WHERE observation.collection_run_id = $2
			  AND observation.occurrence_id = occurrence.id
		  )
		  AND occurrence.first_observed_at <= $3
		  AND CASE
			WHEN occurrence.ends_at IS NOT NULL THEN occurrence.ends_at
			WHEN occurrence.time_precision = 'date' OR occurrence.end_date IS NOT NULL
				THEN (COALESCE(occurrence.end_date, occurrence.start_date) + 1)::timestamp AT TIME ZONE occurrence.timezone
			ELSE occurrence.starts_at + interval '1 microsecond'
		  END >= $3
		FOR UPDATE`, source.ID, runID, observedAt)
	if err != nil {
		return fmt.Errorf("find missing source occurrences: %w", err)
	}
	missing := make([]uuid.UUID, 0)
	for rows.Next() {
		var occurrenceID uuid.UUID
		if err := rows.Scan(&occurrenceID); err != nil {
			rows.Close()
			return fmt.Errorf("scan missing source occurrence: %w", err)
		}
		missing = append(missing, occurrenceID)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("read missing source occurrences: %w", err)
	}
	rows.Close()
	for _, occurrenceID := range missing {
		if _, err := tx.Exec(ctx, `
			INSERT INTO source_observations (collection_run_id, occurrence_id, state, observed_at)
			VALUES ($1, $2, 'missing', $3)`, runID, occurrenceID, observedAt); err != nil {
			return fmt.Errorf("record missing source observation: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE event_occurrences
			SET missing_observations = missing_observations + 1,
				visible = (missing_observations + 1 < $2),
				updated_at = $3
			WHERE id = $1`, occurrenceID, source.AbsenceThreshold, observedAt); err != nil {
			return fmt.Errorf("advance missing source observation: %w", err)
		}
	}
	return nil
}

func insertEventVersion(ctx context.Context, tx pgx.Tx, occurrenceID, runID uuid.UUID, candidate collections.Candidate) (uuid.UUID, bool, error) {
	version := candidate.Version
	versionID := uuid.Must(uuid.NewV7())
	var priceMin *int64
	var priceMax *int64
	var currency *string
	if version.Price != nil {
		priceMin = &version.Price.MinMinor
		priceMax = version.Price.MaxMinor
		currency = &version.Price.Currency
	}
	var registrationState *string
	if version.RegistrationState != nil {
		value := string(*version.RegistrationState)
		registrationState = &value
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO event_versions (
			id, occurrence_id, collection_run_id, fingerprint, title, category, source_url,
			start_date, end_date, starts_at, ends_at, time_precision, timezone,
			venue_name, venue_address, is_free, price_min_minor, price_max_minor, currency,
			registration_url, registration_state, status, languages, age_note,
			accessibility_note, image_url, observed_at, canonical_record
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
		)
		ON CONFLICT (occurrence_id, fingerprint) DO NOTHING
		RETURNING id`,
		versionID, occurrenceID, runID, candidate.Fingerprint, version.Title, version.Category,
		version.SourceURL, version.StartDate, version.EndDate, version.StartsAt, version.EndsAt,
		version.TimePrecision, version.Timezone, version.VenueName, version.VenueAddress,
		version.IsFree, priceMin, priceMax, currency, version.RegistrationURL, registrationState,
		version.Status, version.Languages, version.AgeNote, version.AccessibilityNote,
		version.ImageURL, version.ObservedAt, candidate.CanonicalRecord).Scan(&versionID)
	if err == nil {
		return versionID, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, fmt.Errorf("insert event version: %w", err)
	}
	if err := tx.QueryRow(ctx, `
		SELECT id FROM event_versions WHERE occurrence_id = $1 AND fingerprint = $2`,
		occurrenceID, candidate.Fingerprint).Scan(&versionID); err != nil {
		return uuid.Nil, false, fmt.Errorf("reconcile event version: %w", err)
	}
	return versionID, false, nil
}

func storedVersion(ctx context.Context, tx pgx.Tx, versionID uuid.UUID) (events.Version, error) {
	var version events.Version
	var category string
	var precision string
	var status string
	var priceMin *int64
	var priceMax *int64
	var currency *string
	var registrationState *string
	err := tx.QueryRow(ctx, `
		SELECT title, category, source_url, start_date, end_date, starts_at, ends_at,
			time_precision, timezone, venue_name, venue_address, is_free,
			price_min_minor, price_max_minor, currency, registration_url,
			registration_state, status, languages, age_note, accessibility_note,
			image_url, observed_at
		FROM event_versions WHERE id = $1`, versionID).Scan(
		&version.Title, &category, &version.SourceURL, &version.StartDate, &version.EndDate,
		&version.StartsAt, &version.EndsAt, &precision, &version.Timezone, &version.VenueName,
		&version.VenueAddress, &version.IsFree, &priceMin, &priceMax, &currency,
		&version.RegistrationURL, &registrationState, &status, &version.Languages,
		&version.AgeNote, &version.AccessibilityNote, &version.ImageURL, &version.ObservedAt)
	if err != nil {
		return events.Version{}, fmt.Errorf("read current event version: %w", err)
	}
	version.Category = events.Category(category)
	version.TimePrecision = events.TimePrecision(precision)
	version.Status = events.Status(status)
	if priceMin != nil {
		version.Price = &events.Money{MinMinor: *priceMin, MaxMinor: priceMax, Currency: stringValue(currency)}
	}
	if registrationState != nil {
		value := events.RegistrationState(*registrationState)
		version.RegistrationState = &value
	}
	location, err := time.LoadLocation(version.Timezone)
	if err != nil {
		return events.Version{}, fmt.Errorf("load current event timezone: %w", err)
	}
	version.StartDate = dateInLocation(version.StartDate, location)
	if version.EndDate != nil {
		end := dateInLocation(*version.EndDate, location)
		version.EndDate = &end
	}
	return version, nil
}

type lockedPublicationRun struct {
	PriorRunID  *uuid.UUID
	TriggeredAt time.Time
}

func lockValidatingRun(ctx context.Context, tx pgx.Tx, runID, sourceID uuid.UUID) (lockedPublicationRun, error) {
	var status string
	var run lockedPublicationRun
	err := tx.QueryRow(ctx, `
		SELECT status, prior_run_id, triggered_at
		FROM collection_runs WHERE id = $1 AND source_id = $2 FOR UPDATE`, runID, sourceID).Scan(&status, &run.PriorRunID, &run.TriggeredAt)
	if err != nil {
		return lockedPublicationRun{}, fmt.Errorf("lock collection run: %w", err)
	}
	if status != "validating" {
		return lockedPublicationRun{}, fmt.Errorf("collection run status is %q, want validating", status)
	}
	return run, nil
}

func lockSourcePublication(ctx context.Context, tx pgx.Tx, sourceID uuid.UUID) error {
	var lockedID uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT id FROM sources WHERE id = $1 FOR UPDATE`, sourceID).Scan(&lockedID); err != nil {
		return fmt.Errorf("lock source publication: %w", err)
	}
	return nil
}

func hasNewerTerminalRun(ctx context.Context, tx pgx.Tx, sourceID uuid.UUID, triggeredAt time.Time, runID uuid.UUID) (bool, error) {
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM collection_runs
			WHERE source_id = $1 AND status IN ('published', 'rejected', 'failed')
			  AND (triggered_at, id) > ($2, $3)
		)`, sourceID, triggeredAt, runID).Scan(&exists); err != nil {
		return false, fmt.Errorf("check source publication order: %w", err)
	}
	return exists, nil
}

func hasNewerTerminalForRun(
	ctx context.Context,
	tx pgx.Tx,
	sourceID uuid.UUID,
	runID uuid.UUID,
	run lockedPublicationRun,
) (bool, error) {
	comparisonRunID := runID
	triggeredAt := run.TriggeredAt
	if run.PriorRunID != nil {
		comparisonRunID = *run.PriorRunID
		if err := tx.QueryRow(ctx, `SELECT triggered_at FROM collection_runs WHERE id = $1`, comparisonRunID).Scan(&triggeredAt); err != nil {
			return false, fmt.Errorf("read replay artifact time: %w", err)
		}
	}
	return hasNewerTerminalRun(ctx, tx, sourceID, triggeredAt, comparisonRunID)
}

func finishValidationOnlyRun(ctx context.Context, tx pgx.Tx, runID uuid.UUID, prepared collections.PreparedDataset, completedAt time.Time) error {
	healthSummary, _ := json.Marshal(map[string]any{
		"accepted":        len(prepared.Candidates),
		"quarantined":     len(prepared.Quarantined),
		"validation_only": true,
	})
	result, err := tx.Exec(ctx, `
		UPDATE collection_runs
		SET status = 'published', completed_at = $2, accepted_count = $3,
			quarantined_count = $4, health_summary = $5, error_code = NULL
		WHERE id = $1 AND status = 'validating'`, runID, completedAt,
		len(prepared.Candidates), len(prepared.Quarantined), healthSummary)
	if err != nil {
		return fmt.Errorf("finish validation-only run: %w", err)
	}
	if result.RowsAffected() != 1 {
		return errors.New("collection run is no longer validating")
	}
	return nil
}

func insertQuarantines(ctx context.Context, tx pgx.Tx, runID uuid.UUID, quarantines []collections.Quarantine) error {
	for _, quarantine := range quarantines {
		diagnostic := truncateUTF8(quarantine.Diagnostic, 4000)
		if _, err := tx.Exec(ctx, `
			INSERT INTO quarantined_records (
				id, collection_run_id, record_index, error_code, diagnostic
			) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (collection_run_id, record_index, error_code) DO NOTHING`,
			uuid.Must(uuid.NewV7()), runID, quarantine.Index, quarantine.Code, diagnostic); err != nil {
			return fmt.Errorf("store quarantined record diagnostic: %w", err)
		}
	}
	return nil
}

func truncateUTF8(value string, maximumBytes int) string {
	if len(value) <= maximumBytes {
		return value
	}
	cut := maximumBytes
	for cut > 0 && !utf8.ValidString(value[:cut]) {
		cut--
	}
	return value[:cut]
}
