package httpserver

import (
	"time"

	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/events"
	"github.com/siddhantk232/baahar/internal/sources"
)

type cityDTO struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
	Accent   string `json:"accent"`
}

type timingDTO struct {
	StartDate string     `json:"start_date"`
	StartsAt  *time.Time `json:"starts_at"`
	EndDate   *string    `json:"end_date"`
	EndsAt    *time.Time `json:"ends_at"`
	Precision string     `json:"precision"`
	Timezone  string     `json:"timezone"`
}

type venueDTO struct {
	Name    string  `json:"name"`
	Address *string `json:"address"`
}

type pricingDTO struct {
	IsFree       *bool   `json:"is_free"`
	MinimumMinor *int64  `json:"minimum_minor"`
	MaximumMinor *int64  `json:"maximum_minor"`
	Currency     *string `json:"currency"`
}

type registrationDTO struct {
	URL   *string `json:"url"`
	State *string `json:"state"`
}

type sourceReferenceDTO struct {
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Host      string `json:"host"`
	Freshness string `json:"freshness"`
}

type eventDTO struct {
	ID                string             `json:"id"`
	Slug              string             `json:"slug"`
	City              cityDTO            `json:"city"`
	Title             string             `json:"title"`
	Category          string             `json:"category"`
	Timing            timingDTO          `json:"timing"`
	Venue             *venueDTO          `json:"venue"`
	Pricing           pricingDTO         `json:"pricing"`
	Registration      registrationDTO    `json:"registration"`
	Status            string             `json:"status"`
	ImageURL          *string            `json:"image_url"`
	Source            sourceReferenceDTO `json:"source"`
	LastCheckedAt     time.Time          `json:"last_checked_at"`
	ChangeKind        *string            `json:"change_kind"`
	Language          []string           `json:"language"`
	AgeNote           *string            `json:"age_note"`
	AccessibilityNote *string            `json:"accessibility_note"`
}

type eventPageDTO struct {
	Items      []eventDTO   `json:"items"`
	NextCursor *string      `json:"next_cursor"`
	Meta       eventMetaDTO `json:"meta"`
}

type eventMetaDTO struct {
	City          cityDTO    `json:"city"`
	Window        string     `json:"window"`
	ResultCount   int        `json:"result_count"`
	SourceCount   int        `json:"source_count"`
	LastCheckedAt *time.Time `json:"last_checked_at"`
	PageSize      int        `json:"page_size"`
	HasMore       bool       `json:"has_more"`
	AsOf          time.Time  `json:"as_of"`
}

type eventChangeDTO struct {
	ID            string    `json:"id"`
	Kind          string    `json:"kind"`
	ChangedFields []string  `json:"changed_fields"`
	ChangedAt     time.Time `json:"changed_at"`
}

type sourceSummaryDTO struct {
	Slug          string     `json:"slug"`
	Name          string     `json:"name"`
	OfficialURL   string     `json:"official_url"`
	City          cityDTO    `json:"city"`
	Freshness     string     `json:"freshness"`
	LastHealthyAt *time.Time `json:"last_healthy_at"`
}

type collectionRunDTO struct {
	ID                   string     `json:"id"`
	SourceID             string     `json:"source_id"`
	ExternalCollectionID *string    `json:"external_collection_id"`
	Status               string     `json:"status"`
	TriggeredAt          time.Time  `json:"triggered_at"`
	CompletedAt          *time.Time `json:"completed_at"`
	AcceptedCount        int        `json:"accepted_count"`
	QuarantinedCount     int        `json:"quarantined_count"`
	HealthCode           *string    `json:"health_code"`
}

type operatorSourceDTO struct {
	ID               string            `json:"id"`
	Slug             string            `json:"slug"`
	Name             string            `json:"name"`
	OfficialURL      string            `json:"official_url"`
	City             cityDTO           `json:"city"`
	Freshness        string            `json:"freshness"`
	LastHealthyAt    *time.Time        `json:"last_healthy_at"`
	CollectorID      string            `json:"collector_id"`
	SchemaVersion    string            `json:"schema_version"`
	PublicationState string            `json:"publication_state"`
	NextDueAt        *time.Time        `json:"next_due_at"`
	LatestRun        *collectionRunDTO `json:"latest_run"`
	ActiveIncident   *incidentDTO      `json:"active_incident"`
}

type incidentDTO struct {
	ID             string     `json:"id"`
	SourceID       string     `json:"source_id"`
	RunID          *string    `json:"run_id"`
	Code           string     `json:"code"`
	State          string     `json:"state"`
	CreatedAt      time.Time  `json:"created_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
}

type sourceAliasDTO struct {
	SourceID           string    `json:"source_id"`
	IncomingIdentity   string    `json:"incoming_identity"`
	OccurrenceID       string    `json:"occurrence_id"`
	MergedOccurrenceID *string   `json:"merged_occurrence_id"`
	Reason             string    `json:"reason"`
	CreatedAt          time.Time `json:"created_at"`
}

type problemDTO struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail,omitempty"`
	Instance string `json:"instance,omitempty"`
	Code     string `json:"code"`
}

