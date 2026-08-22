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

type CityScope struct {
	Slug     string
	Name     string
	Timezone string
	Venues   []string
}

type Context struct {
	CurrentCity string
	Now         time.Time
	Cities      []CityScope
}

type Intent struct {
	City           string
	Window         events.Window
	Categories     []events.Category
	ExplicitlyFree bool
	Venue          string
}

type Interpreter interface {
	Interpret(context.Context, string, Context) (Intent, error)
}

var ErrUnavailable = errors.New("language interpretation is unavailable")

type unavailable struct{}

func NewUnavailable() Interpreter { return unavailable{} }

func (unavailable) Interpret(context.Context, string, Context) (Intent, error) {
	return Intent{}, ErrUnavailable
}

func Validate(intent Intent, scope Context) error {
	city, found := FindCity(scope, intent.City)
	if !found {
		return errors.New("ask intent has an unknown city")
	}
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
		for _, venue := range city.Venues {
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

func FindCity(scope Context, slug string) (CityScope, bool) {
	for _, city := range scope.Cities {
		if city.Slug == slug {
			return city, true
		}
	}
	return CityScope{}, false
}

func SortedCities(values []CityScope) []CityScope {
	result := append([]CityScope(nil), values...)
	sort.Slice(result, func(left, right int) bool {
		return strings.ToLower(result[left].Name) < strings.ToLower(result[right].Name)
	})
	return result
}

func SortedVenueNames(values []string) []string {
	result := append([]string(nil), values...)
	sort.Slice(result, func(left, right int) bool {
		return strings.ToLower(result[left]) < strings.ToLower(result[right])
	})
	return result
}
