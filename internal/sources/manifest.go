package sources

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/siiddhantt/baahar/contracts"
	"go.yaml.in/yaml/v3"
)

const (
	manifestSchemaID = "https://baahar.app/contracts/source-manifest.schema.json"
	maximumManifest  = 64 << 10
)

var (
	manifestSchemaOnce sync.Once
	manifestSchema     *jsonschema.Schema
	manifestSchemaErr  error
	slugPattern        = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	collectorPattern   = regexp.MustCompile(`^c_[A-Za-z0-9_-]+$`)
	schedulePattern    = regexp.MustCompile(`^([0-9]|[1-5][0-9]) \*/(1|2|3|4|6|8|12|24) \* \* \*$`)
)

type Manifest struct {
	SchemaVersion     string            `yaml:"schema_version" json:"schema_version"`
	Source            string            `yaml:"source" json:"source"`
	SourceID          string            `yaml:"source_id,omitempty" json:"source_id,omitempty"`
	DisplayName       string            `yaml:"display_name,omitempty" json:"display_name,omitempty"`
	City              string            `yaml:"city" json:"city"`
	CityID            string            `yaml:"city_id,omitempty" json:"city_id,omitempty"`
	CanonicalHosts    []string          `yaml:"canonical_hosts" json:"canonical_hosts"`
	RegistrationHosts []string          `yaml:"registration_hosts,omitempty" json:"registration_hosts,omitempty"`
	ImageHosts        []string          `yaml:"image_hosts,omitempty" json:"image_hosts,omitempty"`
	OfficialURL       string            `yaml:"official_url,omitempty" json:"official_url,omitempty"`
	CollectorID       string            `yaml:"collector_id" json:"collector_id"`
	OutputSchema      string            `yaml:"output_schema" json:"output_schema"`
	PublicationState  string            `yaml:"publication_state,omitempty" json:"publication_state,omitempty"`
	CollectionState   string            `yaml:"collection_state,omitempty" json:"collection_state,omitempty"`
	WorkerType        string            `yaml:"worker_type,omitempty" json:"worker_type,omitempty"`
	BlockedReason     string            `yaml:"blocked_reason,omitempty" json:"blocked_reason,omitempty"`
	Schedule          string            `yaml:"schedule" json:"schedule"`
	FreshnessTTL      string            `yaml:"freshness_ttl" json:"freshness_ttl"`
	CollectionInput   *CollectionInput  `yaml:"collection_input,omitempty" json:"collection_input,omitempty"`
	Limits            ManifestLimits    `yaml:"limits" json:"limits"`
	Health            ManifestHealth    `yaml:"health" json:"health"`
	Identity          ManifestIdentity  `yaml:"identity" json:"identity"`
	ImagePreference   []string          `yaml:"image_preference,omitempty" json:"image_preference,omitempty"`
	CategoryMap       map[string]string `yaml:"category_map,omitempty" json:"category_map,omitempty"`
	Access            *ManifestAccess   `yaml:"access,omitempty" json:"access,omitempty"`
	Path              string            `yaml:"-" json:"-"`
}

type CollectionInput struct {
	URL string `yaml:"url" json:"url"`
}

type ManifestLimits struct {
	PagesPerRun                            int `yaml:"pages_per_run" json:"pages_per_run"`
	RecordsPerRun                          int `yaml:"records_per_run" json:"records_per_run"`
	WindowDays                             int `yaml:"window_days,omitempty" json:"window_days,omitempty"`
	BrowserNavigationsPerRun               int `yaml:"browser_navigations_per_run,omitempty" json:"browser_navigations_per_run,omitempty"`
	BrowserActionsPerRun                   int `yaml:"browser_actions_per_run,omitempty" json:"browser_actions_per_run,omitempty"`
	BrowserFanoutPerRun                    int `yaml:"browser_fanout_per_run,omitempty" json:"browser_fanout_per_run,omitempty"`
	MaximumPhysicalRequestsInLivePreflight int `yaml:"maximum_physical_requests_in_live_preflight,omitempty" json:"maximum_physical_requests_in_live_preflight,omitempty"`
}

type ManifestHealth struct {
	MinimumRecords                   int     `yaml:"minimum_records" json:"minimum_records"`
	MaximumParseErrorRatio           float64 `yaml:"maximum_parse_error_ratio" json:"maximum_parse_error_ratio"`
	MaximumDuplicateRatio            float64 `yaml:"maximum_duplicate_ratio" json:"maximum_duplicate_ratio"`
	MissingObservationsBeforeRemoval int     `yaml:"missing_observations_before_removal" json:"missing_observations_before_removal"`
	LowCountRatioAfterBaseline       float64 `yaml:"low_count_ratio_after_baseline" json:"low_count_ratio_after_baseline"`
	HighCountRatioAfterBaseline      float64 `yaml:"high_count_ratio_after_baseline" json:"high_count_ratio_after_baseline"`
}

