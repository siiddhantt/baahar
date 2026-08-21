package ask

import (
	"context"
	"testing"
	"time"

	"github.com/siiddhantt/baahar/internal/events"
)

func TestDeterministicInterpreterRecognizesOnlySupportedFilters(t *testing.T) {
	scope := Context{CityName: "Bengaluru", Now: time.Now(), Venues: []string{"The Reading Room", "BIEC"}}
	intent, err := NewDeterministic().Interpret(context.Background(), "Free music and arts this weekend at BIEC", scope)
	if err != nil {
		t.Fatal(err)
	}
	if intent.Window != events.WindowWeekend || !intent.ExplicitlyFree || intent.Venue != "BIEC" {
		t.Fatalf("intent = %+v", intent)
	}
	if len(intent.Categories) != 2 || intent.Categories[0] != events.CategoryArts || intent.Categories[1] != events.CategoryMusic {
		t.Fatalf("categories = %v", intent.Categories)
	}
}

func TestFallbackUsesDeterministicInterpreterAfterProviderFailure(t *testing.T) {
	primary := failingInterpreter{}
	intent, err := NewFallback(primary, NewDeterministic()).Interpret(context.Background(), "theatre tomorrow", Context{})
	if err != nil {
		t.Fatal(err)
	}
	if intent.Assisted || intent.Window != events.WindowTomorrow || len(intent.Categories) != 1 || intent.Categories[0] != events.CategoryTheatre {
		t.Fatalf("intent = %+v", intent)
	}
}

type failingInterpreter struct{}

func (failingInterpreter) Interpret(context.Context, string, Context) (Intent, error) {
	return Intent{}, context.DeadlineExceeded
}
