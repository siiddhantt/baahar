package sources

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/events"
)

var ErrNotFound = errors.New("source operation not found")

type Config struct {
	ID                   uuid.UUID
	CityID               uuid.UUID
	CitySlug             string
	Slug                 string
	CanonicalHost        string
	CollectorID          string
	SchemaVersion        string
	CollectionInput      json.RawMessage
	SourceEventIDPattern *string
	PageLimit            int
	RecordLimit          int
	DailyRunLimit        int
	AbsenceThreshold     int
	PublicationState     string
	NextDueAt            *time.Time
}

type OperatorSource struct {
	ID               uuid.UUID
	Slug             string
	Name             string
	OfficialURL      string
	City             events.City
	Freshness        string
	LastHealthyAt    *time.Time
	CollectorID      string
	PublicationState string
	NextDueAt        *time.Time
	LatestRun        *collections.Run
}

type Incident struct {
	ID             uuid.UUID
	SourceID       uuid.UUID
	RunID          *uuid.UUID
	Code           string
	State          string
	CreatedAt      time.Time
	AcknowledgedAt *time.Time
}
