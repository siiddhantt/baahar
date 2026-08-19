package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/siddhantk232/baahar/internal/collections"
	"github.com/siddhantk232/baahar/internal/platform/brightdata"
	objectstore "github.com/siddhantk232/baahar/internal/platform/s3"
	"github.com/siddhantk232/baahar/internal/sources"
)

const collectionPollInterval = 5 * time.Second
const collectionPollLimit = 10 * time.Minute

type Processor struct {
	Bright       BrightClient
	Objects      SnapshotStore
	Sources      SourceRepository
	Runs         RunRepository
	Publication  Publisher
	Validator    *collections.CollectorValidator
	Now          func() time.Time
	PollInterval time.Duration
	PollLimit    time.Duration
}

type BrightClient interface {
	Trigger(context.Context, string, json.RawMessage) (string, error)
	Dataset(context.Context, string) ([]byte, bool, error)
}

type SnapshotStore interface {
	Put(context.Context, string, []byte) (objectstore.Snapshot, error)
	Get(context.Context, string) ([]byte, objectstore.Snapshot, error)
}

type SourceRepository interface {
	Get(context.Context, uuid.UUID) (sources.Config, error)
}

type RunRepository interface {
	Find(context.Context, uuid.UUID) (collections.Run, error)
	BeginTrigger(context.Context, uuid.UUID) error
	AttachCollection(context.Context, uuid.UUID, string) error
	BeginValidation(context.Context, uuid.UUID, string, string, int64, int) error
	BeginReplayValidation(context.Context, uuid.UUID, string, string, int64, int) error
	RecentPublishedCounts(context.Context, uuid.UUID, int) ([]int, error)
}

type Publisher interface {
	Publish(context.Context, uuid.UUID, sources.Config, collections.PreparedDataset, time.Time) error
	Reject(context.Context, uuid.UUID, uuid.UUID, int, collections.PreparedDataset, time.Time) error
}

type ProcessingError struct {
	RunID     uuid.UUID
	SourceID  uuid.UUID
	Code      string
	Retryable bool
	Cause     error
}

func (err *ProcessingError) Error() string {
	return err.Code + ": " + err.Cause.Error()
}

func (err *ProcessingError) Unwrap() error {
	return err.Cause
}

func (processor *Processor) Process(ctx context.Context, job collections.Job) error {
	payload, err := decodePayload(job.Payload)
	if err != nil {
		return &ProcessingError{Code: "invalid_job_payload", Cause: err}
	}
	run, err := processor.Runs.Find(ctx, payload.RunID)
	if err != nil {
		return processingFailure(payload.RunID, payload.SourceID, "run_lookup_failed", true, err)
	}
	if run.SourceID != payload.SourceID {
		return processingFailure(payload.RunID, payload.SourceID, "job_source_mismatch", false, errors.New("job source does not match run source"))
	}
	if run.Status == collections.RunPublished || run.Status == collections.RunRejected || run.Status == collections.RunFailed {
		return nil
	}
	source, err := processor.Sources.Get(ctx, payload.SourceID)
	if err != nil {
		return processingFailure(payload.RunID, payload.SourceID, "source_lookup_failed", false, err)
	}

	if job.Kind == "replay-run" {
		if payload.OriginalRunID == nil {
			return processingFailure(run.ID, source.ID, "replay_source_missing", false, errors.New("replay job has no original run ID"))
		}
		return processor.processReplay(ctx, run, source, *payload.OriginalRunID)
	}
	if job.Kind != "collect-source" {
		return processingFailure(payload.RunID, payload.SourceID, "unknown_job_kind", false, fmt.Errorf("unsupported job kind %q", job.Kind))
	}
	return processor.processCollection(ctx, run, source)
}

