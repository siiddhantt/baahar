package ask

import (
	"context"
	"errors"
	"testing"
)

func TestUnavailableInterpreterDoesNotGuessFromKeywords(t *testing.T) {
	_, err := NewUnavailable().Interpret(context.Background(), "free theatre tomorrow", Context{})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("error = %v", err)
	}
}
