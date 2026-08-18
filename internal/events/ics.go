package events

import (
	"bytes"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

const calendarProductID = "-//Baahar//City Events//EN"

func Calendar(occurrence Occurrence, generatedAt time.Time) ([]byte, error) {
	if occurrence.ID.String() == "00000000-0000-0000-0000-000000000000" {
		return nil, errors.New("occurrence ID is required")
	}
	if generatedAt.IsZero() {
		return nil, errors.New("generated time is required")
	}
	if err := occurrence.Version.Validate(); err != nil {
		return nil, err
	}

	version := occurrence.Version
	lines := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:" + calendarProductID,
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		"UID:" + occurrence.ID.String() + "@baahar.app",
		"DTSTAMP:" + formatICSUTC(generatedAt),
		"SUMMARY:" + escapeICSText(version.Title),
		"URL:" + version.SourceURL,
	}

	if version.TimePrecision == TimePrecisionTimed {
		lines = append(lines, "DTSTART:"+formatICSUTC(*version.StartsAt))
		if version.EndsAt != nil {
			lines = append(lines, "DTEND:"+formatICSUTC(*version.EndsAt))
		}
	} else {
		location, _ := time.LoadLocation(version.Timezone)
		start := version.StartDate.In(location)
		end := start
		if version.EndDate != nil {
			end = version.EndDate.In(location)
		}
		lines = append(lines,
			"DTSTART;VALUE=DATE:"+start.Format("20060102"),
			"DTEND;VALUE=DATE:"+end.AddDate(0, 0, 1).Format("20060102"),
		)
	}

	if location := calendarLocation(version); location != "" {
		lines = append(lines, "LOCATION:"+escapeICSText(location))
	}
	if version.Status == StatusCancelled {
		lines = append(lines, "STATUS:CANCELLED")
	}
	lines = append(lines, "END:VEVENT", "END:VCALENDAR")

	var output bytes.Buffer
	for _, line := range lines {
		output.WriteString(foldICSLine(line))
		output.WriteString("\r\n")
	}
	return output.Bytes(), nil
}

func calendarLocation(version Version) string {
	parts := make([]string, 0, 2)
	if version.VenueName != nil && strings.TrimSpace(*version.VenueName) != "" {
		parts = append(parts, strings.TrimSpace(*version.VenueName))
	}
	if version.VenueAddress != nil && strings.TrimSpace(*version.VenueAddress) != "" {
		parts = append(parts, strings.TrimSpace(*version.VenueAddress))
	}
	return strings.Join(parts, ", ")
}

func formatICSUTC(value time.Time) string {
	return value.UTC().Format("20060102T150405Z")
}

func escapeICSText(value string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"\r\n", "\\n",
		"\n", "\\n",
		"\r", "\\n",
		",", "\\,",
		";", "\\;",
	)
	return replacer.Replace(value)
}

func foldICSLine(line string) string {
	const firstLimit = 75
	const continuationLimit = 74
	line = strings.ToValidUTF8(line, "�")
	if len(line) <= firstLimit {
		return line
	}

	var folded strings.Builder
	remaining := line
	limit := firstLimit
	for len(remaining) > limit {
		cut := safeUTF8Cut(remaining, limit)
		folded.WriteString(remaining[:cut])
		folded.WriteString("\r\n ")
		remaining = remaining[cut:]
		limit = continuationLimit
	}
	folded.WriteString(remaining)
	return folded.String()
}

func safeUTF8Cut(value string, limit int) int {
	if len(value) <= limit {
		return len(value)
	}
	cut := limit
	for cut > 0 && !utf8.ValidString(value[:cut]) {
		cut--
	}
	return cut
}
