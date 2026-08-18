package collections

import (
	"encoding/json"
	"testing"
	"time"
)

func TestRunTransitionsAreTerminal(t *testing.T) {
	allowed := [][2]RunStatus{
		{RunQueued, RunCollecting},
		{RunQueued, RunFailed},
		{RunCollecting, RunValidating},
		{RunCollecting, RunFailed},
		{RunValidating, RunPublished},
		{RunValidating, RunRejected},
		{RunValidating, RunFailed},
	}
	for _, transition := range allowed {
		if !ValidRunTransition(transition[0], transition[1]) {
			t.Errorf("expected %s -> %s to be allowed", transition[0], transition[1])
		}
	}
	for _, terminal := range []RunStatus{RunPublished, RunRejected, RunFailed} {
		if ValidRunTransition(terminal, RunCollecting) {
			t.Errorf("terminal status %s must not transition", terminal)
		}
	}
}

func TestNewJobRejectsNonObjectPayload(t *testing.T) {
	_, err := NewJob("collect", "bic:2026-08-18T12", json.RawMessage(`[]`), time.Now(), 3)
	if err == nil {
		t.Fatal("expected an array payload to be rejected")
	}
}
