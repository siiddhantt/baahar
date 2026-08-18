package collections

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type RunStatus string

const (
	RunQueued     RunStatus = "queued"
	RunCollecting RunStatus = "collecting"
	RunValidating RunStatus = "validating"
	RunPublished  RunStatus = "published"
	RunRejected   RunStatus = "rejected"
	RunFailed     RunStatus = "failed"
)

type Run struct {
	ID                   uuid.UUID
	SourceID             uuid.UUID
	PriorRunID           *uuid.UUID
	ExternalCollectionID *string
	TraceID              string
	Status               RunStatus
	TriggeredAt          time.Time
	CompletedAt          *time.Time
	RawObjectKey         *string
	RawSHA256            *string
	RawBytes             *int64
	ReceivedCount        int
	AcceptedCount        int
	QuarantinedCount     int
	HealthSummary        json.RawMessage
	ErrorCode            *string
}

type JobStatus string

const (
	JobReady     JobStatus = "ready"
	JobLeased    JobStatus = "leased"
	JobCompleted JobStatus = "completed"
	JobDead      JobStatus = "dead"
)

type Job struct {
	ID            uuid.UUID
	Kind          string
	DedupeKey     string
	Payload       json.RawMessage
	Status        JobStatus
	AvailableAt   time.Time
	Attempt       int
	MaxAttempts   int
	LeasedBy      *string
	LeasedUntil   *time.Time
	LastErrorCode *string
	CreatedAt     time.Time
	CompletedAt   *time.Time
}

// CollectionJobPayload is the durable contract shared by the operator enqueue
// path and the worker. OriginalRunID is required only for replay-run jobs.
type CollectionJobPayload struct {
	RunID         uuid.UUID  `json:"run_id"`
	SourceID      uuid.UUID  `json:"source_id"`
	OriginalRunID *uuid.UUID `json:"original_run_id,omitempty"`
}

func NewJob(kind, dedupeKey string, payload json.RawMessage, availableAt time.Time, maxAttempts int) (Job, error) {
	if kind == "" || dedupeKey == "" {
		return Job{}, errors.New("job kind and dedupe key are required")
	}
	if !json.Valid(payload) || len(payload) == 0 || payload[0] != '{' {
		return Job{}, errors.New("job payload must be a JSON object")
	}
	if availableAt.IsZero() {
		return Job{}, errors.New("job availability is required")
	}
	if maxAttempts < 1 {
		return Job{}, errors.New("job max attempts must be positive")
	}
	return Job{
		ID:          uuid.Must(uuid.NewV7()),
		Kind:        kind,
		DedupeKey:   dedupeKey,
		Payload:     append(json.RawMessage(nil), payload...),
		Status:      JobReady,
		AvailableAt: availableAt,
		MaxAttempts: maxAttempts,
	}, nil
}

func ValidRunTransition(from, to RunStatus) bool {
	switch from {
	case RunQueued:
		return to == RunCollecting || to == RunFailed
	case RunCollecting:
		return to == RunValidating || to == RunFailed
	case RunValidating:
		return to == RunPublished || to == RunRejected || to == RunFailed
	case RunPublished, RunRejected, RunFailed:
		return false
	default:
		return false
	}
}
