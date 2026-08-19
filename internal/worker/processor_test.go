package worker

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/siddhantk232/baahar/internal/collections"
	objectstore "github.com/siddhantk232/baahar/internal/platform/s3"
	"github.com/siddhantk232/baahar/internal/sources"
)

var (
	testSourceID = uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f771f")
	testRunID    = uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f7720")
	testPriorID  = uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f7721")
	testNow      = time.Date(2026, time.August, 18, 13, 0, 0, 0, time.UTC)
)

func TestProcessorResumesCollectingRunWithoutRetrigger(t *testing.T) {
	dataset := validDataset(t)
	collectionID := "d_batch"
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{
		testRunID: testRun(collections.RunCollecting, &collectionID, nil),
	}}
	bright := &fakeBright{datasets: []datasetResult{{}, {content: dataset, ready: true}}}
	objects := &fakeObjects{}
	publisher := &fakePublisher{}
	processor := newTestProcessor(t, bright, objects, runs, publisher)

	err := processor.Process(context.Background(), testJob("collect-source", nil))
	if err != nil {
		t.Fatal(err)
	}
	if bright.triggerCalls != 0 || bright.datasetCalls != 2 {
		t.Fatalf("Bright calls trigger=%d dataset=%d", bright.triggerCalls, bright.datasetCalls)
	}
	if runs.beginValidationCalls != 1 || publisher.published != 1 || publisher.rejected != 0 {
		t.Fatalf("validation=%d published=%d rejected=%d", runs.beginValidationCalls, publisher.published, publisher.rejected)
	}
	if string(objects.putContent) != string(dataset) {
		t.Fatal("collector bytes were not stored exactly")
	}
}

func TestProcessorRecordsTriggerIntentBeforeBright(t *testing.T) {
	dataset := validDataset(t)
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{testRunID: testRun(collections.RunQueued, nil, nil)}}
	bright := &fakeBright{datasets: []datasetResult{{content: dataset, ready: true}}}
	processor := newTestProcessor(t, bright, &fakeObjects{}, runs, &fakePublisher{})
	if err := processor.Process(context.Background(), testJob("collect-source", nil)); err != nil {
		t.Fatal(err)
	}
	if runs.beginTriggerCalls != 1 || bright.triggerCalls != 1 {
		t.Fatalf("trigger intent/Bright calls = %d/%d, want 1/1", runs.beginTriggerCalls, bright.triggerCalls)
	}
}

func TestProcessorNeverRetriggersAmbiguousTriggerState(t *testing.T) {
	for name, runs := range map[string]*fakeRuns{
		"resumed triggering": {runs: map[uuid.UUID]collections.Run{testRunID: testRun(collections.RunTriggering, nil, nil)}},
		"attach failed":      {runs: map[uuid.UUID]collections.Run{testRunID: testRun(collections.RunQueued, nil, nil)}, attachError: errors.New("database unavailable")},
	} {
		t.Run(name, func(t *testing.T) {
			bright := &fakeBright{}
			processor := newTestProcessor(t, bright, &fakeObjects{}, runs, &fakePublisher{})
			err := processor.Process(context.Background(), testJob("collect-source", nil))
			assertProcessingCode(t, err, "collection_trigger_reconciliation_required")
			var processing *ProcessingError
			if !errors.As(err, &processing) || processing.Retryable {
				t.Fatalf("ambiguous trigger error must fail closed: %v", err)
			}
			expectedCalls := 0
			if name == "attach failed" {
				expectedCalls = 1
			}
			if bright.triggerCalls != expectedCalls {
				t.Fatalf("Bright trigger calls = %d, want %d", bright.triggerCalls, expectedCalls)
			}
		})
	}
}

