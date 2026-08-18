package events

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("event data not found")

type City struct {
	ID       uuid.UUID
	Slug     string
	Name     string
	Timezone string
	Accent   string
}

type Source struct {
	ID            uuid.UUID
	Slug          string
	Name          string
	OfficialURL   string
	CanonicalHost string
	Freshness     string
	LastHealthyAt *time.Time
}

type PublicOccurrence struct {
	ID              uuid.UUID
	Slug            string
	City            City
	Source          Source
	Version         Version
	LastCheckedAt   time.Time
	ChangeKind      *string
	FirstObservedAt time.Time
	SortAt          time.Time
}

type CursorBoundary struct {
	SortAt       time.Time
	OccurrenceID uuid.UUID
}

type FeedQuery struct {
	CitySlug     string
	Window       Window
	AsOf         time.Time
	Categories   []Category
	ExplicitFree bool
	After        *CursorBoundary
	Limit        int
}

type FeedPage struct {
	Items         []PublicOccurrence
	Next          *CursorBoundary
	City          City
	ResultCount   int
	SourceCount   int
	LastCheckedAt *time.Time
	AsOf          time.Time
}

type PublicChange struct {
	ID            uuid.UUID
	Kind          string
	ChangedFields []string
	ChangedAt     time.Time
}

type SourceSummary struct {
	Source Source
	City   City
}
