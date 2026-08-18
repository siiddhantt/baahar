package collections

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/siddhantk232/baahar/internal/events"
)

type SourcePolicy struct {
	ID                   uuid.UUID
	CitySlug             string
	CanonicalHost        string
	SchemaVersion        string
	SourceEventIDPattern *string
	RecordLimit          int
	ObservationEarliest  time.Time
	ObservationLatest    time.Time
}

type CollectorRecord struct {
	SchemaVersion     string                    `json:"schema_version"`
	SourceEventID     *string                   `json:"source_event_id"`
	SourceURL         string                    `json:"source_url"`
	SourceHost        string                    `json:"source_host"`
	CitySlug          string                    `json:"city_slug"`
	Title             string                    `json:"title"`
	Category          events.Category           `json:"category"`
	StartDate         string                    `json:"start_date"`
	StartsAt          *time.Time                `json:"starts_at"`
	EndDate           *string                   `json:"end_date"`
	EndsAt            *time.Time                `json:"ends_at"`
	TimePrecision     events.TimePrecision      `json:"time_precision"`
	Timezone          string                    `json:"timezone"`
	VenueName         *string                   `json:"venue_name"`
	VenueAddress      *string                   `json:"venue_address"`
	IsFree            *bool                     `json:"is_free"`
	PriceMinMinor     *int64                    `json:"price_min_minor"`
	PriceMaxMinor     *int64                    `json:"price_max_minor"`
	Currency          *string                   `json:"currency"`
	RegistrationURL   *string                   `json:"registration_url"`
	RegistrationState *events.RegistrationState `json:"registration_state"`
	Status            events.Status             `json:"status"`
	Language          []string                  `json:"language"`
	AgeNote           *string                   `json:"age_note"`
	AccessibilityNote *string                   `json:"accessibility_note"`
	ImageURL          *string                   `json:"image_url"`
	ObservedAt        time.Time                 `json:"observed_at"`
}

type Candidate struct {
	Identity        string
	Fingerprint     string
	Slug            string
	Version         events.Version
	CanonicalRecord json.RawMessage
}

type Quarantine struct {
	Index      int
	Code       string
	Diagnostic string
}

type PreparedDataset struct {
	Candidates   []Candidate
	Quarantined  []Quarantine
	HealthCode   string
	TrackAbsence bool
}

func PrepareDataset(dataset []byte, source SourcePolicy, validator *CollectorValidator) (PreparedDataset, error) {
	decoder := json.NewDecoder(bytes.NewReader(dataset))
	var records []json.RawMessage
	if err := decoder.Decode(&records); err != nil {
		return PreparedDataset{}, fmt.Errorf("decode collector dataset: %w", err)
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return PreparedDataset{}, err
	}
	prepared := PreparedDataset{
		Candidates:  make([]Candidate, 0, len(records)),
		Quarantined: make([]Quarantine, 0),
	}
	if len(records) == 0 {
		prepared.HealthCode = "empty_output"
		return prepared, nil
	}
	if source.RecordLimit < 1 || len(records) > source.RecordLimit {
		prepared.HealthCode = "record_limit_exceeded"
		return prepared, nil
	}
	identities := make(map[string]int, len(records))
	for index, raw := range records {
		if err := validator.ValidateRecord(raw); err != nil {
			prepared.Quarantined = append(prepared.Quarantined, Quarantine{Index: index, Code: "schema_invalid", Diagnostic: err.Error()})
			continue
		}
		candidate, err := normalizeRecord(raw, source)
		if err != nil {
			prepared.Quarantined = append(prepared.Quarantined, Quarantine{Index: index, Code: "semantic_invalid", Diagnostic: err.Error()})
			continue
		}
		if previous, exists := identities[candidate.Identity]; exists {
			prepared.HealthCode = "duplicate_identity"
			prepared.Quarantined = append(prepared.Quarantined, Quarantine{Index: index, Code: "duplicate_identity", Diagnostic: fmt.Sprintf("same occurrence identity as record %d", previous)})
			continue
		}
		identities[candidate.Identity] = index
		prepared.Candidates = append(prepared.Candidates, candidate)
	}
	if prepared.HealthCode == "" && len(prepared.Candidates) == 0 {
		prepared.HealthCode = "no_valid_records"
	}
	if prepared.HealthCode == "" && len(prepared.Quarantined)*100 > len(records)*2 {
		prepared.HealthCode = "quarantine_threshold_exceeded"
	}
	return prepared, nil
}

// ApplyRecordCountBaseline freezes large count changes only after three complete
// published runs exist. The rolling median tolerates normal calendar churn while
// preventing a structurally broken one-row scrape from hiding the verified feed.
func ApplyRecordCountBaseline(prepared PreparedDataset, publishedCounts []int) PreparedDataset {
	if prepared.HealthCode != "" || len(publishedCounts) < 3 {
		return prepared
	}
	prepared.TrackAbsence = true
	counts := append([]int(nil), publishedCounts...)
	slices.Sort(counts)
	median := counts[len(counts)/2]
	received := len(prepared.Candidates) + len(prepared.Quarantined)
	if median > 0 && (received*2 < median || received > median*2) {
		prepared.HealthCode = "record_count_deviation"
	}
	return prepared
}