func (processor *Processor) processCollection(ctx context.Context, run collections.Run, source sources.Config) error {
	if run.Status == collections.RunQueued {
		if err := processor.Runs.BeginTrigger(ctx, run.ID); err != nil {
			return processingFailure(run.ID, source.ID, "collection_trigger_intent_failed", true, err)
		}
		run.Status = collections.RunTriggering
		collectionID, err := processor.Bright.Trigger(ctx, source.CollectorID, source.CollectionInput)
		if err != nil {
			return processingFailure(run.ID, source.ID, "collection_trigger_reconciliation_required", false, err)
		}
		if err := processor.Runs.AttachCollection(ctx, run.ID, collectionID); err != nil {
			return processingFailure(run.ID, source.ID, "collection_trigger_reconciliation_required", false, err)
		}
		run.ExternalCollectionID = &collectionID
		run.Status = collections.RunCollecting
	}
	if run.Status == collections.RunTriggering {
		return processingFailure(run.ID, source.ID, "collection_trigger_reconciliation_required", false, errors.New("external trigger outcome requires operator reconciliation"))
	}
	if run.Status == collections.RunCollecting {
		if run.ExternalCollectionID == nil {
			return processingFailure(run.ID, source.ID, "collection_id_missing", false, errors.New("collecting run has no external collection ID"))
		}
		dataset, err := processor.pollDataset(ctx, *run.ExternalCollectionID)
		if err != nil {
			return classifyBrightError(run.ID, source.ID, "collection_download_failed", err)
		}
		retrievedAt := processor.now()
		key := "sources/" + source.ID.String() + "/runs/" + run.ID.String() + ".json"
		snapshot, err := processor.Objects.Put(ctx, key, dataset)
		if err != nil {
			return processingFailure(run.ID, source.ID, "snapshot_store_failed", true, err)
		}
		received, err := datasetCount(dataset)
		if err != nil {
			return processingFailure(run.ID, source.ID, "dataset_invalid", false, err)
		}
		if err := processor.Runs.BeginValidation(ctx, run.ID, snapshot.Key, snapshot.SHA256, snapshot.Bytes, received); err != nil {
			return processingFailure(run.ID, source.ID, "validation_reconcile_failed", true, err)
		}
		run.Status = collections.RunValidating
		run.RawObjectKey = &snapshot.Key
		run.RawSHA256 = &snapshot.SHA256
		run.RawBytes = &snapshot.Bytes
		return processor.validateAndPublish(ctx, run, source, dataset, run.TriggeredAt.Add(-5*time.Minute), retrievedAt.Add(5*time.Minute))
	}
	if run.Status == collections.RunValidating {
		dataset, err := processor.readRunSnapshot(ctx, run)
		if err != nil {
			return processingFailure(run.ID, source.ID, "snapshot_read_failed", true, err)
		}
		return processor.validateAndPublish(ctx, run, source, dataset, run.TriggeredAt.Add(-5*time.Minute), processor.now().Add(5*time.Minute))
	}
	return processingFailure(run.ID, source.ID, "unexpected_run_state", false, fmt.Errorf("run status is %q", run.Status))
}

func (processor *Processor) processReplay(ctx context.Context, run collections.Run, source sources.Config, originalRunID uuid.UUID) error {
	if run.PriorRunID == nil || *run.PriorRunID != originalRunID {
		return processingFailure(run.ID, source.ID, "replay_source_missing", false, errors.New("replay run has no prior run"))
	}
	prior, err := processor.Runs.Find(ctx, originalRunID)
	if err != nil {
		return processingFailure(run.ID, source.ID, "replay_source_lookup_failed", false, err)
	}
	if prior.SourceID != source.ID {
		return processingFailure(run.ID, source.ID, "replay_source_mismatch", false, errors.New("replay crosses source boundary"))
	}
	dataset, err := processor.readRunSnapshot(ctx, prior)
	if err != nil {
		return processingFailure(run.ID, source.ID, "replay_snapshot_read_failed", true, err)
	}
	if run.Status == collections.RunQueued {
		received, err := datasetCount(dataset)
		if err != nil {
			return processingFailure(run.ID, source.ID, "replay_dataset_invalid", false, err)
		}
		if err := processor.Runs.BeginReplayValidation(ctx, run.ID, *prior.RawObjectKey, *prior.RawSHA256, *prior.RawBytes, received); err != nil {
			return processingFailure(run.ID, source.ID, "replay_reconcile_failed", true, err)
		}
		run.Status = collections.RunValidating
	}
	latest := processor.now().Add(5 * time.Minute)
	if prior.CompletedAt != nil {
		latest = prior.CompletedAt.Add(5 * time.Minute)
	}
	return processor.validateAndPublish(ctx, run, source, dataset, prior.TriggeredAt.Add(-5*time.Minute), latest)
}