type ManifestIdentity struct {
	SourceEventID               *string  `yaml:"source_event_id" json:"source_event_id"`
	SourceEventIDPattern        string   `yaml:"source_event_id_pattern,omitempty" json:"source_event_id_pattern,omitempty"`
	StableWhenTimeChanges       bool     `yaml:"stable_when_time_changes,omitempty" json:"stable_when_time_changes,omitempty"`
	FallbackFields              []string `yaml:"fallback_fields,omitempty" json:"fallback_fields,omitempty"`
	ArrayPositionAllowed        bool     `yaml:"array_position_allowed,omitempty" json:"array_position_allowed,omitempty"`
	ExactDuplicatesAllowed      bool     `yaml:"exact_duplicates_allowed,omitempty" json:"exact_duplicates_allowed,omitempty"`
	MultiPerformanceRequirement string   `yaml:"multi_performance_requirement,omitempty" json:"multi_performance_requirement,omitempty"`
}

type ManifestAccess struct {
	RobotsStatus string `yaml:"robots_status" json:"robots_status"`
	PagesPerRun  int    `yaml:"pages_per_run" json:"pages_per_run"`
	FactsOnly    bool   `yaml:"facts_only" json:"facts_only"`
}

type ManifestProjection struct {
	ID                        uuid.UUID
	CityID                    uuid.UUID
	CitySlug                  string
	Slug                      string
	DisplayName               string
	CanonicalHost             string
	OfficialURL               string
	ManifestVersion           string
	CollectorID               string
	SchemaVersion             string
	CollectionInput           json.RawMessage
	SourceEventIDPattern      *string
	FreshnessTTLSeconds       int
	CadenceSeconds            int
	PageLimit                 int
	RecordLimit               int
	DailyRunLimit             int
	AbsenceThreshold          int
	MinimumRecords            int
	MaximumQuarantineRatioBPS int
	MaximumDuplicateRatioBPS  int
	LowCountRatioBPS          int
	HighCountRatioBPS         int
	RegistrationHosts         []string
	ImageHosts                []string
}

func LoadManifest(path string) (Manifest, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Manifest{}, fmt.Errorf("read source manifest: %w", err)
	}
	if len(content) == 0 || len(content) > maximumManifest {
		return Manifest{}, fmt.Errorf("source manifest size must be between 1 and %d bytes", maximumManifest)
	}
	var document yaml.Node
	nodeDecoder := yaml.NewDecoder(bytes.NewReader(content))
	if err := nodeDecoder.Decode(&document); err != nil {
		return Manifest{}, fmt.Errorf("decode source manifest document: %w", err)
	}
	if err := rejectUnsafeYAML(&document); err != nil {
		return Manifest{}, err
	}
	var trailing yaml.Node
	if err := nodeDecoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return Manifest{}, errors.New("source manifest must contain exactly one YAML document")
		}
		return Manifest{}, fmt.Errorf("decode trailing source manifest document: %w", err)
	}
	var schemaValue any
	if err := document.Decode(&schemaValue); err != nil {
		return Manifest{}, fmt.Errorf("decode source manifest schema value: %w", err)
	}
	schemaJSON, err := json.Marshal(schemaValue)
	if err != nil {
		return Manifest{}, fmt.Errorf("encode source manifest schema value: %w", err)
	}
	var jsonValue any
	if err := json.Unmarshal(schemaJSON, &jsonValue); err != nil {
		return Manifest{}, fmt.Errorf("decode source manifest JSON value: %w", err)
	}
	schema, err := compiledManifestSchema()
	if err != nil {
		return Manifest{}, err
	}
	if err := schema.Validate(jsonValue); err != nil {
		return Manifest{}, fmt.Errorf("source manifest does not satisfy %s: %w", manifestSchemaID, err)
	}
	decoder := yaml.NewDecoder(bytes.NewReader(content))
	decoder.KnownFields(true)
	var manifest Manifest
	if err := decoder.Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("strictly decode source manifest: %w", err)
	}
	manifest.Path = path
	if err := manifest.Validate(); err != nil {
		return Manifest{}, fmt.Errorf("validate source manifest: %w", err)
	}
	return manifest, nil
}