func TestProcessorResumesValidatingRunFromImmutableSnapshot(t *testing.T) {
	dataset := validDataset(t)
	snapshot := snapshotFor("sources/bic/run.json", dataset)
	run := testRun(collections.RunValidating, nil, nil)
	run.RawObjectKey = &snapshot.Key
	run.RawSHA256 = &snapshot.SHA256
	run.RawBytes = &snapshot.Bytes
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{testRunID: run}}
	bright := &fakeBright{}
	objects := &fakeObjects{getContent: dataset, getSnapshot: snapshot}
	publisher := &fakePublisher{}
	processor := newTestProcessor(t, bright, objects, runs, publisher)

	if err := processor.Process(context.Background(), testJob("collect-source", nil)); err != nil {
		t.Fatal(err)
	}
	if bright.triggerCalls != 0 || bright.datasetCalls != 0 || publisher.published != 1 {
		t.Fatalf("unexpected resume calls: bright=%d/%d published=%d", bright.triggerCalls, bright.datasetCalls, publisher.published)
	}
}

func TestProcessorReplayNeverCallsBrightData(t *testing.T) {
	dataset := validDataset(t)
	snapshot := snapshotFor("sources/bic/original.json", dataset)
	original := testRun(collections.RunPublished, nil, nil)
	original.ID = testPriorID
	original.RawObjectKey = &snapshot.Key
	original.RawSHA256 = &snapshot.SHA256
	original.RawBytes = &snapshot.Bytes
	original.CompletedAt = timePointer(testNow.Add(-time.Hour))
	replay := testRun(collections.RunQueued, nil, &testPriorID)
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{testRunID: replay, testPriorID: original}}
	bright := &fakeBright{}
	publisher := &fakePublisher{}
	processor := newTestProcessor(t, bright, &fakeObjects{getContent: dataset, getSnapshot: snapshot}, runs, publisher)

	if err := processor.Process(context.Background(), testJob("replay-run", &testPriorID)); err != nil {
		t.Fatal(err)
	}
	if bright.triggerCalls != 0 || bright.datasetCalls != 0 {
		t.Fatal("replay contacted Bright Data")
	}
	if runs.beginReplayCalls != 1 || publisher.published != 1 {
		t.Fatalf("replay validation=%d publication=%d", runs.beginReplayCalls, publisher.published)
	}
}

func TestProcessorRejectsSnapshotEvidenceMismatch(t *testing.T) {
	dataset := validDataset(t)
	snapshot := snapshotFor("sources/bic/original.json", dataset)
	original := testRun(collections.RunPublished, nil, nil)
	original.ID = testPriorID
	original.RawObjectKey = &snapshot.Key
	original.RawSHA256 = &snapshot.SHA256
	original.RawBytes = &snapshot.Bytes
	replay := testRun(collections.RunQueued, nil, &testPriorID)
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{testRunID: replay, testPriorID: original}}
	wrong := snapshot
	wrong.SHA256 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	publisher := &fakePublisher{}
	processor := newTestProcessor(t, &fakeBright{}, &fakeObjects{getContent: dataset, getSnapshot: wrong}, runs, publisher)

	err := processor.Process(context.Background(), testJob("replay-run", &testPriorID))
	assertProcessingCode(t, err, "replay_snapshot_read_failed")
	if publisher.published != 0 || publisher.rejected != 0 {
		t.Fatal("mismatched immutable evidence reached publication")
	}
}

func TestProcessorFreezesQuarantinedDataset(t *testing.T) {
	dataset := []byte(`[{"input":{"url":"https://bangaloreinternationalcentre.org/events/"}}]`)
	collectionID := "d_bad"
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{
		testRunID: testRun(collections.RunCollecting, &collectionID, nil),
	}}
	publisher := &fakePublisher{}
	processor := newTestProcessor(t, &fakeBright{datasets: []datasetResult{{content: dataset, ready: true}}}, &fakeObjects{}, runs, publisher)

	if err := processor.Process(context.Background(), testJob("collect-source", nil)); err != nil {
		t.Fatal(err)
	}
	if publisher.published != 0 || publisher.rejected != 1 || publisher.lastPrepared.HealthCode != "no_valid_records" {
		t.Fatalf("unexpected unhealthy outcome: published=%d rejected=%d code=%q", publisher.published, publisher.rejected, publisher.lastPrepared.HealthCode)
	}
}

