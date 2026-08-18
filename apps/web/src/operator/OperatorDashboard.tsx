import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ActionButton } from '../components/ActionButton';
import { IdempotencyKeys } from './actionKeys';
import {
  acknowledgeIncident,
  listCollectionRuns,
  listOperatorSources,
  OperatorProblem,
  replayCollection,
  triggerCollection,
} from './api';
import styles from './OperatorRoute.module.css';
import { IncidentNotice, RunList, SourceList, SourceSummary, type Feedback } from './OperatorViews';

type Props = {
  sessionId: number;
  token: string;
  onLock: () => void;
  onUnauthorized: () => void;
};

function problemMessage(error: unknown) {
  if (error instanceof OperatorProblem) return error.message;
  return 'The operation did not complete. Try it again.';
}

function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof OperatorProblem && error.status < 500) return false;
  return failureCount < 2;
}

export function OperatorDashboard({ sessionId, token, onLock, onUnauthorized }: Props) {
  const queryClient = useQueryClient();
  const idempotencyKeys = useRef(new IdempotencyKeys());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const sources = useQuery({
    queryKey: ['operator', 'sources', sessionId],
    queryFn: ({ signal }) => listOperatorSources(token, signal),
    retry: shouldRetry,
    staleTime: 15_000,
  });

  const selectedSource = useMemo(() => {
    const sourceItems = sources.data?.items ?? [];
    return sourceItems.find((source) => source.id === selectedId) ?? sourceItems[0] ?? null;
  }, [selectedId, sources.data]);

  useEffect(() => {
    if (sources.error instanceof OperatorProblem && sources.error.status === 401) onUnauthorized();
  }, [onUnauthorized, sources.error]);

  const runs = useQuery({
    queryKey: ['operator', 'runs', sessionId, selectedSource?.id],
    queryFn: ({ signal }) => listCollectionRuns(token, selectedSource?.id ?? '', signal),
    enabled: Boolean(selectedSource),
    retry: shouldRetry,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (runs.error instanceof OperatorProblem && runs.error.status === 401) onUnauthorized();
  }, [onUnauthorized, runs.error]);

  function refreshOperatorData(sourceId: string) {
    void queryClient.invalidateQueries({ queryKey: ['operator', 'sources', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['operator', 'runs', sessionId, sourceId] });
  }

  const trigger = useMutation({
    mutationFn: ({ sourceId, key }: { sourceId: string; key: string }) =>
      triggerCollection(token, sourceId, key),
    onSuccess: (_, variables) => {
      idempotencyKeys.current.clear('trigger', variables.sourceId);
      setFeedback({ kind: 'success', message: 'A new collection run is queued.' });
      refreshOperatorData(variables.sourceId);
    },
    onError: handleMutationError,
  });

  const replay = useMutation({
    mutationFn: (variables: { runId: string; sourceId: string; key: string }) =>
      replayCollection(token, variables.runId, variables.key),
    onSuccess: (_, variables) => {
      idempotencyKeys.current.clear('replay', variables.runId);
      setFeedback({ kind: 'success', message: 'The run replay is queued.' });
      refreshOperatorData(variables.sourceId);
    },
    onError: handleMutationError,
  });

  const acknowledge = useMutation({
    mutationFn: (variables: { incidentId: string; sourceId: string }) =>
      acknowledgeIncident(token, variables.incidentId),
    onSuccess: (_, variables) => {
      setFeedback({ kind: 'success', message: 'The incident is acknowledged.' });
      refreshOperatorData(variables.sourceId);
    },
    onError: handleMutationError,
  });

  function handleMutationError(error: unknown) {
    if (error instanceof OperatorProblem && error.status === 401) {
      onUnauthorized();
      return;
    }
    setFeedback({ kind: 'problem', message: problemMessage(error) });
  }

  function triggerSelected() {
    if (!selectedSource) return;
    setFeedback(null);
    trigger.mutate({
      sourceId: selectedSource.id,
      key: idempotencyKeys.current.claim('trigger', selectedSource.id),
    });
  }

  function replayRun(runId: string) {
    if (!selectedSource) return;
    setFeedback(null);
    replay.mutate({
      runId,
      sourceId: selectedSource.id,
      key: idempotencyKeys.current.claim('replay', runId),
    });
  }

  function acknowledgeSelectedIncident() {
    const incident = selectedSource?.active_incident;
    if (!selectedSource || !incident) return;
    setFeedback(null);
    acknowledge.mutate({ incidentId: incident.id, sourceId: selectedSource.id });
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Protected workspace</p>
          <h1>Baahar operations</h1>
        </div>
        <div className={styles.headerActions}>
          <Link to="/">Public site</Link>
          <ActionButton tone="quiet" onClick={onLock}>
            Lock
          </ActionButton>
        </div>
      </header>

      {sources.isPending ? (
        <p className={styles.loading}>Checking access and source health…</p>
      ) : null}
      {sources.isError &&
      !(sources.error instanceof OperatorProblem && sources.error.status === 401) ? (
        <section className={styles.problem} role="alert">
          <h2>Source health did not load</h2>
          <p>{problemMessage(sources.error)}</p>
          <ActionButton tone="quiet" onClick={() => void sources.refetch()}>
            Try again
          </ActionButton>
        </section>
      ) : null}

      {sources.isSuccess && sources.data.items.length === 0 ? (
        <section className={styles.empty}>
          <h2>No sources are configured</h2>
          <p>There is nothing to operate yet.</p>
        </section>
      ) : null}

      {sources.data?.items.length ? (
        <div className={styles.workspace}>
          <SourceList
            sources={sources.data.items}
            selectedId={selectedSource?.id}
            onSelect={(sourceId) => {
              setSelectedId(sourceId);
              setFeedback(null);
            }}
          />

          {selectedSource ? (
            <section className={styles.sourcePanel} aria-labelledby="selected-source-title">
              <div className={styles.sourceHeading}>
                <div>
                  <p>{selectedSource.city.name}</p>
                  <h2 id="selected-source-title">{selectedSource.name}</h2>
                </div>
                <ActionButton disabled={trigger.isPending} onClick={triggerSelected}>
                  {trigger.isPending ? 'Queueing run…' : 'Run collection now'}
                </ActionButton>
              </div>

              <SourceSummary source={selectedSource} />
              <IncidentNotice
                source={selectedSource}
                pending={acknowledge.isPending}
                onAcknowledge={acknowledgeSelectedIncident}
              />

              {feedback ? (
                <p
                  className={feedback.kind === 'problem' ? styles.actionProblem : styles.success}
                  role={feedback.kind === 'problem' ? 'alert' : 'status'}
                >
                  {feedback.message}
                </p>
              ) : null}

              <section className={styles.runs} aria-labelledby="recent-runs-title">
                <div className={styles.runsHeading}>
                  <h3 id="recent-runs-title">Recent runs</h3>
                  <ActionButton
                    tone="quiet"
                    disabled={runs.isFetching}
                    onClick={() => void runs.refetch()}
                  >
                    {runs.isFetching ? 'Refreshing…' : 'Refresh'}
                  </ActionButton>
                </div>
                {runs.isPending ? <p className={styles.loading}>Loading recent runs…</p> : null}
                {runs.isError ? (
                  <div className={styles.problem} role="alert">
                    <p>{problemMessage(runs.error)}</p>
                    <ActionButton tone="quiet" onClick={() => void runs.refetch()}>
                      Try again
                    </ActionButton>
                  </div>
                ) : null}
                {runs.isSuccess && runs.data.items.length === 0 ? (
                  <p className={styles.emptyRuns}>No collection runs yet.</p>
                ) : null}
                {runs.data?.items.length ? (
                  <RunList
                    runs={runs.data.items}
                    replayingId={replay.isPending ? replay.variables?.runId : undefined}
                    onReplay={replayRun}
                  />
                ) : null}
              </section>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
