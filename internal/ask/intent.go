package ask

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/siiddhantt/baahar/internal/events"
)

const MaximumQueryLength = 280

var Categories = []events.Category{
	events.CategoryArts,
	events.CategoryTalks,
	events.CategoryWorkshops,
	events.CategoryTheatre,
	events.CategoryMusic,
	events.CategoryBooks,
	events.CategoryCommunity,
	events.CategoryOther,
}

type Context struct {
	CityName string
	Now      time.Time
	Venues   []string
}

type Intent struct {
	Window         events.Window
	Categories     []events.Category
	ExplicitlyFree bool
	Venue          string
	Assisted       bool
}

type Interpreter interface {
	Interpret(context.Context, string, Context) (Intent, error)
}

type deterministic struct{}

func NewDeterministic() Interpreter {
	return deterministic{}
}

func (deterministic) Interpret(_ context.Context, query string, scope Context) (Intent, error) {
	normalized := strings.ToLower(strings.TrimSpace(query))
	intent := Intent{Window: events.WindowUpcoming}

	switch {
	case strings.Contains(normalized, "tomorrow"):
		intent.Window = events.WindowTomorrow
	case strings.Contains(normalized, "weekend"):
		intent.Window = events.WindowWeekend
	case strings.Contains(normalized, "today") || strings.Contains(normalized, "tonight"):
		intent.Window = events.WindowToday
	}

	categoryWords := map[events.Category][]string{
		events.CategoryArts:      {"art", "arts", "dance", "film", "exhibition"},
		events.CategoryTalks:     {"talk", "talks", "lecture", "conference", "seminar"},
		events.CategoryWorkshops: {"workshop", "workshops", "class", "classes"},
		events.CategoryTheatre:   {"theatre", "theater", "play", "plays"},
		events.CategoryMusic:     {"music", "concert", "gig", "jazz"},
		events.CategoryBooks:     {"book", "books", "literature", "poetry"},
		events.CategoryCommunity: {"community", "social", "meetup", "festival"},
	}
	for _, category := range Categories {
		for _, word := range categoryWords[category] {
			if containsWord(normalized, word) {
				intent.Categories = append(intent.Categories, category)
				break
			}
		}
	}
	intent.ExplicitlyFree = containsWord(normalized, "free") || strings.Contains(normalized, "₹0")

	for _, venue := range scope.Venues {
		if strings.Contains(normalized, strings.ToLower(venue)) {
			intent.Venue = venue
			break
		}
	}
	return intent, Validate(intent, scope)
}

func Validate(intent Intent, scope Context) error {
	switch intent.Window {
	case events.WindowUpcoming, events.WindowToday, events.WindowTomorrow, events.WindowWeekend:
	default:
		return errors.New("ask intent has an unsupported window")
	}
	if len(intent.Categories) > 3 {
		return errors.New("ask intent has too many categories")
	}
	seen := make(map[events.Category]bool, len(intent.Categories))
	for _, category := range intent.Categories {
		valid := false
		for _, allowed := range Categories {
			if category == allowed {
				valid = true
				break
			}
		}
		if !valid || seen[category] {
			return errors.New("ask intent has invalid categories")
		}
		seen[category] = true
	}
	if intent.Venue != "" {
		found := false
		for _, venue := range scope.Venues {
			if intent.Venue == venue {
				found = true
				break
			}
		}
		if !found {
			return errors.New("ask intent has an unknown venue")
		}
	}
	return nil
}

type fallback struct {
	primary  Interpreter
	fallback Interpreter
}

func NewFallback(primary, secondary Interpreter) Interpreter {
	return fallback{primary: primary, fallback: secondary}
}

func (interpreter fallback) Interpret(ctx context.Context, query string, scope Context) (Intent, error) {
	intent, err := interpreter.primary.Interpret(ctx, query, scope)
	if err == nil {
		return intent, nil
	}
	return interpreter.fallback.Interpret(ctx, query, scope)
}

func SortedVenueNames(values []string) []string {
	result := append([]string(nil), values...)
	sort.Slice(result, func(left, right int) bool {
		return strings.ToLower(result[left]) < strings.ToLower(result[right])
	})
	return result
}

func containsWord(text, word string) bool {
	for _, field := range strings.FieldsFunc(text, func(value rune) bool {
		return !(value >= 'a' && value <= 'z') && !(value >= '0' && value <= '9')
	}) {
		if field == word {
			return true
		}
	}
	return false
}
