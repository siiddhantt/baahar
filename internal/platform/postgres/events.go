package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/events"
)

type Events struct {
	pool *pgxpool.Pool
}

func NewEvents(pool *pgxpool.Pool) *Events {
	return &Events{pool: pool}
}

func (repository *Events) ListCities(ctx context.Context) ([]events.City, error) {
	rows, err := repository.pool.Query(ctx, `
		SELECT id, slug, display_name, timezone, accent
		FROM cities
		WHERE enabled
		ORDER BY display_name, id`)
	if err != nil {
		return nil, fmt.Errorf("list cities: %w", err)
	}
	defer rows.Close()
	cities := make([]events.City, 0, 2)
	for rows.Next() {
		var city events.City
		if err := rows.Scan(&city.ID, &city.Slug, &city.Name, &city.Timezone, &city.Accent); err != nil {
			return nil, fmt.Errorf("scan city: %w", err)
		}
		cities = append(cities, city)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read cities: %w", err)
	}
	return cities, nil
}

func (repository *Events) List(ctx context.Context, query events.FeedQuery) (events.FeedPage, error) {
	if query.Limit < 1 || query.Limit > 60 {
		return events.FeedPage{}, errors.New("feed limit must be between 1 and 60")
	}
	if query.AsOf.IsZero() {
		return events.FeedPage{}, errors.New("feed as-of time is required")
	}
	tx, err := repository.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return events.FeedPage{}, fmt.Errorf("begin feed read: %w", err)
	}
	defer tx.Rollback(ctx)

	page := events.FeedPage{AsOf: query.AsOf.UTC()}
	if err := tx.QueryRow(ctx, `
		SELECT id, slug, display_name, timezone, accent
		FROM cities
		WHERE slug = $1 AND enabled`, query.CitySlug).Scan(
		&page.City.ID,
		&page.City.Slug,
		&page.City.Name,
		&page.City.Timezone,
		&page.City.Accent,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return events.FeedPage{}, events.ErrNotFound
		}
		return events.FeedPage{}, fmt.Errorf("get feed city: %w", err)
	}
	window, err := events.RangeForWindow(page.AsOf, page.City.Timezone, query.Window)
	if err != nil {
		return events.FeedPage{}, fmt.Errorf("calculate feed window: %w", err)
	}
	metadataWhere, metadataArguments := feedWhere(query, []any{query.CitySlug, window.Start, window.End, page.AsOf})
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(DISTINCT o.source_id), MAX(o.last_observed_at)
		`+feedFrom+metadataWhere, metadataArguments...).Scan(&page.ResultCount, &page.SourceCount, &page.LastCheckedAt)
	if err != nil {
		return events.FeedPage{}, fmt.Errorf("read feed metadata: %w", err)
	}

	pageWhere, pageArguments := feedWhere(query, []any{query.CitySlug, window.Start, window.End, page.AsOf, page.AsOf.Add(-48 * time.Hour)})
	if query.After != nil {
		pageWhere += fmt.Sprintf(" AND (COALESCE(o.starts_at, o.start_date::timestamp AT TIME ZONE o.timezone), o.id) > ($%d, $%d)", len(pageArguments)+1, len(pageArguments)+2)
		pageArguments = append(pageArguments, query.After.SortAt, query.After.OccurrenceID)
	}
	pageArguments = append(pageArguments, query.Limit+1)
	rows, err := tx.Query(ctx, publicEventSelect("$4", "$5")+feedFrom+pageWhere+fmt.Sprintf(`
		ORDER BY sort_at, o.id
		LIMIT $%d`, len(pageArguments)), pageArguments...)
	if err != nil {
		return events.FeedPage{}, fmt.Errorf("list events: %w", err)
	}
	defer rows.Close()
	items := make([]events.PublicOccurrence, 0, query.Limit+1)
	for rows.Next() {
		occurrence, err := scanPublicOccurrence(rows)
		if err != nil {
			return events.FeedPage{}, err
		}
		items = append(items, occurrence)
	}
	if err := rows.Err(); err != nil {
		return events.FeedPage{}, fmt.Errorf("read events: %w", err)
	}
	if len(items) > query.Limit {
		last := items[query.Limit-1]
		page.Next = &events.CursorBoundary{SortAt: last.SortAt, OccurrenceID: last.ID}
		items = items[:query.Limit]
	}
	page.Items = items
	if err := tx.Commit(ctx); err != nil {
		return events.FeedPage{}, fmt.Errorf("commit feed read: %w", err)
	}
	return page, nil
}

func (repository *Events) Get(ctx context.Context, occurrenceID uuid.UUID, freshnessTime, newSince time.Time) (events.PublicOccurrence, error) {
	row := repository.pool.QueryRow(ctx, `
		WITH requested AS (
			SELECT id, merged_into_occurrence_id FROM event_occurrences WHERE id = $1
		)
		`+publicEventSelect("$2", "$3")+feedFrom+`
		JOIN requested ON o.id = COALESCE(requested.merged_into_occurrence_id, requested.id)
		WHERE o.merged_into_occurrence_id IS NULL
		  AND c.enabled
		  AND s.enabled
		  AND s.publication_state <> 'disabled'`, occurrenceID, freshnessTime, newSince)
	occurrence, err := scanPublicOccurrence(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return events.PublicOccurrence{}, events.ErrNotFound
		}
		return events.PublicOccurrence{}, err
	}
	return occurrence, nil
}

func (repository *Events) ListChanges(ctx context.Context, occurrenceID uuid.UUID) ([]events.PublicChange, error) {
	rows, err := repository.pool.Query(ctx, `
		WITH canonical AS (
			SELECT resolved.id
			FROM event_occurrences requested
			JOIN event_occurrences resolved
			  ON resolved.id = COALESCE(requested.merged_into_occurrence_id, requested.id)
			JOIN events event ON event.id = resolved.event_id
			JOIN cities city ON city.id = event.city_id
			JOIN sources source ON source.id = resolved.source_id
			WHERE requested.id = $1
			  AND resolved.merged_into_occurrence_id IS NULL
			  AND city.enabled
			  AND source.enabled
			  AND source.publication_state <> 'disabled'
		)
		SELECT change.id, change.kind, change.changed_fields, change.created_at
		FROM canonical
		LEFT JOIN LATERAL (
			SELECT id, kind, changed_fields, created_at
			FROM event_changes
			WHERE occurrence_id = canonical.id
			ORDER BY created_at DESC, id DESC
			LIMIT 50
		) change ON true
		ORDER BY change.created_at DESC, change.id DESC`, occurrenceID)
	if err != nil {
		return nil, fmt.Errorf("list event changes: %w", err)
	}
	defer rows.Close()
	changes := make([]events.PublicChange, 0)
	found := false
	for rows.Next() {
		found = true
		var change events.PublicChange
		var changeID *uuid.UUID
		var kind *string
		var changedAt *time.Time
		var internalFields []string
		if err := rows.Scan(&changeID, &kind, &internalFields, &changedAt); err != nil {
			return nil, fmt.Errorf("scan event change: %w", err)
		}
		if changeID == nil {
			continue
		}
		change.ID = *changeID
		change.Kind = *kind
		change.ChangedAt = *changedAt
		change.ChangedFields = publicChangedFields(internalFields)
		changes = append(changes, change)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read event changes: %w", err)
	}
	if !found {
		return nil, events.ErrNotFound
	}
	return changes, nil
}

func (repository *Events) SourceSummary(ctx context.Context, sourceSlug string, freshnessTime time.Time) (events.SourceSummary, error) {
	var summary events.SourceSummary
	err := repository.pool.QueryRow(ctx, `
		SELECT s.id, s.slug, s.display_name, s.official_url, s.canonical_host,
			CASE WHEN s.last_healthy_at IS NOT NULL
				AND s.last_healthy_at + make_interval(secs => s.freshness_ttl_seconds) >= $2
				THEN 'fresh' ELSE 'stale' END,
			s.last_healthy_at,
			c.id, c.slug, c.display_name, c.timezone, c.accent
		FROM sources s
		JOIN cities c ON c.id = s.city_id
		WHERE s.slug = $1 AND s.enabled AND c.enabled
		  AND s.publication_state <> 'disabled'`, sourceSlug, freshnessTime).Scan(
		&summary.Source.ID,
		&summary.Source.Slug,
		&summary.Source.Name,
		&summary.Source.OfficialURL,
		&summary.Source.CanonicalHost,
		&summary.Source.Freshness,
		&summary.Source.LastHealthyAt,
		&summary.City.ID,
		&summary.City.Slug,
		&summary.City.Name,
		&summary.City.Timezone,
		&summary.City.Accent,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return events.SourceSummary{}, events.ErrNotFound
		}
		return events.SourceSummary{}, fmt.Errorf("get source summary: %w", err)
	}
	return summary, nil
}

func publicEventSelect(freshnessArgument, newSinceArgument string) string {
	return `
	SELECT
		o.id, e.slug,
		c.id, c.slug, c.display_name, c.timezone, c.accent,
		s.id, s.slug, s.display_name, s.official_url, s.canonical_host,
		CASE WHEN s.last_healthy_at IS NOT NULL
			AND s.last_healthy_at + make_interval(secs => s.freshness_ttl_seconds) >= ` + freshnessArgument + `
			THEN 'fresh' ELSE 'stale' END AS freshness,
		s.last_healthy_at,
		ev.title, ev.category, ev.source_url, ev.start_date, ev.end_date, ev.starts_at, ev.ends_at,
		ev.time_precision, ev.timezone, ev.venue_name, ev.venue_address, ev.is_free,
		ev.price_min_minor, ev.price_max_minor, ev.currency, ev.registration_url,
		ev.registration_state, ev.status, ev.languages, ev.age_note, ev.accessibility_note,
		ev.image_url, ev.observed_at, o.last_observed_at,
		CASE
			WHEN EXISTS (
				SELECT 1 FROM event_changes change
				WHERE change.occurrence_id = o.id AND change.created_at >= ` + newSinceArgument + `
			) THEN 'updated'
			WHEN o.first_observed_at >= ` + newSinceArgument + ` THEN 'new'
			ELSE NULL
		END AS change_kind,
		o.first_observed_at,
		COALESCE(o.starts_at, o.start_date::timestamp AT TIME ZONE o.timezone) AS sort_at`
}

const feedFrom = `
	FROM event_occurrences o
	JOIN events e ON e.id = o.event_id
	JOIN cities c ON c.id = e.city_id
	JOIN sources s ON s.id = o.source_id
	JOIN event_versions ev ON ev.id = o.current_version_id`

func feedWhere(query events.FeedQuery, arguments []any) (string, []any) {
	where := `
		WHERE c.slug = $1
		  AND c.enabled
		  AND s.enabled
		  AND s.publication_state <> 'disabled'
		  AND o.visible
		  AND o.merged_into_occurrence_id IS NULL
		  AND o.first_observed_at <= $4
		  AND ev.status <> 'cancelled'
		  AND COALESCE(o.starts_at, o.start_date::timestamp AT TIME ZONE o.timezone) < $3
		  AND ` + occurrenceEndSQL + ` > $2
		  AND ` + occurrenceEndSQL + ` > $4`
	if len(query.Categories) > 0 {
		categories := make([]string, len(query.Categories))
		for index, category := range query.Categories {
			categories[index] = string(category)
		}
		where += fmt.Sprintf(" AND ev.category = ANY($%d)", len(arguments)+1)
		arguments = append(arguments, categories)
	}
	if query.ExplicitFree {
		where += " AND ev.is_free = true"
	}
	return where, arguments
}

const occurrenceEndSQL = `CASE
	WHEN o.ends_at IS NOT NULL THEN o.ends_at
	WHEN o.time_precision = 'date' OR o.end_date IS NOT NULL
		THEN (COALESCE(o.end_date, o.start_date) + 1)::timestamp AT TIME ZONE o.timezone
	ELSE o.starts_at + interval '1 microsecond'