func TestProcessorStoresRawBeforeRejectingTransportMismatch(t *testing.T) {
	dataset := bytes.ReplaceAll(validDataset(t), []byte("https://bangaloreinternationalcentre.org/events/"), []byte("https://attacker.invalid/events/"))
	collectionID := "d_transport_bad"
	runs := &fakeRuns{runs: map[uuid.UUID]collections.Run{
		testRunID: testRun(collections.RunCollecting, &collectionID, nil),
	}}
	objects := &fakeObjects{}
	publisher := &fakePublisher{}
	processor := newTestProcessor(t, &fakeBright{datasets: []datasetResult{{content: dataset, ready: true}}}, objects, runs, publisher)

	if err := processor.Process(context.Background(), testJob("collect-source", nil)); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(objects.putContent, dataset) {
		t.Fatal("transport-invalid raw bytes were not preserved exactly")
	}
	if publisher.published != 0 || publisher.rejected != 1 || publisher.lastPrepared.HealthCode != "transport_contract_invalid" {
		t.Fatalf("unexpected transport outcome: published=%d rejected=%d code=%q", publisher.published, publisher.rejected, publisher.lastPrepared.HealthCode)
	}
}

func TestProcessorRejectsMalformedAndDriftedPayloads(t *testing.T) {
	processor := &Processor{}
	for name, payload := range map[string]json.RawMessage{
		"missing IDs":   json.RawMessage(`{}`),
		"unknown field": json.RawMessage(`{"run_id":"019c5d13-c392-79d2-9012-3ed4242f7720","source_id":"019c5d13-c392-79d2-9012-3ed4242f771f","surprise":true}`),
	} {
		t.Run(name, func(t *testing.T) {
			err := processor.Process(context.Background(), collections.Job{Payload: payload})
			assertProcessingCode(t, err, "invalid_job_payload")
		})
	}
}

func newTestProcessor(t *testing.T, bright *fakeBright, objects *fakeObjects, runs *fakeRuns, publisher *fakePublisher) *Processor {
	t.Helper()
	validator, err := collections.NewCollectorValidator()
	if err != nil {
		t.Fatal(err)
	}
	return &Processor{
		Bright:       bright,
		Objects:      objects,
		Sources:      fakeSources{source: testSource()},
		Runs:         runs,
		Publication:  publisher,
		Validator:    validator,
		Now:          func() time.Time { return testNow },
		PollInterval: time.Millisecond,
		PollLimit:    100 * time.Millisecond,
	}
}

func validDataset(t *testing.T) []byte {
	t.Helper()
	record, err := os.ReadFile(filepath.Join("..", "..", "contracts", "examples", "bic-event.json"))
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(record, &fields); err != nil {
		t.Fatal(err)
	}
	fields["input"] = json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/events/"}`)
	record, err = json.Marshal(fields)
	if err != nil {
		t.Fatal(err)
	}
	dataset := append([]byte{'['}, record...)
	return append(dataset, ']')
}

func testSource() sources.Config {
	pattern := `^[0-9]+$`
	return sources.Config{
		ID:                        testSourceID,
		CityID:                    uuid.MustParse("019c5d13-c392-79d2-9012-3ed4242f7700"),
		CitySlug:                  "bengaluru",
		Slug:                      "bic",
		CanonicalHost:             "bangaloreinternationalcentre.org",
		CollectorID:               "c_msyr5ts21rq3nfjxrz",
		SchemaVersion:             "event-occurrence/v1",
		CollectionInput:           json.RawMessage(`{"url":"https://bangaloreinternationalcentre.org/events/"}`),
		SourceEventIDPattern:      &pattern,
		RecordLimit:               100,
		MaximumQuarantineRatioBPS: 200,
		MaximumDuplicateRatioBPS:  100,
		LowCountRatioBPS:          4000,
		HighCountRatioBPS:         25000,
		RegistrationHosts:         []string{"bangaloreinternationalcentre.org"},
		ImageHosts:                []string{"bangaloreinternationalcentre.org"},
		AbsenceThreshold:          2,
	}
}

func testRun(status collections.RunStatus, collectionID *string, priorID *uuid.UUID) collections.Run {
	return collections.Run{
		ID:                   testRunID,
		SourceID:             testSourceID,
		PriorRunID:           priorID,
		ExternalCollectionID: collectionID,
		Status:               status,
		TriggeredAt:          testNow.Add(-2 * time.Hour),
	}
}