func LoadManifestRepository(root string) ([]Manifest, error) {
	paths := make([]string, 0)
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() && entry.Name() == "source.yaml" {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk source manifests: %w", err)
	}
	slices.Sort(paths)
	manifests := make([]Manifest, 0, len(paths))
	sourcesSeen := map[string]string{}
	collectorsSeen := map[string]string{}
	idsSeen := map[string]string{}
	for _, path := range paths {
		manifest, err := LoadManifest(path)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		cityDir := filepath.Base(filepath.Dir(filepath.Dir(path)))
		sourceDir := filepath.Base(filepath.Dir(path))
		if manifest.City != cityDir || manifest.Source != sourceDir {
			return nil, fmt.Errorf("%s: manifest city/source must match its directory", path)
		}
		if previous, ok := sourcesSeen[manifest.Source]; ok {
			return nil, fmt.Errorf("source slug %q is duplicated in %s and %s", manifest.Source, previous, path)
		}
		sourcesSeen[manifest.Source] = path
		if previous, ok := collectorsSeen[manifest.CollectorID]; manifest.CollectorID != "" && ok {
			return nil, fmt.Errorf("collector ID %q is duplicated in %s and %s", manifest.CollectorID, previous, path)
		}
		if manifest.CollectorID != "" {
			collectorsSeen[manifest.CollectorID] = path
		}
		if manifest.SourceID != "" {
			if previous, ok := idsSeen[manifest.SourceID]; ok {
				return nil, fmt.Errorf("source ID %q is duplicated in %s and %s", manifest.SourceID, previous, path)
			}
			idsSeen[manifest.SourceID] = path
		}
		manifests = append(manifests, manifest)
	}
	if len(manifests) == 0 {
		return nil, errors.New("source manifest repository is empty")
	}
	return manifests, nil
}

func (manifest Manifest) Validate() error {
	if manifest.SchemaVersion != "source-manifest/v1" || manifest.OutputSchema != "event-occurrence/v1" {
		return errors.New("unsupported manifest or output schema version")
	}
	if !slugPattern.MatchString(manifest.Source) || !slugPattern.MatchString(manifest.City) {
		return errors.New("source and city must be canonical slugs")
	}
	if strings.TrimSpace(manifest.DisplayName) == "" {
		return errors.New("display name is required")
	}
	if manifest.CollectorID != "" && !collectorPattern.MatchString(manifest.CollectorID) {
		return errors.New("collector ID is invalid")
	}
	if err := validateHosts(manifest.CanonicalHosts, true); err != nil {
		return fmt.Errorf("canonical hosts: %w", err)
	}
	if len(manifest.CanonicalHosts) != 1 {
		return errors.New("source-manifest/v1 supports exactly one canonical host")
	}
	if err := validateReviewedURL(manifest.OfficialURL, manifest.CanonicalHosts); err != nil {
		return fmt.Errorf("official URL: %w", err)
	}
	if manifest.CollectionInput == nil {
		return errors.New("collection input is required")
	}
	if err := validateReviewedURL(manifest.CollectionInput.URL, manifest.CanonicalHosts); err != nil {
		return fmt.Errorf("collection input URL: %w", err)
	}
	if manifest.CollectorID != "" {
		if _, err := uuid.Parse(manifest.SourceID); err != nil {
			return errors.New("a created collector requires a stable source ID")
		}
		if _, err := uuid.Parse(manifest.CityID); err != nil {
			return errors.New("a created collector requires a stable city ID")
		}
	}
	if err := validateHosts(manifest.RegistrationHosts, false); err != nil {
		return fmt.Errorf("registration hosts: %w", err)
	}
	if err := validateHosts(manifest.ImageHosts, false); err != nil {
		return fmt.Errorf("image hosts: %w", err)
	}
	if _, _, err := manifest.scheduleValues(); err != nil {
		return err
	}
	if _, err := manifest.ttlSeconds(); err != nil {
		return err
	}
	if manifest.Health.MinimumRecords < 0 || manifest.Health.MinimumRecords > manifest.Limits.RecordsPerRun {
		return errors.New("minimum records must fit the record limit")
	}
	if _, err := ratioBasisPoints(manifest.Health.MaximumParseErrorRatio, 1); err != nil {
		return fmt.Errorf("maximum parse error ratio: %w", err)
	}
	if _, err := ratioBasisPoints(manifest.Health.MaximumDuplicateRatio, 1); err != nil {
		return fmt.Errorf("maximum duplicate ratio: %w", err)
	}
	lowCountBPS, err := ratioBasisPoints(manifest.Health.LowCountRatioAfterBaseline, 1)
	if err != nil || lowCountBPS == 0 {
		return errors.New("low count ratio must be greater than zero and at most one")
	}
	highCountBPS, err := ratioBasisPoints(manifest.Health.HighCountRatioAfterBaseline, 10)
	if err != nil || highCountBPS < 10000 || lowCountBPS > highCountBPS {
		return errors.New("high count ratio must be at least one, at most ten, and not below the low ratio")
	}
	if manifest.Access != nil && manifest.Access.PagesPerRun != manifest.Limits.PagesPerRun {
		return errors.New("access and limit page budgets differ")
	}
	if manifest.Identity.ArrayPositionAllowed || manifest.Identity.ExactDuplicatesAllowed {
		return errors.New("array-position and exact-duplicate identity are not allowed")
	}
	if manifest.Identity.SourceEventID != nil {
		if manifest.Identity.SourceEventIDPattern == "" {
			return errors.New("native source identity requires a reviewed pattern")
		}
		if _, err := regexp.Compile(manifest.Identity.SourceEventIDPattern); err != nil {
			return errors.New("source event ID pattern is invalid")
		}
	} else {
		expected := []string{"canonical_source_url", "local_occurrence_date_time", "normalized_title", "normalized_venue_key"}
		actual := append([]string(nil), manifest.Identity.FallbackFields...)
		slices.Sort(actual)
		if !slices.Equal(actual, expected) {
			return errors.New("fallback identity fields do not match the reviewed v1 set")
		}
	}
	if manifest.PublicationState == "active" {
		if !collectorPattern.MatchString(manifest.CollectorID) {
			return errors.New("an active source requires a collector ID")
		}
		if manifest.CollectionState != "verified" || manifest.BlockedReason != "" {
			return errors.New("an active source must be verified and unblocked")
		}
		if _, err := manifest.Projection(); err != nil {
			return err
		}
	} else if manifest.CollectionState == "blocked" && strings.TrimSpace(manifest.BlockedReason) == "" {
		return errors.New("a blocked source requires a reason")
	}
	return nil
}

