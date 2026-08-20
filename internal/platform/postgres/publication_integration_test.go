package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/events"
	"github.com/siiddhantt/baahar/internal/sources"
)

func TestPublicationVersionTransitionsAndRejectedRunFreeze(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	publication := NewPublication(pool)
	repository := NewEvents(pool)
	observed := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)

	stateA := integrationCandidate(t, source, "100", "A", observed)
	runA := validatingRun(t, ctx, pool, source.ID, 1, observed)
	if err := publication.Publish(ctx, runA, source, healthyDataset(stateA, false), observed.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	occurrenceID, versionA, lastObserved := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if !lastObserved.Equal(observed) {
		t.Fatalf("last observation = %s, want %s", lastObserved, observed)
	}
	assertOccurrenceCounts(t, ctx, pool, occurrenceID, 1, 0)

	unchangedAt := observed.Add(time.Hour)
	unchanged := integrationCandidate(t, source, "100", "A", unchangedAt)
	runUnchanged := validatingRun(t, ctx, pool, source.ID, 1, unchangedAt)
	if err := publication.Publish(ctx, runUnchanged, source, healthyDataset(unchanged, false), unchangedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	_, current, lastObserved := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if current != versionA || !lastObserved.Equal(unchangedAt) {
		t.Fatalf("unchanged publish current=%s last=%s, want %s/%s", current, lastObserved, versionA, unchangedAt)
	}
	assertOccurrenceCounts(t, ctx, pool, occurrenceID, 1, 0)
	public, err := repository.Get(ctx, occurrenceID, unchangedAt, observed.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if !public.LastCheckedAt.Equal(unchangedAt) {
		t.Fatalf("public last_checked_at = %s, want %s", public.LastCheckedAt, unchangedAt)
	}

	stateB := integrationCandidate(t, source, "100", "B", observed.Add(2*time.Hour))
	runB := validatingRun(t, ctx, pool, source.ID, 1, observed.Add(2*time.Hour))
	if err := publication.Publish(ctx, runB, source, healthyDataset(stateB, false), observed.Add(2*time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	_, versionB, _ := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if versionB == versionA {
		t.Fatal("material state B did not create a new version")
	}
	assertOccurrenceCounts(t, ctx, pool, occurrenceID, 2, 1)

	revertedAt := observed.Add(3 * time.Hour)
	reverted := integrationCandidate(t, source, "100", "A", revertedAt)
	runReverted := validatingRun(t, ctx, pool, source.ID, 1, revertedAt)
	if err := publication.Publish(ctx, runReverted, source, healthyDataset(reverted, false), revertedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	_, current, lastObserved = occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if current != versionA || !lastObserved.Equal(revertedAt) {
		t.Fatalf("reverted publish current=%s last=%s, want prior A=%s/%s", current, lastObserved, versionA, revertedAt)
	}
	assertOccurrenceCounts(t, ctx, pool, occurrenceID, 2, 2)

	rejectedAt := observed.Add(4 * time.Hour)
	rejectedRun := validatingRun(t, ctx, pool, source.ID, 0, rejectedAt)
	bad := collections.PreparedDataset{HealthCode: "empty_output"}
	if err := publication.Reject(ctx, rejectedRun, source.ID, 0, bad, rejectedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	_, current, _ = occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if current != versionA {
		t.Fatalf("rejected run moved current pointer to %s, want %s", current, versionA)
	}
	var publicationState string
	if err := pool.QueryRow(ctx, `SELECT publication_state FROM sources WHERE id = $1`, source.ID).Scan(&publicationState); err != nil {
		t.Fatal(err)
	}
	if publicationState != "frozen" {
		t.Fatalf("source state = %q, want frozen", publicationState)
	}
	if _, err := repository.Get(ctx, occurrenceID, rejectedAt, observed); err != nil {
		t.Fatalf("frozen source must preserve verified public data: %v", err)
	}
}

func TestRunTriggerIntentIsDurableBeforeExternalCollectionAttachment(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	runID := uuid.Must(uuid.NewV7())
	if _, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at)
		VALUES ($1, $2, $3, 'queued', now())`, runID, source.ID, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	runs := NewRuns(pool)
	if err := runs.BeginTrigger(ctx, runID); err != nil {
		t.Fatal(err)
	}
	triggering, err := runs.Find(ctx, runID)
	if err != nil {
		t.Fatal(err)
	}
	if triggering.Status != collections.RunTriggering || triggering.ExternalCollectionID != nil {
		t.Fatalf("durable pre-trigger state = %+v", triggering)
	}
	if err := runs.BeginTrigger(ctx, runID); err == nil {
		t.Fatal("a second trigger intent was accepted")
	}
	if err := runs.AttachCollection(ctx, runID, "d_reviewed_collection"); err != nil {
		t.Fatal(err)
	}
	collecting, err := runs.Find(ctx, runID)
	if err != nil {
		t.Fatal(err)
	}
	if collecting.Status != collections.RunCollecting || collecting.ExternalCollectionID == nil || *collecting.ExternalCollectionID != "d_reviewed_collection" {
		t.Fatalf("reconciled collection state = %+v", collecting)
	}
}

func TestReviewedAliasRoutesIDLessCorrectionToExistingOccurrence(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source, err := NewSourceConfigs(pool).Get(ctx, uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"))
	if err != nil {
		t.Fatal(err)
	}
	publication := NewPublication(pool)
	base := time.Date(2026, time.August, 19, 10, 0, 0, 0, time.UTC)
	before := fallbackIntegrationCandidate(t, source, "Original title", 18, base)
	firstRun := validatingRun(t, ctx, pool, source.ID, 1, base)
	if err := publication.Publish(ctx, firstRun, source, healthyDataset(before, false), base.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	occurrenceID, _, _ := occurrenceState(t, ctx, pool, source.ID, before.Identity)
	after := fallbackIntegrationCandidate(t, source, "Corrected title", 19, base.Add(time.Hour))
	operator := NewOperator(pool)
	reason := "Official source corrected the title and performance time."
	alias, err := operator.CreateSourceAlias(ctx, source.ID, after.Identity, occurrenceID, reason, "alias-review-key-0001", "test", uuid.NewString(), base.Add(30*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	reconciled, err := operator.CreateSourceAlias(ctx, source.ID, after.Identity, occurrenceID, reason, "alias-review-key-0001", "test", uuid.NewString(), base.Add(31*time.Minute))
	if err != nil || reconciled.SourceID != alias.SourceID || reconciled.IncomingIdentity != alias.IncomingIdentity ||
		reconciled.OccurrenceID != alias.OccurrenceID || reconciled.Reason != alias.Reason || !reconciled.CreatedAt.Equal(alias.CreatedAt) {
		t.Fatalf("idempotent alias = %+v, %v; want %+v", reconciled, err, alias)
	}
	if _, err := operator.CreateSourceAlias(ctx, source.ID, after.Identity, occurrenceID, "Different reason", "alias-review-key-0001", "test", uuid.NewString(), base.Add(32*time.Minute)); !errors.Is(err, sources.ErrConflict) {
		t.Fatalf("idempotency conflict error = %v", err)
	}
	if _, err := operator.CreateSourceAlias(
		ctx, source.ID,
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f7799"), reason, "alias-review-key-0002", "test", uuid.NewString(), base.Add(33*time.Minute),
	); !errors.Is(err, sources.ErrNotFound) {
		t.Fatalf("cross-source alias ownership error = %v", err)
	}
	secondRun := validatingRun(t, ctx, pool, source.ID, 1, base.Add(time.Hour))
	if err := publication.Publish(ctx, secondRun, source, healthyDataset(after, false), base.Add(time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	var occurrences int
	var currentTitle string
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*), max(version.title)
		FROM event_occurrences occurrence
		JOIN event_versions version ON version.id = occurrence.current_version_id
		WHERE occurrence.source_id = $1`, source.ID).Scan(&occurrences, &currentTitle); err != nil {
		t.Fatal(err)
	}
	if occurrences != 1 || currentTitle != "Corrected title" {
		t.Fatalf("alias publication occurrences/title = %d/%q", occurrences, currentTitle)
	}
	assertOccurrenceCounts(t, ctx, pool, occurrenceID, 2, 1)
}

func TestAliasTargetMergeRoutesExistingAliasesToCanonicalOccurrence(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source, err := NewSourceConfigs(pool).Get(ctx, uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"))
	if err != nil {
		t.Fatal(err)
	}
	publication := NewPublication(pool)
	repository := NewEvents(pool)
	operator := NewOperator(pool)
	base := time.Date(2026, time.August, 19, 9, 0, 0, 0, time.UTC)
	stateA := fallbackIntegrationCandidate(t, source, "Occurrence A", 16, base)
	canonicalC := fallbackIntegrationCandidate(t, source, "Canonical C", 18, base)
	initialRun := validatingRun(t, ctx, pool, source.ID, 2, base)
	if err := publication.Publish(ctx, initialRun, source, healthyDatasetWithTracking(false, stateA, canonicalC), base.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	occurrenceA, _, observedA := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	occurrenceC, _, _ := occurrenceState(t, ctx, pool, source.ID, canonicalC.Identity)

	aliasB := fallbackIntegrationCandidate(t, source, "Incoming alias B", 17, base.Add(time.Hour))
	if _, err := operator.CreateSourceAlias(ctx, source.ID, aliasB.Identity, occurrenceA,
		"Reviewed B as the same performance as A.", "alias-chain-key-0001", "test", uuid.NewString(), base.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	merge, err := operator.CreateSourceAlias(ctx, source.ID, stateA.Identity, occurrenceC,
		"Reviewed A as the same performance as canonical C.", "alias-chain-key-0002", "test", uuid.NewString(), base.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if merge.MergedOccurrenceID == nil || *merge.MergedOccurrenceID != occurrenceA {
		t.Fatalf("A merge result = %+v, want merged occurrence %s", merge, occurrenceA)
	}

	futureB := changedFallbackCandidate(t, aliasB, "future B facts", base.Add(3*time.Hour))
	futureRun := validatingRun(t, ctx, pool, source.ID, 1, base.Add(3*time.Hour))
	if err := publication.Publish(ctx, futureRun, source, healthyDataset(futureB, false), base.Add(3*time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertOccurrenceCounts(t, ctx, pool, occurrenceA, 1, 0)
	assertOccurrenceCounts(t, ctx, pool, occurrenceC, 2, 1)
	var mergedInto *uuid.UUID
	var visible bool
	var lastObserved time.Time
	if err := pool.QueryRow(ctx, `
		SELECT merged_into_occurrence_id, visible, last_observed_at
		FROM event_occurrences WHERE id = $1`, occurrenceA).Scan(&mergedInto, &visible, &lastObserved); err != nil {
		t.Fatal(err)
	}
	if mergedInto == nil || *mergedInto != occurrenceC || visible || !lastObserved.Equal(observedA) {
		t.Fatalf("hidden A changed after B publication: target=%v visible=%v observed=%s, want %s/false/%s",
			mergedInto, visible, lastObserved, occurrenceC, observedA)
	}
	var occurrenceCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_occurrences WHERE source_id = $1`, source.ID).Scan(&occurrenceCount); err != nil {
		t.Fatal(err)
	}
	if occurrenceCount != 2 {
		t.Fatalf("B publication created a third occurrence: count = %d", occurrenceCount)
	}
	oldLink, err := repository.Get(ctx, occurrenceA, base.Add(4*time.Hour), base.Add(-time.Hour))
	if err != nil || oldLink.ID != occurrenceC || oldLink.Version.Title != futureB.Version.Title {
		t.Fatalf("old A link = %s/%q, %v; want canonical %s/%q", oldLink.ID, oldLink.Version.Title, err, occurrenceC, futureB.Version.Title)
	}
	changes, err := repository.ListChanges(ctx, occurrenceA)
	if err != nil || len(changes) != 1 {
		t.Fatalf("old A change link resolved %d canonical changes, error = %v", len(changes), err)
	}
	var observedOccurrence uuid.UUID
	if err := pool.QueryRow(ctx, `
		SELECT occurrence_id FROM source_observations WHERE collection_run_id = $1`, futureRun).Scan(&observedOccurrence); err != nil {
		t.Fatal(err)
	}
	if observedOccurrence != occurrenceC {
		t.Fatalf("future B observation wrote to %s, want canonical %s", observedOccurrence, occurrenceC)
	}
	page, err := repository.List(ctx, events.FeedQuery{
		CitySlug: "bengaluru", Window: events.WindowUpcoming, AsOf: base.Add(4 * time.Hour), Limit: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != occurrenceC {
		t.Fatalf("alias-chain feed = %+v, want only canonical %s", page.Items, occurrenceC)
	}
}

func TestReviewedAliasMergesPublishedDuplicateWithoutLosingHistory(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source, err := NewSourceConfigs(pool).Get(ctx, uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"))
	if err != nil {
		t.Fatal(err)
	}
	publication := NewPublication(pool)
	repository := NewEvents(pool)
	base := time.Date(2026, time.August, 19, 10, 0, 0, 0, time.UTC)
	target := fallbackIntegrationCandidate(t, source, "Original title", 18, base)
	duplicate := fallbackIntegrationCandidate(t, source, "Corrected title", 19, base)
	firstRun := validatingRun(t, ctx, pool, source.ID, 2, base)
	if err := publication.Publish(ctx, firstRun, source, healthyDatasetWithTracking(false, target, duplicate), base.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	targetID, _, _ := occurrenceState(t, ctx, pool, source.ID, target.Identity)
	duplicateID, _, _ := occurrenceState(t, ctx, pool, source.ID, duplicate.Identity)

	targetChanged := changedFallbackCandidate(t, target, "target details reviewed", base.Add(time.Hour))
	duplicateChanged := changedFallbackCandidate(t, duplicate, "duplicate details reviewed", base.Add(time.Hour))
	secondRun := validatingRun(t, ctx, pool, source.ID, 2, base.Add(time.Hour))
	if err := publication.Publish(ctx, secondRun, source, healthyDatasetWithTracking(false, targetChanged, duplicateChanged), base.Add(time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertOccurrenceCounts(t, ctx, pool, targetID, 2, 1)
	assertOccurrenceCounts(t, ctx, pool, duplicateID, 2, 1)

	operator := NewOperator(pool)
	reason := "Reviewed correction: both records are the same official performance."
	alias, err := operator.CreateSourceAlias(ctx, source.ID, duplicate.Identity, targetID, reason,
		"published-merge-key-0001", "test", uuid.NewString(), base.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if alias.MergedOccurrenceID == nil || *alias.MergedOccurrenceID != duplicateID {
		t.Fatalf("merged occurrence = %v, want %s", alias.MergedOccurrenceID, duplicateID)
	}
	replayed, err := operator.CreateSourceAlias(ctx, source.ID, duplicate.Identity, targetID, reason,
		"published-merge-key-0001", "test", uuid.NewString(), base.Add(2*time.Hour+time.Minute))
	if err != nil || replayed.MergedOccurrenceID == nil || *replayed.MergedOccurrenceID != duplicateID || !replayed.CreatedAt.Equal(alias.CreatedAt) {
		t.Fatalf("idempotent published merge = %+v, %v; want %+v", replayed, err, alias)
	}
	var mergedInto *uuid.UUID
	var duplicateVisible bool
	if err := pool.QueryRow(ctx, `
		SELECT merged_into_occurrence_id, visible FROM event_occurrences WHERE id = $1`, duplicateID).Scan(&mergedInto, &duplicateVisible); err != nil {
		t.Fatal(err)
	}
	if mergedInto == nil || *mergedInto != targetID || duplicateVisible {
		t.Fatalf("duplicate merge state = target %v visible %v", mergedInto, duplicateVisible)
	}
	assertOccurrenceCounts(t, ctx, pool, targetID, 2, 1)
	assertOccurrenceCounts(t, ctx, pool, duplicateID, 2, 1)

	oldLink, err := repository.Get(ctx, duplicateID, base.Add(2*time.Hour), base.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if oldLink.ID != targetID || oldLink.Version.Title != targetChanged.Version.Title {
		t.Fatalf("old duplicate link resolved to %s/%q, want %s/%q", oldLink.ID, oldLink.Version.Title, targetID, targetChanged.Version.Title)
	}
	changes, err := repository.ListChanges(ctx, duplicateID)
	if err != nil || len(changes) != 1 {
		t.Fatalf("old duplicate change history resolves to canonical changes: %d, %v", len(changes), err)
	}
	page, err := repository.List(ctx, events.FeedQuery{
		CitySlug: "bengaluru", Window: events.WindowUpcoming, AsOf: base.Add(2 * time.Hour), Limit: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != targetID {
		t.Fatalf("public feed after merge = %+v, want only %s", page.Items, targetID)
	}

	incoming := changedFallbackCandidate(t, duplicateChanged, "future corrected facts", base.Add(3*time.Hour))
	thirdRun := validatingRun(t, ctx, pool, source.ID, 1, base.Add(3*time.Hour))
	if err := publication.Publish(ctx, thirdRun, source, healthyDataset(incoming, false), base.Add(3*time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertOccurrenceCounts(t, ctx, pool, targetID, 3, 2)
	assertOccurrenceCounts(t, ctx, pool, duplicateID, 2, 1)

	if _, err := operator.CreateSourceAlias(ctx, source.ID, target.Identity, targetID, "Self merge must fail.",
		"published-merge-key-0002", "test", uuid.NewString(), base.Add(4*time.Hour)); !errors.Is(err, sources.ErrConflict) {
		t.Fatalf("self merge error = %v", err)
	}
	if _, err := operator.CreateSourceAlias(ctx, source.ID, target.Identity, duplicateID, "Cycle must fail.",
		"published-merge-key-0003", "test", uuid.NewString(), base.Add(4*time.Hour)); !errors.Is(err, sources.ErrConflict) {
		t.Fatalf("cycle merge error = %v", err)
	}
	bic := integrationSource(t, ctx, pool)
	bicCandidate := integrationCandidate(t, bic, "cross-source", "A", base.Add(4*time.Hour))
	bicRun := validatingRun(t, ctx, pool, bic.ID, 1, base.Add(4*time.Hour))
	if err := publication.Publish(ctx, bicRun, bic, healthyDataset(bicCandidate, false), base.Add(4*time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	bicOccurrenceID, _, _ := occurrenceState(t, ctx, pool, bic.ID, bicCandidate.Identity)
	if _, err := operator.CreateSourceAlias(ctx, source.ID,
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", bicOccurrenceID,
		"Cross-source merge must fail.", "published-merge-key-0004", "test", uuid.NewString(), base.Add(5*time.Hour)); !errors.Is(err, sources.ErrNotFound) {
		t.Fatalf("cross-source merge error = %v", err)
	}
	rollbackTarget := fallbackIntegrationCandidate(t, source, "Rollback target", 14, base.Add(5*time.Hour))
	rollbackDuplicate := fallbackIntegrationCandidate(t, source, "Rollback duplicate", 15, base.Add(5*time.Hour))
	rollbackRun := validatingRun(t, ctx, pool, source.ID, 2, base.Add(5*time.Hour))
	if err := publication.Publish(ctx, rollbackRun, source, healthyDatasetWithTracking(false, rollbackTarget, rollbackDuplicate), base.Add(5*time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	rollbackTargetID, _, _ := occurrenceState(t, ctx, pool, source.ID, rollbackTarget.Identity)
	rollbackDuplicateID, _, _ := occurrenceState(t, ctx, pool, source.ID, rollbackDuplicate.Identity)
	if _, err := pool.Exec(ctx, `
		CREATE FUNCTION reject_alias_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.action = 'create_source_alias' THEN
				RAISE EXCEPTION 'test audit failure';
			END IF;
			RETURN NEW;
		END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		CREATE TRIGGER reject_alias_audit
		BEFORE INSERT ON operator_audit_log
		FOR EACH ROW EXECUTE FUNCTION reject_alias_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := operator.CreateSourceAlias(ctx, source.ID, rollbackDuplicate.Identity, rollbackTargetID,
		"Audit failure must roll back merge.", "published-merge-key-0005", "test", uuid.NewString(), base.Add(6*time.Hour)); err == nil {
		t.Fatal("alias merge unexpectedly committed after audit failure")
	}
	var rollbackMergedInto *uuid.UUID
	var rollbackVisible bool
	if err := pool.QueryRow(ctx, `
		SELECT merged_into_occurrence_id, visible FROM event_occurrences WHERE id = $1`, rollbackDuplicateID).Scan(&rollbackMergedInto, &rollbackVisible); err != nil {
		t.Fatal(err)
	}
	if rollbackMergedInto != nil || !rollbackVisible {
		t.Fatalf("failed alias did not roll back duplicate state: target=%v visible=%v", rollbackMergedInto, rollbackVisible)
	}
	var aliasCount, mergedCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM source_aliases WHERE source_id = $1`, source.ID).Scan(&aliasCount); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_occurrences WHERE source_id = $1 AND merged_into_occurrence_id IS NOT NULL`, source.ID).Scan(&mergedCount); err != nil {
		t.Fatal(err)
	}
	if aliasCount != 1 || mergedCount != 1 {
		t.Fatalf("failed merge mutated state: aliases/merged = %d/%d, want 1/1", aliasCount, mergedCount)
	}
}

func TestJagritiMultiPerformanceNormalizationAndPersistence(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source, err := NewSourceConfigs(pool).Get(ctx, uuid.MustParse("de7c8acb-0185-5994-b1b4-290029c3ed5f"))
	if err != nil {
		t.Fatal(err)
	}
	if source.SourceEventIDPattern != nil {
		t.Fatalf("Jagriti source event ID pattern = %q, want NULL fallback policy", *source.SourceEventIDPattern)
	}
	observed := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)
	record := map[string]any{
		"schema_version":     "event-occurrence/v1",
		"source_event_id":    nil,
		"source_url":         "https://www.jagrititheatre.com/12-angry-men",
		"source_host":        "www.jagrititheatre.com",
		"city_slug":          "bengaluru",
		"title":              "12 Angry Men",
		"category":           "theatre",
		"start_date":         "2026-08-22",
		"starts_at":          "2026-08-22T15:00:00+05:30",
		"end_date":           "2026-08-22",
		"ends_at":            "2026-08-22T17:00:00+05:30",
		"time_precision":     "timed",
		"timezone":           "Asia/Kolkata",
		"venue_name":         "Jagriti Theatre",
		"venue_address":      "Jagriti, Ramagondanahalli, Varthur Road, Whitefield, Bengaluru 560066, India",
		"is_free":            false,
		"price_min_minor":    75000,
		"price_max_minor":    75000,
		"currency":           "INR",
		"registration_url":   "https://in.bookmyshow.com/plays/12-angry-men/ET00400001",
		"registration_state": nil,
		"status":             "scheduled",
		"language":           []string{"English"},
		"age_note":           "12+ years",
		"accessibility_note": nil,
		"image_url":          "https://www.jagrititheatre.com/uploads/images/thumbnails/0123456789abcdef0123456789abcdef.jpg",
		"observed_at":        observed.Format(time.RFC3339),
	}
	second := make(map[string]any, len(record))
	for key, value := range record {
		second[key] = value
	}
	second["starts_at"] = "2026-08-22T19:00:00+05:30"
	second["ends_at"] = "2026-08-22T21:00:00+05:30"
	dataset, err := json.Marshal([]map[string]any{record, second})
	if err != nil {
		t.Fatal(err)
	}
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	prepared, err := collections.PrepareDataset(dataset, collections.SourcePolicy{
		ID:                        source.ID,
		CitySlug:                  source.CitySlug,
		CanonicalHost:             source.CanonicalHost,
		SchemaVersion:             source.SchemaVersion,
		RecordLimit:               source.RecordLimit,
		MinimumRecords:            source.MinimumRecords,
		MaximumQuarantineRatioBPS: source.MaximumQuarantineRatioBPS,
		MaximumDuplicateRatioBPS:  source.MaximumDuplicateRatioBPS,
		LowCountRatioBPS:          source.LowCountRatioBPS,
		HighCountRatioBPS:         source.HighCountRatioBPS,
		RegistrationHosts:         source.RegistrationHosts,
		ImageHosts:                source.ImageHosts,
		ObservationEarliest:       observed.Add(-time.Minute),
		ObservationLatest:         observed.Add(time.Minute),
	}, validator)
	if err != nil {
		t.Fatal(err)
	}
	if prepared.HealthCode != "" || len(prepared.Candidates) != 2 || len(prepared.Quarantined) != 0 ||
		prepared.Candidates[0].Identity == prepared.Candidates[1].Identity {
		t.Fatalf("Jagriti preparation = %+v", prepared)
	}
	runID := validatingRun(t, ctx, pool, source.ID, 2, observed)
	if err := NewPublication(pool).Publish(ctx, runID, source, prepared, observed.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}

	rows, err := pool.Query(ctx, `
		SELECT version.starts_at, version.price_min_minor, version.price_max_minor,
			version.currency, version.registration_url, version.languages,
			version.age_note, version.image_url
		FROM event_occurrences occurrence
		JOIN event_versions version ON version.id = occurrence.current_version_id
		WHERE occurrence.source_id = $1
		ORDER BY version.starts_at`, source.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	starts := make([]time.Time, 0, 2)
	for rows.Next() {
		var startsAt time.Time
		var minimum, maximum int64
		var currency, registrationURL, ageNote, imageURL string
		var languages []string
		if err := rows.Scan(&startsAt, &minimum, &maximum, &currency, &registrationURL, &languages, &ageNote, &imageURL); err != nil {
			t.Fatal(err)
		}
		if minimum != 75000 || maximum != 75000 || currency != "INR" ||
			registrationURL != "https://in.bookmyshow.com/plays/12-angry-men/ET00400001" ||
			len(languages) != 1 || languages[0] != "English" || ageNote != "12+ years" ||
			imageURL != "https://www.jagrititheatre.com/uploads/images/thumbnails/0123456789abcdef0123456789abcdef.jpg" {
			t.Fatalf("persisted Jagriti facts = price %d/%d %s registration=%q language=%v age=%q image=%q",
				minimum, maximum, currency, registrationURL, languages, ageNote, imageURL)
		}
		starts = append(starts, startsAt)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(starts) != 2 || starts[0].Equal(starts[1]) {
		t.Fatalf("persisted Jagriti starts = %v", starts)
	}
}

func TestPublicationAbsenceBootstrapThresholdAndReappearance(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	publication := NewPublication(pool)
	base := time.Date(2026, time.August, 18, 10, 0, 0, 0, time.UTC)
	target := integrationCandidate(t, source, "200", "A", base)
	control := integrationCandidate(t, source, "201", "A", base)
	initial := validatingRun(t, ctx, pool, source.ID, 2, base)
	if err := publication.Publish(ctx, initial, source, healthyDatasetWithTracking(false, target, control), base.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	targetID, _, _ := occurrenceState(t, ctx, pool, source.ID, target.Identity)

	// The first three complete baselines can refresh present records but cannot
	// remove an absent record while the source's normal count is still unknown.
	for index := 1; index <= 3; index++ {
		at := base.Add(time.Duration(index) * time.Hour)
		present := integrationCandidate(t, source, "201", "A", at)
		runID := validatingRun(t, ctx, pool, source.ID, 1, at)
		if err := publication.Publish(ctx, runID, source, healthyDatasetWithTracking(false, present), at.Add(time.Minute)); err != nil {
			t.Fatal(err)
		}
		assertVisibility(t, ctx, pool, targetID, true, 0)
	}

	firstMissAt := base.Add(4 * time.Hour)
	firstPresent := integrationCandidate(t, source, "201", "A", firstMissAt)
	firstMissRun := validatingRun(t, ctx, pool, source.ID, 1, firstMissAt)
	if err := publication.Publish(ctx, firstMissRun, source, healthyDatasetWithTracking(true, firstPresent), firstMissAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertVisibility(t, ctx, pool, targetID, true, 1)

	// A rejected run never advances absence.
	rejectedAt := base.Add(5 * time.Hour)
	rejectedRun := validatingRun(t, ctx, pool, source.ID, 0, rejectedAt)
	if err := publication.Reject(ctx, rejectedRun, source.ID, 0, collections.PreparedDataset{HealthCode: "empty_output"}, rejectedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertVisibility(t, ctx, pool, targetID, true, 1)

	secondMissAt := base.Add(6 * time.Hour)
	secondPresent := integrationCandidate(t, source, "201", "A", secondMissAt)
	secondMissRun := validatingRun(t, ctx, pool, source.ID, 1, secondMissAt)
	if err := publication.Publish(ctx, secondMissRun, source, healthyDatasetWithTracking(true, secondPresent), secondMissAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertVisibility(t, ctx, pool, targetID, false, 2)

	reappearedAt := base.Add(7 * time.Hour)
	reappeared := integrationCandidate(t, source, "200", "A", reappearedAt)
	control = integrationCandidate(t, source, "201", "A", reappearedAt)
	reappearanceRun := validatingRun(t, ctx, pool, source.ID, 2, reappearedAt)
	if err := publication.Publish(ctx, reappearanceRun, source, healthyDatasetWithTracking(true, reappeared, control), reappearedAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	assertVisibility(t, ctx, pool, targetID, true, 0)
}

func TestDisabledSourceIsAbsentFromPublicReads(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	publication := NewPublication(pool)
	at := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)
	candidate := integrationCandidate(t, source, "300", "A", at)
	runID := validatingRun(t, ctx, pool, source.ID, 1, at)
	if err := publication.Publish(ctx, runID, source, healthyDataset(candidate, false), at.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	occurrenceID, _, _ := occurrenceState(t, ctx, pool, source.ID, candidate.Identity)
	repository := NewEvents(pool)
	if _, err := repository.Get(ctx, occurrenceID, at, at.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE sources SET publication_state = 'disabled' WHERE id = $1`, source.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.Get(ctx, occurrenceID, at, at.Add(-time.Hour)); !errors.Is(err, events.ErrNotFound) {
		t.Fatalf("disabled direct read error = %v, want not found", err)
	}
	if _, err := repository.ListChanges(ctx, occurrenceID); !errors.Is(err, events.ErrNotFound) {
		t.Fatalf("disabled change-history error = %v, want not found", err)
	}
	page, err := repository.List(ctx, events.FeedQuery{
		CitySlug: "bengaluru",
		Window:   events.WindowToday,
		AsOf:     time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC),
		Limit:    20,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 0 || page.ResultCount != 0 {
		t.Fatalf("disabled source leaked into feed: %+v", page)
	}
}

func TestOlderReplayIsValidationOnly(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	publication := NewPublication(pool)
	base := time.Date(2026, time.August, 18, 9, 0, 0, 0, time.UTC)
	stateA := integrationCandidate(t, source, "400", "A", base)
	originalRun := validatingRun(t, ctx, pool, source.ID, 1, base)
	if err := publication.Publish(ctx, originalRun, source, healthyDataset(stateA, false), base.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	targetID, versionA, _ := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)

	newerAt := base.Add(2 * time.Hour)
	stateB := integrationCandidate(t, source, "400", "B", newerAt)
	newerEvent := integrationCandidate(t, source, "401", "A", newerAt)
	newerRun := validatingRun(t, ctx, pool, source.ID, 2, newerAt)
	if err := publication.Publish(ctx, newerRun, source, healthyDatasetWithTracking(true, stateB, newerEvent), newerAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	newerEventID, _, _ := occurrenceState(t, ctx, pool, source.ID, newerEvent.Identity)
	_, versionB, _ := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if versionA == versionB {
		t.Fatal("newer material state did not advance")
	}

	replayAt := newerAt.Add(time.Hour)
	replayRun := validatingReplayRun(t, ctx, pool, source.ID, originalRun, 1, replayAt)
	replayedA := integrationCandidate(t, source, "400", "A", base)
	if err := publication.Publish(ctx, replayRun, source, healthyDataset(replayedA, true), replayAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	_, current, _ := occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if current != versionB {
		t.Fatalf("old replay rolled pointer back to %s, want newer B %s", current, versionB)
	}
	assertVisibility(t, ctx, pool, newerEventID, true, 0)
	assertOccurrenceCounts(t, ctx, pool, targetID, 2, 1)
	var validationOnly bool
	if err := pool.QueryRow(ctx, `SELECT (health_summary->>'validation_only')::boolean FROM collection_runs WHERE id = $1`, replayRun).Scan(&validationOnly); err != nil {
		t.Fatal(err)
	}
	if !validationOnly {
		t.Fatal("old replay was not recorded as validation-only")
	}

	staleRejectedRun := validatingReplayRun(t, ctx, pool, source.ID, originalRun, 0, replayAt.Add(time.Hour))
	if err := publication.Reject(ctx, staleRejectedRun, source.ID, 0, collections.PreparedDataset{HealthCode: "empty_output"}, replayAt.Add(time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	var sourceState string
	if err := pool.QueryRow(ctx, `SELECT publication_state FROM sources WHERE id = $1`, source.ID).Scan(&sourceState); err != nil {
		t.Fatal(err)
	}
	if sourceState != "active" {
		t.Fatalf("stale rejected replay changed source state to %q", sourceState)
	}
	_, current, _ = occurrenceState(t, ctx, pool, source.ID, stateA.Identity)
	if current != versionB {
		t.Fatal("stale rejected replay changed current version")
	}
}

func TestOutOfOrderConcurrentRunCannotRollBackOrRemove(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	publication := NewPublication(pool)
	base := time.Date(2026, time.August, 18, 8, 0, 0, 0, time.UTC)
	older := integrationCandidate(t, source, "500", "A", base)
	olderRun := validatingRun(t, ctx, pool, source.ID, 1, base)
	newerAt := base.Add(time.Hour)
	newer := integrationCandidate(t, source, "500", "B", newerAt)
	newerOnly := integrationCandidate(t, source, "501", "A", newerAt)
	newerRun := validatingRun(t, ctx, pool, source.ID, 2, newerAt)

	if err := publication.Publish(ctx, newerRun, source, healthyDatasetWithTracking(true, newer, newerOnly), newerAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	targetID, versionB, _ := occurrenceState(t, ctx, pool, source.ID, newer.Identity)
	newerOnlyID, _, _ := occurrenceState(t, ctx, pool, source.ID, newerOnly.Identity)
	if err := publication.Publish(ctx, olderRun, source, healthyDataset(older, true), newerAt.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	_, current, lastObserved := occurrenceState(t, ctx, pool, source.ID, newer.Identity)
	if current != versionB || !lastObserved.Equal(newerAt) {
		t.Fatalf("out-of-order publish current/observed = %s/%s, want %s/%s", current, lastObserved, versionB, newerAt)
	}
	assertVisibility(t, ctx, pool, newerOnlyID, true, 0)
	assertOccurrenceCounts(t, ctx, pool, targetID, 1, 0)
}

func TestOlderHealthyRunCannotClearNewerFailure(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	publication := NewPublication(pool)
	base := time.Date(2026, time.August, 18, 7, 0, 0, 0, time.UTC)
	olderRun := validatingRun(t, ctx, pool, source.ID, 1, base)
	newerRun := validatingRun(t, ctx, pool, source.ID, 0, base.Add(time.Hour))
	if err := publication.Reject(ctx, newerRun, source.ID, 0, collections.PreparedDataset{HealthCode: "empty_output"}, base.Add(time.Hour+time.Minute)); err != nil {
		t.Fatal(err)
	}
	olderCandidate := integrationCandidate(t, source, "600", "A", base)
	if err := publication.Publish(ctx, olderRun, source, healthyDataset(olderCandidate, true), base.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	var sourceState string
	var lastHealthy *time.Time
	if err := pool.QueryRow(ctx, `
		SELECT publication_state, last_healthy_at FROM sources WHERE id = $1`, source.ID).Scan(&sourceState, &lastHealthy); err != nil {
		t.Fatal(err)
	}
	if sourceState != "frozen" || lastHealthy != nil {
		t.Fatalf("older healthy run changed frozen health state: state=%q last=%v", sourceState, lastHealthy)
	}
	var occurrenceCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_occurrences WHERE source_id = $1`, source.ID).Scan(&occurrenceCount); err != nil {
		t.Fatal(err)
	}
	if occurrenceCount != 0 {
		t.Fatal("older healthy run published after a newer rejected run")
	}
	var validationOnly bool
	if err := pool.QueryRow(ctx, `SELECT (health_summary->>'validation_only')::boolean FROM collection_runs WHERE id = $1`, olderRun).Scan(&validationOnly); err != nil {
		t.Fatal(err)
	}
	if !validationOnly {
		t.Fatal("older healthy run was not recorded as validation-only")
	}
}

func TestOperatorReplayUsesSharedPayloadAndCompletedArtifact(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	originalRun := uuid.Must(uuid.NewV7())
	at := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)
	_, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (
			id, source_id, trace_id, status, triggered_at, completed_at,
			raw_object_key, raw_sha256, raw_bytes
		) VALUES ($1, $2, $3, 'rejected', $4, $5, $6, $7, 2)`,
		originalRun, source.ID, uuid.NewString(), at, at.Add(time.Minute),
		"sources/bic/original.json", strings.Repeat("a", 64))
	if err != nil {
		t.Fatal(err)
	}
	operator := NewOperator(pool)
	replay, err := operator.QueueReplay(ctx, originalRun, "operator-contract", "test", uuid.NewString(), at.Add(2*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	var payloadJSON []byte
	if err := pool.QueryRow(ctx, `SELECT payload FROM jobs WHERE kind = 'replay-run'`).Scan(&payloadJSON); err != nil {
		t.Fatal(err)
	}
	var payload collections.CollectionJobPayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.RunID != replay.ID || payload.SourceID != source.ID || payload.OriginalRunID == nil || *payload.OriginalRunID != originalRun {
		t.Fatalf("unexpected replay payload: %+v", payload)
	}

	activeRun := uuid.Must(uuid.NewV7())
	_, err = pool.Exec(ctx, `
		INSERT INTO collection_runs (
			id, source_id, trace_id, status, triggered_at,
			raw_object_key, raw_sha256, raw_bytes
		) VALUES ($1, $2, $3, 'validating', $4, $5, $6, 2)`,
		activeRun, source.ID, uuid.NewString(), at, "sources/bic/active.json", strings.Repeat("b", 64))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := operator.QueueReplay(ctx, activeRun, "active-run", "test", uuid.NewString(), at); err == nil {
		t.Fatal("active collection run was accepted for replay")
	}
}

func TestSchedulerOnlyReturnsActiveSources(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	configs := NewSourceConfigs(pool)
	now := time.Now().UTC().Add(time.Minute)
	due, err := configs.Due(ctx, now, 10)
	if err != nil {
		t.Fatal(err)
	}
	if !containsSource(due, source.ID) {
		t.Fatalf("active due sources = %+v", due)
	}
	for _, state := range []string{"frozen", "disabled"} {
		if _, err := pool.Exec(ctx, `UPDATE sources SET publication_state = $2 WHERE id = $1`, source.ID, state); err != nil {
			t.Fatal(err)
		}
		due, err = configs.Due(ctx, now, 10)
		if err != nil {
			t.Fatal(err)
		}
		if containsSource(due, source.ID) {
			t.Fatalf("%s source was scheduled: %+v", state, due)
		}
	}
}

func TestOperatorActiveIncidentDisappearsAfterAcknowledgement(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	source := integrationSource(t, ctx, pool)
	at := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)
	runID := validatingRun(t, ctx, pool, source.ID, 0, at)
	if err := NewPublication(pool).Reject(ctx, runID, source.ID, 0, collections.PreparedDataset{HealthCode: "empty_output"}, at.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	operator := NewOperator(pool)
	listed, err := operator.ListSources(ctx, at.Add(2*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	var projected *sources.OperatorSource
	for index := range listed {
		if listed[index].ID == source.ID {
			projected = &listed[index]
			break
		}
	}
	if projected == nil || projected.SchemaVersion != "event-occurrence/v1" || projected.ActiveIncident == nil {
		t.Fatalf("operator source projection = %+v", listed)
	}
	incidentID := projected.ActiveIncident.ID
	if projected.ActiveIncident.Code != "empty_output" || projected.ActiveIncident.State != "open" {
		t.Fatalf("active incident = %+v", projected.ActiveIncident)
	}
	acknowledged, err := operator.AcknowledgeIncident(ctx, incidentID, "test", uuid.NewString(), at.Add(3*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if acknowledged.State != "acknowledged" || acknowledged.AcknowledgedAt == nil {
		t.Fatalf("acknowledged incident = %+v", acknowledged)
	}
	listed, err = operator.ListSources(ctx, at.Add(4*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	for index := range listed {
		if listed[index].ID == source.ID && listed[index].ActiveIncident != nil {
			t.Fatalf("acknowledged incident remained active: %+v", listed[index].ActiveIncident)
		}
	}
}

func containsSource(configs []sources.Config, sourceID uuid.UUID) bool {
	for _, source := range configs {
		if source.ID == sourceID {
			return true
		}
	}
	return false
}

func migratedIntegrationPool(t *testing.T) (context.Context, *pgxpool.Pool) {
	t.Helper()
	databaseURL := os.Getenv("BAAHAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAAHAR_TEST_DATABASE_URL is not set; real PostgreSQL publication test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := "baahar_publication_" + uuid.NewString()[:8]
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_, _ = admin.Exec(cleanupCtx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
	})
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	migrations, err := ReadMigrations(os.DirFS("../../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if err := MigrateUp(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	return ctx, pool
}

func integrationSource(t *testing.T, ctx context.Context, pool *pgxpool.Pool) sources.Config {
	t.Helper()
	source, err := NewSourceConfigs(pool).Get(ctx, uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f"))
	if err != nil {
		t.Fatal(err)
	}
	return source
}

func integrationCandidate(t *testing.T, source sources.Config, sourceEventID, state string, observedAt time.Time) collections.Candidate {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	startsAt := time.Date(2026, time.September, 1, 18, 0, 0, 0, location)
	if state == "B" {
		startsAt = startsAt.Add(time.Hour)
	}
	free := true
	version := events.Version{
		Title:         "Verified event " + sourceEventID,
		Category:      events.CategoryArts,
		SourceURL:     "https://bangaloreinternationalcentre.org/event/" + sourceEventID,
		StartDate:     time.Date(2026, time.September, 1, 0, 0, 0, 0, location),
		StartsAt:      &startsAt,
		TimePrecision: events.TimePrecisionTimed,
		Timezone:      "Asia/Kolkata",
		IsFree:        &free,
		Status:        events.StatusScheduled,
		Languages:     []string{"English"},
		ObservedAt:    observedAt,
	}
	if err := version.Validate(); err != nil {
		t.Fatal(err)
	}
	identity, err := events.Identity(events.IdentityInput{SourceID: source.ID, SourceEventID: sourceEventID})
	if err != nil {
		t.Fatal(err)
	}
	fingerprint, err := events.Fingerprint(version)
	if err != nil {
		t.Fatal(err)
	}
	record, _ := json.Marshal(map[string]string{"source_event_id": sourceEventID, "state": state})
	return collections.Candidate{
		Identity: identity, Fingerprint: fingerprint, Slug: "verified-event-" + sourceEventID,
		Version: version, CanonicalRecord: record,
	}
}

func fallbackIntegrationCandidate(t *testing.T, source sources.Config, title string, startHour int, observedAt time.Time) collections.Candidate {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	startsAt := time.Date(2026, time.September, 4, startHour, 0, 0, 0, location)
	endDate := time.Date(2026, time.September, 4, 0, 0, 0, 0, location)
	endsAt := startsAt.Add(2 * time.Hour)
	venue := "Jagriti Theatre"
	free := true
	version := events.Version{
		Title: title, Category: events.CategoryTheatre,
		SourceURL: "https://www.jagrititheatre.com/events/reviewed-correction",
		StartDate: endDate, EndDate: &endDate, StartsAt: &startsAt, EndsAt: &endsAt,
		TimePrecision: events.TimePrecisionTimed, Timezone: "Asia/Kolkata", VenueName: &venue,
		IsFree: &free, Status: events.StatusScheduled, Languages: []string{"English"}, ObservedAt: observedAt,
	}
	if err := version.Validate(); err != nil {
		t.Fatal(err)
	}
	identity, err := events.Identity(events.IdentityInput{
		SourceID: source.ID, Title: title, SourceURL: version.SourceURL,
		OccurrenceTime: startsAt, VenueKey: venue,
	})
	if err != nil {
		t.Fatal(err)
	}
	fingerprint, err := events.Fingerprint(version)
	if err != nil {
		t.Fatal(err)
	}
	record, _ := json.Marshal(map[string]string{"title": title, "starts_at": startsAt.Format(time.RFC3339)})
	return collections.Candidate{Identity: identity, Fingerprint: fingerprint, Slug: "reviewed-correction-" + identity[:8], Version: version, CanonicalRecord: record}
}

func changedFallbackCandidate(t *testing.T, candidate collections.Candidate, ageNote string, observedAt time.Time) collections.Candidate {
	t.Helper()
	changed := candidate
	changed.Version = candidate.Version
	changed.Version.AgeNote = &ageNote
	registrationState := events.RegistrationOpen
	if candidate.Version.RegistrationState != nil && *candidate.Version.RegistrationState == events.RegistrationOpen {
		registrationState = events.RegistrationSoldOut
	}
	changed.Version.RegistrationState = &registrationState
	changed.Version.ObservedAt = observedAt
	fingerprint, err := events.Fingerprint(changed.Version)
	if err != nil {
		t.Fatal(err)
	}
	changed.Fingerprint = fingerprint
	changed.CanonicalRecord, _ = json.Marshal(map[string]string{
		"identity": candidate.Identity, "age_note": ageNote, "observed_at": observedAt.Format(time.RFC3339),
	})
	return changed
}

func validatingRun(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID uuid.UUID, received int, triggeredAt time.Time) uuid.UUID {
	t.Helper()
	runID := uuid.Must(uuid.NewV7())
	_, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, 'validating', $4, $5)`, runID, sourceID, uuid.NewString(), triggeredAt, received)
	if err != nil {
		t.Fatal(err)
	}
	return runID
}

func validatingReplayRun(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID, priorRunID uuid.UUID, received int, triggeredAt time.Time) uuid.UUID {
	t.Helper()
	runID := uuid.Must(uuid.NewV7())
	_, err := pool.Exec(ctx, `
		INSERT INTO collection_runs (id, source_id, prior_run_id, trace_id, status, triggered_at, received_count)
		VALUES ($1, $2, $3, $4, 'validating', $5, $6)`, runID, sourceID, priorRunID, uuid.NewString(), triggeredAt, received)
	if err != nil {
		t.Fatal(err)
	}
	return runID
}

func healthyDataset(candidate collections.Candidate, trackAbsence bool) collections.PreparedDataset {
	return healthyDatasetWithTracking(trackAbsence, candidate)
}

func healthyDatasetWithTracking(trackAbsence bool, candidates ...collections.Candidate) collections.PreparedDataset {
	return collections.PreparedDataset{Candidates: candidates, TrackAbsence: trackAbsence}
}

func occurrenceState(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sourceID uuid.UUID, identity string) (uuid.UUID, uuid.UUID, time.Time) {
	t.Helper()
	var occurrenceID uuid.UUID
	var versionID uuid.UUID
	var lastObserved time.Time
	if err := pool.QueryRow(ctx, `
		SELECT id, current_version_id, last_observed_at
		FROM event_occurrences WHERE source_id = $1 AND source_identity = $2`, sourceID, identity).Scan(
		&occurrenceID, &versionID, &lastObserved,
	); err != nil {
		t.Fatal(err)
	}
	return occurrenceID, versionID, lastObserved
}

func assertOccurrenceCounts(t *testing.T, ctx context.Context, pool *pgxpool.Pool, occurrenceID uuid.UUID, versions, changes int) {
	t.Helper()
	var versionCount, changeCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_versions WHERE occurrence_id = $1`, occurrenceID).Scan(&versionCount); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_changes WHERE occurrence_id = $1`, occurrenceID).Scan(&changeCount); err != nil {
		t.Fatal(err)
	}
	if versionCount != versions || changeCount != changes {
		t.Fatalf("versions/changes = %d/%d, want %d/%d", versionCount, changeCount, versions, changes)
	}
}

func assertVisibility(t *testing.T, ctx context.Context, pool *pgxpool.Pool, occurrenceID uuid.UUID, visible bool, missing int) {
	t.Helper()
	var gotVisible bool
	var gotMissing int
	if err := pool.QueryRow(ctx, `SELECT visible, missing_observations FROM event_occurrences WHERE id = $1`, occurrenceID).Scan(&gotVisible, &gotMissing); err != nil {
		t.Fatal(err)
	}
	if gotVisible != visible || gotMissing != missing {
		t.Fatalf("visibility/missing = %v/%d, want %v/%d", gotVisible, gotMissing, visible, missing)
	}
}
