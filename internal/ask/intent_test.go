package ask

import (
	"context"
	"errors"
	"testing"

	"github.com/siiddhantt/baahar/internal/events"
)

func TestUnavailableInterpreterDoesNotGuessFromKeywords(t *testing.T) {
	_, err := NewUnavailable().Interpret(context.Background(), "free theatre tomorrow", Context{})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("error = %v", err)
	}
}

func TestValidateBindsVenuesToTheSelectedCity(t *testing.T) {
	scope := Context{Cities: []CityScope{
		{Slug: "bengaluru", Venues: []string{"BIEC"}},
		{Slug: "varanasi", Venues: []string{"BHU Campus"}},
	}}
	valid := Intent{City: "varanasi", Window: events.WindowUpcoming, Venue: "BHU Campus"}
	if err := Validate(valid, scope); err != nil {
		t.Fatalf("valid cross-city intent was rejected: %v", err)
	}
	wrongCityVenue := Intent{City: "varanasi", Window: events.WindowUpcoming, Venue: "BIEC"}
	if err := Validate(wrongCityVenue, scope); err == nil {
		t.Fatal("venue from another city was accepted")
	}
	unknownCity := Intent{City: "goa", Window: events.WindowUpcoming}
	if err := Validate(unknownCity, scope); err == nil {
		t.Fatal("unsupported city was accepted")
	}
}