func presentCity(city events.City) cityDTO {
	return cityDTO{Slug: city.Slug, Name: city.Name, Timezone: city.Timezone, Accent: city.Accent}
}

func presentEvent(occurrence events.PublicOccurrence) eventDTO {
	version := occurrence.Version
	var endDate *string
	if version.EndDate != nil {
		value := version.EndDate.Format(time.DateOnly)
		endDate = &value
	}
	var venue *venueDTO
	if version.VenueName != nil {
		venue = &venueDTO{Name: *version.VenueName, Address: version.VenueAddress}
	}
	pricing := pricingDTO{IsFree: version.IsFree}
	if version.Price != nil {
		pricing.MinimumMinor = &version.Price.MinMinor
		pricing.MaximumMinor = version.Price.MaxMinor
		pricing.Currency = &version.Price.Currency
	}
	var registrationState *string
	if version.RegistrationState != nil {
		value := string(*version.RegistrationState)
		registrationState = &value
	}
	languages := append([]string(nil), version.Languages...)
	if languages == nil {
		languages = []string{}
	}
	return eventDTO{
		ID:       occurrence.ID.String(),
		Slug:     occurrence.Slug,
		City:     presentCity(occurrence.City),
		Title:    version.Title,
		Category: string(version.Category),
		Timing: timingDTO{
			StartDate: version.StartDate.Format(time.DateOnly),
			StartsAt:  version.StartsAt,
			EndDate:   endDate,
			EndsAt:    version.EndsAt,
			Precision: string(version.TimePrecision),
			Timezone:  version.Timezone,
		},
		Venue:        venue,
		Pricing:      pricing,
		Registration: registrationDTO{URL: version.RegistrationURL, State: registrationState},
		Status:       string(version.Status),
		ImageURL:     version.ImageURL,
		Source: sourceReferenceDTO{
			Slug:      occurrence.Source.Slug,
			Name:      occurrence.Source.Name,
			URL:       version.SourceURL,
			Host:      occurrence.Source.CanonicalHost,
			Freshness: occurrence.Source.Freshness,
		},
		LastCheckedAt:     occurrence.LastCheckedAt,
		ChangeKind:        occurrence.ChangeKind,
		Language:          languages,
		AgeNote:           version.AgeNote,
		AccessibilityNote: version.AccessibilityNote,
	}
}

func presentRun(run collections.Run) collectionRunDTO {
	return collectionRunDTO{
		ID:                   run.ID.String(),
		SourceID:             run.SourceID.String(),
		ExternalCollectionID: run.ExternalCollectionID,
		Status:               string(run.Status),
		TriggeredAt:          run.TriggeredAt,
		CompletedAt:          run.CompletedAt,
		AcceptedCount:        run.AcceptedCount,
		QuarantinedCount:     run.QuarantinedCount,
		HealthCode:           run.ErrorCode,
	}
}

func presentOperatorSource(source sources.OperatorSource) operatorSourceDTO {
	result := operatorSourceDTO{
		ID:               source.ID.String(),
		Slug:             source.Slug,
		Name:             source.Name,
		OfficialURL:      source.OfficialURL,
		City:             presentCity(source.City),
		Freshness:        source.Freshness,
		LastHealthyAt:    source.LastHealthyAt,
		CollectorID:      source.CollectorID,
		SchemaVersion:    source.SchemaVersion,
		PublicationState: source.PublicationState,
		NextDueAt:        source.NextDueAt,
	}
	if source.LatestRun != nil {
		latest := presentRun(*source.LatestRun)
		result.LatestRun = &latest
	}
	if source.ActiveIncident != nil {
		incident := presentIncident(*source.ActiveIncident)
		result.ActiveIncident = &incident
	}
	return result
}

func presentIncident(incident sources.Incident) incidentDTO {
	var runID *string
	if incident.RunID != nil {
		value := incident.RunID.String()
		runID = &value
	}
	return incidentDTO{
		ID:             incident.ID.String(),
		SourceID:       incident.SourceID.String(),
		RunID:          runID,
		Code:           incident.Code,
		State:          incident.State,
		CreatedAt:      incident.CreatedAt,
		AcknowledgedAt: incident.AcknowledgedAt,
	}
}

func presentSourceAlias(alias sources.IdentityAlias) sourceAliasDTO {
	var mergedOccurrenceID *string
	if alias.MergedOccurrenceID != nil {
		value := alias.MergedOccurrenceID.String()
		mergedOccurrenceID = &value
	}
	return sourceAliasDTO{
		SourceID: alias.SourceID.String(), IncomingIdentity: alias.IncomingIdentity,
		OccurrenceID: alias.OccurrenceID.String(), MergedOccurrenceID: mergedOccurrenceID,
		Reason: alias.Reason, CreatedAt: alias.CreatedAt,
	}
}
