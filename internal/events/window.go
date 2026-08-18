package events

import (
	"fmt"
	"time"
)

type Window string

const (
	WindowToday    Window = "today"
	WindowTomorrow Window = "tomorrow"
	WindowWeekend  Window = "weekend"
)

type TimeRange struct {
	Start time.Time
	End   time.Time
}

func RangeForWindow(now time.Time, timezone string, window Window) (TimeRange, error) {
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return TimeRange{}, fmt.Errorf("load timezone: %w", err)
	}
	localNow := now.In(location)
	today := localMidnight(localNow)

	switch window {
	case WindowToday:
		return TimeRange{Start: today, End: today.AddDate(0, 0, 1)}, nil
	case WindowTomorrow:
		start := today.AddDate(0, 0, 1)
		return TimeRange{Start: start, End: start.AddDate(0, 0, 1)}, nil
	case WindowWeekend:
		daysUntilSaturday := (int(time.Saturday) - int(today.Weekday()) + 7) % 7
		if today.Weekday() == time.Sunday {
			daysUntilSaturday = -1
		}
		start := today.AddDate(0, 0, daysUntilSaturday)
		return TimeRange{Start: start, End: start.AddDate(0, 0, 2)}, nil
	default:
		return TimeRange{}, fmt.Errorf("unsupported window %q", window)
	}
}

func OverlapsWindow(version Version, window TimeRange) bool {
	start, end := occurrenceRange(version)
	return start.Before(window.End) && end.After(window.Start)
}

func occurrenceRange(version Version) (time.Time, time.Time) {
	location, _ := time.LoadLocation(version.Timezone)
	if version.TimePrecision == TimePrecisionTimed && version.StartsAt != nil {
		start := *version.StartsAt
		if version.EndsAt != nil && version.EndsAt.After(start) {
			return start, *version.EndsAt
		}
		if version.EndDate != nil {
			end := localMidnight(version.EndDate.In(location)).AddDate(0, 0, 1)
			return start, end
		}
		return start, start.Add(time.Nanosecond)
	}

	start := localMidnight(version.StartDate.In(location))
	endDate := version.StartDate
	if version.EndDate != nil {
		endDate = *version.EndDate
	}
	return start, localMidnight(endDate.In(location)).AddDate(0, 0, 1)
}

func localMidnight(value time.Time) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, value.Location())
}
