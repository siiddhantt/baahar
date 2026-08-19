package events

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Category string

const (
	CategoryArts      Category = "arts"
	CategoryTalks     Category = "talks"
	CategoryTheatre   Category = "theatre"
	CategoryMusic     Category = "music"
	CategoryBooks     Category = "books"
	CategoryCommunity Category = "community"
	CategoryOther     Category = "other"
)

type TimePrecision string

const (
	TimePrecisionTimed TimePrecision = "timed"
	TimePrecisionDate  TimePrecision = "date"
)

type Status string

const (
	StatusScheduled Status = "scheduled"
	StatusCancelled Status = "cancelled"
	StatusPostponed Status = "postponed"
)

type RegistrationState string

const (
	RegistrationOpen        RegistrationState = "open"
	RegistrationSoldOut     RegistrationState = "sold_out"
	RegistrationClosed      RegistrationState = "closed"
	RegistrationNotRequired RegistrationState = "not_required"
)

type Money struct {
	MinMinor int64
	MaxMinor *int64
	Currency string
}

type Version struct {
	Title             string
	Category          Category
	SourceURL         string
	StartDate         time.Time
	EndDate           *time.Time
	StartsAt          *time.Time
	EndsAt            *time.Time
	TimePrecision     TimePrecision
	Timezone          string
	VenueName         *string
	VenueAddress      *string
	IsFree            *bool
	Price             *Money
	RegistrationURL   *string
	RegistrationState *RegistrationState
	Status            Status
	Languages         []string
	AgeNote           *string
	AccessibilityNote *string
	ImageURL          *string
	ObservedAt        time.Time
}

type Occurrence struct {
	ID      uuid.UUID
	Version Version
}

func (v Version) Validate() error {
	if strings.TrimSpace(v.Title) == "" {
		return errors.New("title is required")
	}
	if !validCategory(v.Category) {
		return fmt.Errorf("unsupported category %q", v.Category)
	}
	if !validStatus(v.Status) {
		return fmt.Errorf("unsupported status %q", v.Status)
	}
	if err := validatePublicURL(v.SourceURL); err != nil {
		return fmt.Errorf("source URL: %w", err)
	}
	location, err := time.LoadLocation(v.Timezone)
	if err != nil {
		return fmt.Errorf("timezone: %w", err)
	}
	if !isLocalMidnight(v.StartDate, location) {
		return errors.New("start date must be local midnight")
	}
	if v.EndDate != nil {
		if !isLocalMidnight(*v.EndDate, location) {
			return errors.New("end date must be local midnight")
		}
		if v.EndDate.Before(v.StartDate) {
			return errors.New("end date cannot precede start date")
		}
	}
	if v.ObservedAt.IsZero() {
		return errors.New("observed time is required")
	}
	if err := validateTime(v); err != nil {
		return err
	}
	if v.StartsAt != nil && !sameLocalDate(v.StartDate, *v.StartsAt, location) {
		return errors.New("start_date must match starts_at in the event timezone")
	}
	if v.EndsAt != nil {
		if v.EndDate == nil {
			return errors.New("ends_at requires end_date")
		}
		if !sameLocalDate(*v.EndDate, *v.EndsAt, location) {
			return errors.New("end_date must match ends_at in the event timezone")
		}
	}
	if err := validatePrice(v); err != nil {
		return err
	}
	if v.RegistrationState != nil && !validRegistrationState(*v.RegistrationState) {
		return fmt.Errorf("unsupported registration state %q", *v.RegistrationState)
	}
	if v.RegistrationURL != nil {
		if err := validatePublicURL(*v.RegistrationURL); err != nil {
			return fmt.Errorf("registration URL: %w", err)
		}
	}
	if v.VenueName == nil && v.VenueAddress != nil {
		return errors.New("venue address requires a venue name")
	}
	if v.ImageURL != nil {
		if err := validatePublicURL(*v.ImageURL); err != nil {
			return fmt.Errorf("image URL: %w", err)
		}
	}
	return nil
}

func sameLocalDate(date time.Time, instant time.Time, location *time.Location) bool {
	localDate := date.In(location)
	localInstant := instant.In(location)
	return localDate.Year() == localInstant.Year() && localDate.Month() == localInstant.Month() && localDate.Day() == localInstant.Day()
}

func validatePublicURL(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return err
	}
	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
		return errors.New("must be an absolute HTTP(S) URL")
	}
	return nil
}

func validateTime(v Version) error {
	switch v.TimePrecision {
	case TimePrecisionTimed:
		if v.StartsAt == nil {
			return errors.New("timed occurrence requires a start time")
		}
		if v.EndsAt != nil && v.EndsAt.Before(*v.StartsAt) {
			return errors.New("end time cannot precede start time")
		}
	case TimePrecisionDate:
		if v.StartsAt != nil || v.EndsAt != nil {
			return errors.New("date-only occurrence cannot contain exact times")
		}
	default:
		return fmt.Errorf("unsupported time precision %q", v.TimePrecision)
	}
	return nil
}

func validatePrice(v Version) error {
	if v.Price == nil {
		return nil
	}
	if v.IsFree == nil || *v.IsFree {
		return errors.New("a known price requires is_free to be explicitly false")
	}
	if v.Price.Currency != "INR" {
		return errors.New("MVP prices must use INR")
	}
	if v.Price.MinMinor < 0 || (v.Price.MaxMinor != nil && *v.Price.MaxMinor < v.Price.MinMinor) {
		return errors.New("invalid price range")
	}
	return nil
}

func validCategory(category Category) bool {
	switch category {
	case CategoryArts, CategoryTalks, CategoryTheatre, CategoryMusic, CategoryBooks, CategoryCommunity, CategoryOther:
		return true
	default:
		return false
	}
}

func validStatus(status Status) bool {
	switch status {
	case StatusScheduled, StatusCancelled, StatusPostponed:
		return true
	default:
		return false
	}
}

func validRegistrationState(state RegistrationState) bool {
	switch state {
	case RegistrationOpen, RegistrationSoldOut, RegistrationClosed, RegistrationNotRequired:
		return true
	default:
		return false
	}
}

func isLocalMidnight(value time.Time, location *time.Location) bool {
	local := value.In(location)
	return local.Hour() == 0 && local.Minute() == 0 && local.Second() == 0 && local.Nanosecond() == 0
}