func (manifest Manifest) Projection() (ManifestProjection, error) {
	if manifest.PublicationState != "active" || manifest.CollectionState != "verified" {
		return ManifestProjection{}, errors.New("only an active verified manifest has a runtime projection")
	}
	sourceID, err := uuid.Parse(manifest.SourceID)
	if err != nil {
		return ManifestProjection{}, errors.New("active manifest source_id is invalid")
	}
	cityID, err := uuid.Parse(manifest.CityID)
	if err != nil {
		return ManifestProjection{}, errors.New("active manifest city_id is invalid")
	}
	if strings.TrimSpace(manifest.DisplayName) == "" {
		return ManifestProjection{}, errors.New("active manifest display name is required")
	}
	if err := validateReviewedURL(manifest.OfficialURL, manifest.CanonicalHosts); err != nil {
		return ManifestProjection{}, fmt.Errorf("official URL: %w", err)
	}
	if manifest.CollectionInput == nil {
		return ManifestProjection{}, errors.New("active manifest collection input is required")
	}
	if err := validateReviewedURL(manifest.CollectionInput.URL, manifest.CanonicalHosts); err != nil {
		return ManifestProjection{}, fmt.Errorf("collection input URL: %w", err)
	}
	input, _ := json.Marshal(manifest.CollectionInput)
	cadence, daily, err := manifest.scheduleValues()
	if err != nil {
		return ManifestProjection{}, err
	}
	ttl, err := manifest.ttlSeconds()
	if err != nil {
		return ManifestProjection{}, err
	}
	bps, err := ratioBasisPoints(manifest.Health.MaximumParseErrorRatio, 1)
	if err != nil {
		return ManifestProjection{}, err
	}
	duplicateBPS, err := ratioBasisPoints(manifest.Health.MaximumDuplicateRatio, 1)
	if err != nil {
		return ManifestProjection{}, err
	}
	lowCountBPS, err := ratioBasisPoints(manifest.Health.LowCountRatioAfterBaseline, 1)
	if err != nil {
		return ManifestProjection{}, err
	}
	highCountBPS, err := ratioBasisPoints(manifest.Health.HighCountRatioAfterBaseline, 10)
	if err != nil {
		return ManifestProjection{}, err
	}
	var pattern *string
	if manifest.Identity.SourceEventID != nil {
		value := manifest.Identity.SourceEventIDPattern
		pattern = &value
	}
	return ManifestProjection{
		ID: sourceID, CityID: cityID, CitySlug: manifest.City, Slug: manifest.Source,
		DisplayName: manifest.DisplayName, CanonicalHost: manifest.CanonicalHosts[0],
		OfficialURL: manifest.OfficialURL, ManifestVersion: manifest.SchemaVersion,
		CollectorID: manifest.CollectorID, SchemaVersion: manifest.OutputSchema,
		CollectionInput: input, SourceEventIDPattern: pattern,
		FreshnessTTLSeconds: ttl, CadenceSeconds: cadence, PageLimit: manifest.Limits.PagesPerRun,
		RecordLimit: manifest.Limits.RecordsPerRun, DailyRunLimit: daily,
		AbsenceThreshold: manifest.Health.MissingObservationsBeforeRemoval,
		MinimumRecords:   manifest.Health.MinimumRecords, MaximumQuarantineRatioBPS: bps,
		MaximumDuplicateRatioBPS: duplicateBPS, LowCountRatioBPS: lowCountBPS, HighCountRatioBPS: highCountBPS,
		RegistrationHosts: cloneStrings(manifest.RegistrationHosts), ImageHosts: cloneStrings(manifest.ImageHosts),
	}, nil
}