func (processor *Processor) validateAndPublish(
	ctx context.Context,
	run collections.Run,
	source sources.Config,
	dataset []byte,
	earliest time.Time,
	latest time.Time,
) error {
	validationView, err := collections.CanonicalizeBrightDataset(dataset, source.CollectionInput)
	if err != nil {
		received, countErr := datasetCount(dataset)
		if countErr != nil {
			return processingFailure(run.ID, source.ID, "dataset_prepare_failed", false, countErr)
		}
		index := 0
		var transport *collections.TransportError
		if errors.As(err, &transport) {
			index = transport.RecordIndex
		}
		prepared := collections.PreparedDataset{
			HealthCode: "transport_contract_invalid",
			Quarantined: []collections.Quarantine{{
				Index: index, Code: "transport_contract_invalid", Diagnostic: err.Error(),
			}},
		}
		if err := processor.Publication.Reject(ctx, run.ID, source.ID, received, prepared, processor.now()); err != nil {
			return processingFailure(run.ID, source.ID, "transport_rejection_failed", true, err)
		}
		return nil
	}
	prepared, err := collections.PrepareDataset(validationView, collections.SourcePolicy{
		ID:                        source.ID,
		CitySlug:                  source.CitySlug,
		CanonicalHost:             source.CanonicalHost,
		SchemaVersion:             source.SchemaVersion,
		SourceEventIDPattern:      source.SourceEventIDPattern,
		RecordLimit:               source.RecordLimit,
		MinimumRecords:            source.MinimumRecords,
		MaximumQuarantineRatioBPS: source.MaximumQuarantineRatioBPS,
		MaximumDuplicateRatioBPS:  source.MaximumDuplicateRatioBPS,
		LowCountRatioBPS:          source.LowCountRatioBPS,
		HighCountRatioBPS:         source.HighCountRatioBPS,
		RegistrationHosts:         source.RegistrationHosts,
		ImageHosts:                source.ImageHosts,
		ObservationEarliest:       earliest,
		ObservationLatest:         latest,
	}, processor.Validator)
	if err != nil {
		return processingFailure(run.ID, source.ID, "dataset_prepare_failed", false, err)
	}
	baseline, err := processor.Runs.RecentPublishedCounts(ctx, source.ID, 5)
	if err != nil {
		return processingFailure(run.ID, source.ID, "health_baseline_failed", true, err)
	}
	prepared = collections.ApplyRecordCountBaseline(prepared, baseline, source.LowCountRatioBPS, source.HighCountRatioBPS)
	now := processor.now()
	if prepared.HealthCode != "" {
		received, _ := datasetCount(dataset)
		if err := processor.Publication.Reject(ctx, run.ID, source.ID, received, prepared, now); err != nil {
			return processingFailure(run.ID, source.ID, "dataset_rejection_failed", true, err)
		}
		return nil
	}
	if err := processor.Publication.Publish(ctx, run.ID, source, prepared, now); err != nil {
		return processingFailure(run.ID, source.ID, "dataset_publication_failed", true, err)
	}
	return nil
}

func (processor *Processor) pollDataset(ctx context.Context, collectionID string) ([]byte, error) {
	pollLimit := processor.PollLimit
	if pollLimit <= 0 {
		pollLimit = collectionPollLimit
	}
	pollInterval := processor.PollInterval
	if pollInterval <= 0 {
		pollInterval = collectionPollInterval
	}
	deadline := time.NewTimer(pollLimit)
	defer deadline.Stop()
	for {
		dataset, ready, err := processor.Bright.Dataset(ctx, collectionID)
		if err != nil {
			return nil, err
		}
		if ready {
			return dataset, nil
		}
		timer := time.NewTimer(pollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-deadline.C:
			timer.Stop()
			return nil, errors.New("Bright Data collection did not finish within ten minutes")
		case <-timer.C:
		}
	}
}

func (processor *Processor) readRunSnapshot(ctx context.Context, run collections.Run) ([]byte, error) {
	if run.RawObjectKey == nil || run.RawSHA256 == nil || run.RawBytes == nil {
		return nil, errors.New("collection run has no complete raw snapshot reference")
	}
	content, snapshot, err := processor.Objects.Get(ctx, *run.RawObjectKey)
	if err != nil {
		return nil, err
	}
	if snapshot.SHA256 != *run.RawSHA256 || snapshot.Bytes != *run.RawBytes {
		return nil, errors.New("raw snapshot does not match the collection run evidence")
	}
	return content, nil
}

func datasetCount(dataset []byte) (int, error) {
	decoder := json.NewDecoder(bytes.NewReader(dataset))
	var records []json.RawMessage
	if err := decoder.Decode(&records); err != nil {
		return 0, err
	}
	if err := ensureEnd(decoder); err != nil {
		return 0, err
	}
	return len(records), nil
}

func ensureEnd(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err == nil {
		return errors.New("dataset contains more than one JSON value")
	} else if !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

func decodePayload(raw json.RawMessage) (collections.CollectionJobPayload, error) {
	var payload collections.CollectionJobPayload
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		return collections.CollectionJobPayload{}, err
	}
	if payload.RunID == uuid.Nil || payload.SourceID == uuid.Nil {
		return collections.CollectionJobPayload{}, errors.New("run_id and source_id are required")
	}
	return payload, nil
}

func (processor *Processor) now() time.Time {
	if processor.Now != nil {
		return processor.Now().UTC()
	}
	return time.Now().UTC()
}

func processingFailure(runID, sourceID uuid.UUID, code string, retryable bool, cause error) error {
	return &ProcessingError{RunID: runID, SourceID: sourceID, Code: code, Retryable: retryable, Cause: cause}
}

func classifyBrightError(runID, sourceID uuid.UUID, code string, err error) error {
	var upstream *brightdata.Error
	if errors.As(err, &upstream) {
		return processingFailure(runID, sourceID, upstream.Code, upstream.Retryable, err)
	}
	return processingFailure(runID, sourceID, code, true, err)
}