END`

type occurrenceScanner interface {
	Scan(...any) error
}

func scanPublicOccurrence(scanner occurrenceScanner) (events.PublicOccurrence, error) {
	var occurrence events.PublicOccurrence
	var category string
	var precision string
	var status string
	var priceMin *int64
	var priceMax *int64
	var currency *string
	var registrationState *string
	err := scanner.Scan(
		&occurrence.ID,
		&occurrence.Slug,
		&occurrence.City.ID,
		&occurrence.City.Slug,
		&occurrence.City.Name,
		&occurrence.City.Timezone,
		&occurrence.City.Accent,
		&occurrence.Source.ID,
		&occurrence.Source.Slug,
		&occurrence.Source.Name,
		&occurrence.Source.OfficialURL,
		&occurrence.Source.CanonicalHost,
		&occurrence.Source.Freshness,
		&occurrence.Source.LastHealthyAt,
		&occurrence.Version.Title,
		&category,
		&occurrence.Version.SourceURL,
		&occurrence.Version.StartDate,
		&occurrence.Version.EndDate,
		&occurrence.Version.StartsAt,
		&occurrence.Version.EndsAt,
		&precision,
		&occurrence.Version.Timezone,
		&occurrence.Version.VenueName,
		&occurrence.Version.VenueAddress,
		&occurrence.Version.IsFree,
		&priceMin,
		&priceMax,
		&currency,
		&occurrence.Version.RegistrationURL,
		&registrationState,
		&status,
		&occurrence.Version.Languages,
		&occurrence.Version.AgeNote,
		&occurrence.Version.AccessibilityNote,
		&occurrence.Version.ImageURL,
		&occurrence.Version.ObservedAt,
		&occurrence.LastCheckedAt,
		&occurrence.ChangeKind,
		&occurrence.FirstObservedAt,
		&occurrence.SortAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return events.PublicOccurrence{}, events.ErrNotFound
		}
		return events.PublicOccurrence{}, fmt.Errorf("scan event occurrence: %w", err)
	}
	occurrence.Version.Category = events.Category(category)
	occurrence.Version.TimePrecision = events.TimePrecision(precision)
	occurrence.Version.Status = events.Status(status)
	if priceMin != nil {
		occurrence.Version.Price = &events.Money{MinMinor: *priceMin, MaxMinor: priceMax, Currency: stringValue(currency)}
	}
	if registrationState != nil {
		state := events.RegistrationState(*registrationState)
		occurrence.Version.RegistrationState = &state
	}
	location, err := time.LoadLocation(occurrence.Version.Timezone)
	if err != nil {
		return events.PublicOccurrence{}, fmt.Errorf("load stored event timezone: %w", err)
	}
	occurrence.Version.StartDate = dateInLocation(occurrence.Version.StartDate, location)
	if occurrence.Version.EndDate != nil {
		endDate := dateInLocation(*occurrence.Version.EndDate, location)
		occurrence.Version.EndDate = &endDate
	}
	return occurrence, nil
}

func publicChangedFields(internal []string) []string {
	present := make(map[string]bool, 5)
	for _, field := range internal {
		switch field {
		case "start", "end":
			present["timing"] = true
		case "venue":
			present["venue"] = true
		case "price", "free_state":
			present["pricing"] = true
		case "registration_url", "registration_state":
			present["registration"] = true
		case "status":
			present["status"] = true
		}
	}
	ordered := []string{"timing", "venue", "pricing", "registration", "status"}
	result := make([]string, 0, len(present))
	for _, field := range ordered {
		if present[field] {
			result = append(result, field)
		}
	}
	return result
}

func dateInLocation(value time.Time, location *time.Location) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, location)
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
