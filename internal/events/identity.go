package events

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

type IdentityInput struct {
	SourceID       uuid.UUID
	SourceEventID  string
	Title          string
	SourceURL      string
	OccurrenceTime time.Time
	VenueKey       string
}

func Identity(input IdentityInput) (string, error) {
	if input.SourceID == uuid.Nil {
		return "", errors.New("source ID is required")
	}
	parts := []string{input.SourceID.String()}
	if sourceEventID := normalizeText(input.SourceEventID); sourceEventID != "" {
		parts = append(parts, "external", sourceEventID)
	} else {
		title := normalizeText(input.Title)
		if title == "" {
			return "", errors.New("title is required for derived identity")
		}
		if input.OccurrenceTime.IsZero() {
			return "", errors.New("occurrence time is required")
		}
		canonicalURL, err := canonicalizeURL(input.SourceURL)
		if err != nil {
			return "", err
		}
		parts = append(parts, "derived", canonicalURL, title, input.OccurrenceTime.UTC().Format(time.RFC3339Nano), normalizeText(input.VenueKey))
	}
	return hashParts(parts), nil
}

func Fingerprint(version Version) (string, error) {
	if err := version.Validate(); err != nil {
		return "", err
	}

	parts := []string{
		normalizeText(version.Title),
		string(version.Category),
		mustCanonicalizeURL(version.SourceURL),
		formatDate(version.StartDate, version.Timezone),
		formatOptionalDate(version.EndDate, version.Timezone),
		formatOptionalTime(version.StartsAt),
		formatOptionalTime(version.EndsAt),
		string(version.TimePrecision),
		version.Timezone,
		normalizeOptionalText(version.VenueName),
		normalizeOptionalText(version.VenueAddress),
		formatOptionalBool(version.IsFree),
		formatMoney(version.Price),
		normalizeOptionalURL(version.RegistrationURL),
		formatRegistrationState(version.RegistrationState),
		string(version.Status),
		normalizeOptionalText(version.AgeNote),
		normalizeOptionalText(version.AccessibilityNote),
		normalizeOptionalURL(version.ImageURL),
	}
	languages := append([]string(nil), version.Languages...)
	for index := range languages {
		languages[index] = normalizeText(languages[index])
	}
	sort.Strings(languages)
	parts = append(parts, strings.Join(languages, ","))
	return hashParts(parts), nil
}

func canonicalizeURL(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", err
	}
	if (strings.ToLower(parsed.Scheme) != "http" && strings.ToLower(parsed.Scheme) != "https") || parsed.Hostname() == "" {
		return "", errors.New("must be an absolute HTTP(S) URL")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.Fragment = ""
	parsed.RawQuery = parsed.Query().Encode()
	parsed.Path = path.Clean("/" + strings.TrimPrefix(parsed.Path, "/"))
	parsed.RawPath = ""
	if parsed.Path != "/" {
		parsed.Path = strings.TrimSuffix(parsed.Path, "/")
	}
	return parsed.String(), nil
}

func mustCanonicalizeURL(raw string) string {
	canonical, _ := canonicalizeURL(raw)
	return canonical
}

func normalizeText(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(value)), " "))
}

func normalizeOptionalText(value *string) string {
	if value == nil {
		return "null"
	}
	return normalizeText(*value)
}

func normalizeOptionalURL(value *string) string {
	if value == nil {
		return "null"
	}
	canonical, err := canonicalizeURL(*value)
	if err != nil {
		return strings.TrimSpace(*value)
	}
	return canonical
}

func formatOptionalBool(value *bool) string {
	if value == nil {
		return "null"
	}
	if *value {
		return "true"
	}
	return "false"
}

func formatMoney(value *Money) string {
	if value == nil {
		return "null"
	}
	maximum := "null"
	if value.MaxMinor != nil {
		maximum = formatInt64(*value.MaxMinor)
	}
	return value.Currency + ":" + formatInt64(value.MinMinor) + ":" + maximum
}

func formatRegistrationState(value *RegistrationState) string {
	if value == nil {
		return "null"
	}
	return string(*value)
}

func formatOptionalTime(value *time.Time) string {
	if value == nil {
		return "null"
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func formatDate(value time.Time, timezone string) string {
	location, _ := time.LoadLocation(timezone)
	return value.In(location).Format(time.DateOnly)
}

func formatOptionalDate(value *time.Time, timezone string) string {
	if value == nil {
		return "null"
	}
	return formatDate(*value, timezone)
}

func formatInt64(value int64) string {
	const digits = "0123456789"
	if value == 0 {
		return "0"
	}
	var buffer [20]byte
	position := len(buffer)
	for value > 0 {
		position--
		buffer[position] = digits[value%10]
		value /= 10
	}
	return string(buffer[position:])
}

func hashParts(parts []string) string {
	digest := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return hex.EncodeToString(digest[:])
}
