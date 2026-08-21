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
	Timezone string
	Now      time.Time
	Venues   []string
}

type Intent struct {
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

func SortedVenueNames(values []string) []string {
	result := append([]string(nil), values...)
	sort.Slice(result, func(left, right int) bool {
		return strings.ToLower(result[left]) < strings.ToLower(result[right])
	})
	return result
}