func testJob(kind string, originalID *uuid.UUID) collections.Job {
	payload, _ := json.Marshal(collections.CollectionJobPayload{
		RunID: testRunID, SourceID: testSourceID, OriginalRunID: originalID,
	})
	return collections.Job{Kind: kind, Payload: payload}
}

func snapshotFor(key string, content []byte) objectstore.Snapshot {
	digest := sha256.Sum256(content)
	return objectstore.Snapshot{Key: key, SHA256: hex.EncodeToString(digest[:]), Bytes: int64(len(content))}
}

func timePointer(value time.Time) *time.Time { return &value }

func assertProcessingCode(t *testing.T, err error, code string) {
	t.Helper()
	var processing *ProcessingError
	if !errors.As(err, &processing) || processing.Code != code {
		t.Fatalf("error = %v, want processing code %q", err, code)
	}
}

type datasetResult struct {
	content []byte
	ready   bool
	err     error
}

type fakeBright struct {
	triggerCalls int
	datasetCalls int
	datasets     []datasetResult
}

func (bright *fakeBright) Trigger(context.Context, string, json.RawMessage) (string, error) {
	bright.triggerCalls++
	return "d_triggered", nil
}

func (bright *fakeBright) Dataset(context.Context, string) ([]byte, bool, error) {
	bright.datasetCalls++
	if len(bright.datasets) == 0 {
		return nil, false, errors.New("unexpected dataset call")
	}
	result := bright.datasets[0]
	bright.datasets = bright.datasets[1:]
	return result.content, result.ready, result.err
}

type fakeObjects struct {
	putContent  []byte
	getContent  []byte
	getSnapshot objectstore.Snapshot
}

func (objects *fakeObjects) Put(_ context.Context, key string, content []byte) (objectstore.Snapshot, error) {
	objects.putContent = append([]byte(nil), content...)
	return snapshotFor(key, content), nil
}

func (objects *fakeObjects) Get(context.Context, string) ([]byte, objectstore.Snapshot, error) {
	return append([]byte(nil), objects.getContent...), objects.getSnapshot, nil
}

type fakeSources struct{ source sources.Config }

func (repository fakeSources) Get(context.Context, uuid.UUID) (sources.Config, error) {
	return repository.source, nil
}

type fakeRuns struct {
	runs                 map[uuid.UUID]collections.Run
	beginTriggerCalls    int
	attachError          error
	beginValidationCalls int
	beginReplayCalls     int
}

func (runs *fakeRuns) BeginTrigger(context.Context, uuid.UUID) error {
	runs.beginTriggerCalls++
	return nil
}

func (runs *fakeRuns) Find(_ context.Context, runID uuid.UUID) (collections.Run, error) {
	run, exists := runs.runs[runID]
	if !exists {
		return collections.Run{}, errors.New("run not found")
	}
	return run, nil
}

func (runs *fakeRuns) AttachCollection(context.Context, uuid.UUID, string) error {
	return runs.attachError
}

func (runs *fakeRuns) BeginValidation(context.Context, uuid.UUID, string, string, int64, int) error {
	runs.beginValidationCalls++
	return nil
}

func (runs *fakeRuns) BeginReplayValidation(context.Context, uuid.UUID, string, string, int64, int) error {
	runs.beginReplayCalls++
	return nil
}

func (runs *fakeRuns) RecentPublishedCounts(context.Context, uuid.UUID, int) ([]int, error) {
	return nil, nil
}

type fakePublisher struct {
	published    int
	rejected     int
	lastPrepared collections.PreparedDataset
}

func (publisher *fakePublisher) Publish(_ context.Context, _ uuid.UUID, _ sources.Config, prepared collections.PreparedDataset, _ time.Time) error {
	publisher.published++
	publisher.lastPrepared = prepared
	return nil
}

func (publisher *fakePublisher) Reject(_ context.Context, _, _ uuid.UUID, _ int, prepared collections.PreparedDataset, _ time.Time) error {
	publisher.rejected++
	publisher.lastPrepared = prepared
	return nil
}
