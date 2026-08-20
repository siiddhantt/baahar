package postgres

import (
	"encoding/json"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/siiddhantt/baahar/internal/sources"
)

func TestFreshMigrationMatchesEveryActiveSourceManifest(t *testing.T) {
	ctx, pool := migratedIntegrationPool(t)
	manifests, err := sources.LoadManifestRepository(filepath.Join("..", "..", "..", "sources"))
	if err != nil {
		t.Fatal(err)
	}
	expected := make([]sources.ManifestProjection, 0)
	for _, manifest := range manifests {
		if manifest.PublicationState != "active" {
			continue
		}
		projection, err := manifest.Projection()
		if err != nil {
			t.Fatal(err)
		}
		expected = append(expected, projection)
	}
	slices.SortFunc(expected, func(left, right sources.ManifestProjection) int {
		return strings.Compare(left.ID.String(), right.ID.String())
	})

	rows, err := pool.Query(ctx, `
		SELECT s.id, s.city_id, c.slug, s.slug, s.display_name, s.canonical_host,
			s.official_url, s.manifest_version, s.collector_id, s.schema_version,
			s.collection_input, s.source_event_id_pattern, s.freshness_ttl_seconds,
			s.cadence_seconds, s.page_limit, s.record_limit, s.daily_run_limit,
			s.absence_threshold, s.minimum_records, s.maximum_quarantine_ratio_bps,
			s.maximum_duplicate_ratio_bps, s.low_count_ratio_bps, s.high_count_ratio_bps,
			s.registration_hosts, s.image_hosts, s.next_due_at IS NOT NULL
		FROM sources s JOIN cities c ON c.id = s.city_id
		WHERE s.enabled
		ORDER BY s.id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	actual := make([]sources.ManifestProjection, 0)
	for rows.Next() {
		var projection sources.ManifestProjection
		var input []byte
		var nextDue bool
		if err := rows.Scan(
			&projection.ID, &projection.CityID, &projection.CitySlug, &projection.Slug,
			&projection.DisplayName, &projection.CanonicalHost, &projection.OfficialURL,
			&projection.ManifestVersion, &projection.CollectorID, &projection.SchemaVersion,
			&input, &projection.SourceEventIDPattern, &projection.FreshnessTTLSeconds,
			&projection.CadenceSeconds, &projection.PageLimit, &projection.RecordLimit,
			&projection.DailyRunLimit, &projection.AbsenceThreshold, &projection.MinimumRecords,
			&projection.MaximumQuarantineRatioBPS,
			&projection.MaximumDuplicateRatioBPS, &projection.LowCountRatioBPS,
			&projection.HighCountRatioBPS,
			&projection.RegistrationHosts, &projection.ImageHosts, &nextDue,
		); err != nil {
			t.Fatal(err)
		}
		if !nextDue {
			t.Fatalf("enabled source %s has no next_due_at", projection.Slug)
		}
		projection.CollectionInput = canonicalJSON(t, input)
		slices.Sort(projection.RegistrationHosts)
		slices.Sort(projection.ImageHosts)
		actual = append(actual, projection)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	for index := range expected {
		expected[index].CollectionInput = canonicalJSON(t, expected[index].CollectionInput)
	}
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("fresh runtime source projection does not match active manifests\nactual: %#v\nexpected: %#v", actual, expected)
	}
}

func canonicalJSON(t *testing.T, raw []byte) json.RawMessage {
	t.Helper()
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatal(err)
	}
	canonical, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return canonical
}
