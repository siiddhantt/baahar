package events

import (
	"reflect"
	"time"
)

type ChangedField string

const (
	FieldStart             ChangedField = "start"
	FieldEnd               ChangedField = "end"
	FieldVenue             ChangedField = "venue"
	FieldRegistrationURL   ChangedField = "registration_url"
	FieldPrice             ChangedField = "price"
	FieldFreeState         ChangedField = "free_state"
	FieldRegistrationState ChangedField = "registration_state"
	FieldStatus            ChangedField = "status"
)

type Change struct {
	Fields []ChangedField
}

func MaterialDiff(current, candidate Version) Change {
	fields := make([]ChangedField, 0, 8)
	if !sameDate(current.StartDate, candidate.StartDate) || !sameTime(current.StartsAt, candidate.StartsAt) {
		fields = append(fields, FieldStart)
	}
	if !sameOptionalDate(current.EndDate, candidate.EndDate) || !sameTime(current.EndsAt, candidate.EndsAt) {
		fields = append(fields, FieldEnd)
	}
	if normalizeOptionalText(current.VenueName) != normalizeOptionalText(candidate.VenueName) || normalizeOptionalText(current.VenueAddress) != normalizeOptionalText(candidate.VenueAddress) {
		fields = append(fields, FieldVenue)
	}
	if normalizeOptionalURL(current.RegistrationURL) != normalizeOptionalURL(candidate.RegistrationURL) {
		fields = append(fields, FieldRegistrationURL)
	}
	if !reflect.DeepEqual(current.Price, candidate.Price) {
		fields = append(fields, FieldPrice)
	}
	if !equalBool(current.IsFree, candidate.IsFree) {
		fields = append(fields, FieldFreeState)
	}
	if !equalRegistrationState(current.RegistrationState, candidate.RegistrationState) {
		fields = append(fields, FieldRegistrationState)
	}
	if current.Status != candidate.Status {
		fields = append(fields, FieldStatus)
	}
	return Change{Fields: fields}
}

func (change Change) Material() bool {
	return len(change.Fields) > 0
}

func sameDate(left, right time.Time) bool {
	return left.Year() == right.Year() && left.YearDay() == right.YearDay()
}

func sameOptionalDate(left, right *time.Time) bool {
	if left == nil || right == nil {
		return left == right
	}
	return sameDate(*left, *right)
}

func sameTime(left, right *time.Time) bool {
	if left == nil || right == nil {
		return left == right
	}
	return left.Equal(*right)
}

func equalBool(left, right *bool) bool {
	if left == nil || right == nil {
		return left == right
	}
	return *left == *right
}

func equalRegistrationState(left, right *RegistrationState) bool {
	if left == nil || right == nil {
		return left == right
	}
	return *left == *right
}