func normalizeRecord(raw json.RawMessage, source SourcePolicy) (Candidate, error) {
	var record CollectorRecord
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&record); err != nil {
		return Candidate{}, fmt.Errorf("decode normalized record: %w", err)
	}
	if record.SchemaVersion != source.SchemaVersion {
		return Candidate{}, fmt.Errorf("schema version %q does not match source %q", record.SchemaVersion, source.SchemaVersion)
	}
	if record.CitySlug != source.CitySlug {
		return Candidate{}, fmt.Errorf("city %q does not match source %q", record.CitySlug, source.CitySlug)
	}
	if source.SourceEventIDPattern != nil {
		if record.SourceEventID == nil {
			return Candidate{}, errors.New("source_event_id is required by this source")
		}
		pattern, err := regexp.Compile(*source.SourceEventIDPattern)
		if err != nil {
			return Candidate{}, errors.New("source event ID policy is invalid")
		}
		if !pattern.MatchString(*record.SourceEventID) {
			return Candidate{}, errors.New("source_event_id does not satisfy this source policy")
		}
	} else if record.SourceEventID != nil {
		return Candidate{}, errors.New("source_event_id must be null for this source")
	}
	parsedURL, err := url.Parse(record.SourceURL)
	if err != nil {
		return Candidate{}, fmt.Errorf("parse source URL: %w", err)
	}
	host := strings.ToLower(parsedURL.Hostname())
	if host != strings.ToLower(record.SourceHost) || (host != source.CanonicalHost && !strings.HasSuffix(host, "."+source.CanonicalHost)) {
		return Candidate{}, errors.New("source URL host is not allowlisted")
	}
	location, err := time.LoadLocation(record.Timezone)
	if err != nil {
		return Candidate{}, fmt.Errorf("load event timezone: %w", err)
	}
	startDate, err := time.ParseInLocation(time.DateOnly, record.StartDate, location)
	if err != nil {
		return Candidate{}, fmt.Errorf("parse start date: %w", err)
	}
	var endDate *time.Time
	if record.EndDate != nil {
		value, err := time.ParseInLocation(time.DateOnly, *record.EndDate, location)
		if err != nil {
			return Candidate{}, fmt.Errorf("parse end date: %w", err)
		}
		endDate = &value
	}
	version := events.Version{
		Title:             record.Title,
		Category:          record.Category,
		SourceURL:         record.SourceURL,
		StartDate:         startDate,
		EndDate:           endDate,
		StartsAt:          record.StartsAt,
		EndsAt:            record.EndsAt,
		TimePrecision:     record.TimePrecision,
		Timezone:          record.Timezone,
		VenueName:         record.VenueName,
		VenueAddress:      record.VenueAddress,
		IsFree:            record.IsFree,
		RegistrationURL:   record.RegistrationURL,
		RegistrationState: record.RegistrationState,
		Status:            record.Status,
		Languages:         append([]string{}, record.Language...),
		AgeNote:           record.AgeNote,
		AccessibilityNote: record.AccessibilityNote,
		ImageURL:          record.ImageURL,
		ObservedAt:        record.ObservedAt,
	}
	if source.ObservationEarliest.IsZero() || source.ObservationLatest.IsZero() || source.ObservationLatest.Before(source.ObservationEarliest) {
		return Candidate{}, errors.New("source observation bounds are invalid")
	}
	if record.ObservedAt.Before(source.ObservationEarliest) || record.ObservedAt.After(source.ObservationLatest) {
		return Candidate{}, errors.New("observed_at falls outside this collection run")
	}
	if record.PriceMinMinor != nil {
		version.Price = &events.Money{MinMinor: *record.PriceMinMinor, MaxMinor: record.PriceMaxMinor, Currency: valueOrEmpty(record.Currency)}
	}
	if err := version.Validate(); err != nil {
		return Candidate{}, err
	}
	occurrenceTime := startDate
	if record.StartsAt != nil {
		occurrenceTime = *record.StartsAt
	}
	identity, err := events.Identity(events.IdentityInput{
		SourceID:       source.ID,
		SourceEventID:  valueOrEmpty(record.SourceEventID),
		Title:          record.Title,
		SourceURL:      record.SourceURL,
		OccurrenceTime: occurrenceTime,
		VenueKey:       valueOrEmpty(record.VenueName),
	})
	if err != nil {
		return Candidate{}, fmt.Errorf("compute occurrence identity: %w", err)
	}
	fingerprint, err := events.Fingerprint(version)
	if err != nil {
		return Candidate{}, fmt.Errorf("compute version fingerprint: %w", err)
	}
	canonical := append(json.RawMessage(nil), raw...)
	return Candidate{
		Identity:        identity,
		Fingerprint:     fingerprint,
		Slug:            eventSlug(record.Title, identity),
		Version:         version,
		CanonicalRecord: canonical,
	}, nil
}

func eventSlug(title, identity string) string {
	var slug strings.Builder
	lastHyphen := false
	for _, character := range strings.ToLower(title) {
		if (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') {
			slug.WriteRune(character)
			lastHyphen = false
		} else if (unicode.IsSpace(character) || unicode.IsPunct(character)) && slug.Len() > 0 && !lastHyphen {
			slug.WriteByte('-')
			lastHyphen = true
		}
		if slug.Len() >= 80 {
			break
		}
	}
	base := strings.Trim(slug.String(), "-")
	if base == "" {
		base = "event"
	}
	return base + "-" + identity[:8]
}

func valueOrEmpty[T ~string](value *T) string {
	if value == nil {
		return ""
	}
	return string(*value)
}
