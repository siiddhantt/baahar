package sources

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/siiddhantt/baahar/internal/collections"
	"github.com/siiddhantt/baahar/internal/events"
)

var (
	ErrNotFound = errors.New("source operation not found")
	ErrConflict = errors.New("source operation conflicts with reviewed state")
)

type Config struct {
	ID                        uuid.UUID
	CityID                    uuid.UUID
	CitySlug                  string
	Slug                      string
	CanonicalHost             string
	CollectorID               string
	SchemaVersion             string
	CollectionInput           json.RawMessage
	SourceEventIDPattern      *string
	PageLimit                 int
	RecordLimit               int
	MinimumRecords            int
	MaximumQuarantineRatioBPS int
	MaximumDuplicateRatioBPS  int
	LowCountRatioBPS          int
	HighCountRatioBPS         int
	RegistrationHosts         []string
	ImageHosts                []string
	DailyRunLimit             int
	AbsenceThreshold          int
	PublicationState          string
	NextDueAt                 *time.Time
}

type IdentityAlias struct {
	SourceID           uuid.UUID
	IncomingIdentity   string
	OccurrenceID       uuid.UUID
	MergedOccurrenceID *uuid.UUID
	Reason             string
	CreatedAt          time.Time
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
	SchemaVersion    string
	PublicationState string
	NextDueAt        *time.Time
	LatestRun        *collections.Run
	ActiveIncident   *Incident
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