func compiledManifestSchema() (*jsonschema.Schema, error) {
	manifestSchemaOnce.Do(func() {
		content, err := contracts.Files.ReadFile("source-manifest.schema.json")
		if err != nil {
			manifestSchemaErr = fmt.Errorf("read embedded source manifest contract: %w", err)
			return
		}
		var document any
		if err := json.Unmarshal(content, &document); err != nil {
			manifestSchemaErr = fmt.Errorf("decode source manifest contract: %w", err)
			return
		}
		compiler := jsonschema.NewCompiler()
		compiler.DefaultDraft(jsonschema.Draft2020)
		if err := compiler.AddResource(manifestSchemaID, document); err != nil {
			manifestSchemaErr = err
			return
		}
		manifestSchema, manifestSchemaErr = compiler.Compile(manifestSchemaID)
	})
	return manifestSchema, manifestSchemaErr
}

func rejectUnsafeYAML(node *yaml.Node) error {
	if node == nil {
		return nil
	}
	if node.Kind == yaml.AliasNode || node.Anchor != "" || node.Value == "<<" {
		return errors.New("source manifest aliases, anchors, and merge keys are not allowed")
	}
	for _, child := range node.Content {
		if err := rejectUnsafeYAML(child); err != nil {
			return err
		}
	}
	return nil
}

func validateHosts(hosts []string, required bool) error {
	if required && len(hosts) == 0 {
		return errors.New("at least one host is required")
	}
	seen := map[string]struct{}{}
	for _, host := range hosts {
		if host == "" || host != strings.ToLower(host) || strings.HasSuffix(host, ".") || len(host) > 253 {
			return fmt.Errorf("host %q is not canonical", host)
		}
		parsed, err := url.Parse("https://" + host)
		if err != nil || parsed.Hostname() != host || parsed.Port() != "" || strings.ContainsAny(host, "/:@*") {
			return fmt.Errorf("host %q is invalid", host)
		}
		if _, exists := seen[host]; exists {
			return fmt.Errorf("host %q is duplicated", host)
		}
		seen[host] = struct{}{}
	}
	return nil
}

func validateReviewedURL(raw string, hosts []string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil || parsed.Port() != "" || parsed.Fragment != "" {
		return errors.New("must be a canonical HTTPS URL without credentials, port, or fragment")
	}
	for _, host := range hosts {
		if parsed.Hostname() == host {
			return nil
		}
	}
	return errors.New("URL host is not reviewed")
}

func (manifest Manifest) scheduleValues() (int, int, error) {
	match := schedulePattern.FindStringSubmatch(manifest.Schedule)
	if match == nil {
		return 0, 0, errors.New("schedule must use the reviewed minute/every-hours form")
	}
	hours, _ := strconv.Atoi(match[2])
	return hours * 3600, 24 / hours, nil
}

func (manifest Manifest) ttlSeconds() (int, error) {
	duration, err := time.ParseDuration(manifest.FreshnessTTL)
	if err != nil || duration <= 0 || duration%time.Second != 0 || duration > 30*24*time.Hour {
		return 0, errors.New("freshness TTL must be a positive whole-second duration of at most 30 days")
	}
	return int(duration / time.Second), nil
}

func ratioBasisPoints(ratio, maximum float64) (int, error) {
	if ratio < 0 || ratio > maximum {
		return 0, fmt.Errorf("ratio must be between zero and %g", maximum)
	}
	bps := int(ratio*10000 + 0.5)
	if difference := ratio - float64(bps)/10000; difference < -1e-9 || difference > 1e-9 {
		return 0, errors.New("ratio may have at most four decimal places")
	}
	return bps, nil
}

func cloneStrings(values []string) []string {
	result := append(make([]string, 0, len(values)), values...)
	slices.Sort(result)
	return result
}
