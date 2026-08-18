import { ActionButton } from '../components/ActionButton';
import type { CollectionRun, OperatorSource } from './api';
import styles from './OperatorRoute.module.css';

export type Feedback = {
  kind: 'problem' | 'success';
  message: string;
};

const terminalStatuses = new Set<CollectionRun['status']>(['published', 'rejected', 'failed']);

function formatTimestamp(value: string | null) {
  if (!value) return 'Not yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(parsed);
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ');
}

export function SourceList({
  sources,
  selectedId,
  onSelect,
}: {
  sources: OperatorSource[];
  selectedId: string | undefined;
  onSelect: (sourceId: string) => void;
}) {
  return (
    <nav className={styles.sourceList} aria-label="Event sources">
      <h2>Sources</h2>
      {sources.map((source) => (
        <button
          key={source.id}
          type="button"
          aria-current={source.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(source.id)}
        >
          <strong>{source.name}</strong>
          <span>
            {source.city.name} · {formatLabel(source.publication_state)}
          </span>
          <span>
            {formatLabel(source.freshness)}
            {source.active_incident ? ' · incident open' : ''}
          </span>
        </button>
      ))}
    </nav>
  );
}

export function SourceSummary({ source }: { source: OperatorSource }) {
  return (
    <dl className={styles.sourceFacts}>
      <div>
        <dt>Publication</dt>
        <dd>{formatLabel(source.publication_state)}</dd>
      </div>
      <div>
        <dt>Freshness</dt>
        <dd>{formatLabel(source.freshness)}</dd>
      </div>
      <div>
        <dt>Last healthy</dt>
        <dd>{formatTimestamp(source.last_healthy_at)}</dd>
      </div>
      <div>
        <dt>Next due</dt>
        <dd>{formatTimestamp(source.next_due_at)}</dd>
      </div>
      <div>
        <dt>Schema</dt>
        <dd>{source.schema_version}</dd>
      </div>
      <div>
        <dt>Latest run accepted</dt>
        <dd>{source.latest_run?.accepted_count ?? 'No run yet'}</dd>
      </div>
      <div>
        <dt>Latest run quarantined</dt>
        <dd>{source.latest_run?.quarantined_count ?? 'No run yet'}</dd>
      </div>
    </dl>
  );
}

export function IncidentNotice({
  source,
  pending,
  onAcknowledge,
}: {
  source: OperatorSource;
  pending: boolean;
  onAcknowledge: () => void;
}) {
  const incident = source.active_incident;
  if (!incident) return <p className={styles.noIncident}>No open incident</p>;

  return (
    <section className={styles.incident} aria-labelledby="active-incident-title">
      <div>
        <p>Open incident</p>
        <h3 id="active-incident-title">{formatLabel(incident.code)}</h3>
        <p>
          Opened {formatTimestamp(incident.created_at)} · {formatLabel(incident.state)}
        </p>
      </div>
      <ActionButton tone="quiet" disabled={pending} onClick={onAcknowledge}>
        {pending ? 'Acknowledging…' : 'Acknowledge'}
      </ActionButton>
    </section>
  );
}

function RunRow({
  run,
  replaying,
  onReplay,
}: {
  run: CollectionRun;
  replaying: boolean;
  onReplay: (runId: string) => void;
}) {
  return (
    <li className={styles.run}>
      <div className={styles.runHeading}>
        <span className={[styles.status, styles[`status_${run.status}`]].filter(Boolean).join(' ')}>
          {formatLabel(run.status)}
        </span>
        <time dateTime={run.triggered_at}>{formatTimestamp(run.triggered_at)}</time>
      </div>
      <dl className={styles.runFacts}>
        <div>
          <dt>Accepted</dt>
          <dd>{run.accepted_count}</dd>
        </div>
        <div>
          <dt>Quarantined</dt>
          <dd>{run.quarantined_count}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{formatTimestamp(run.completed_at)}</dd>
        </div>
        {run.health_code ? (
          <div>
            <dt>Health</dt>
            <dd>{formatLabel(run.health_code)}</dd>
          </div>
        ) : null}
      </dl>
      {terminalStatuses.has(run.status) ? (
        <ActionButton tone="quiet" disabled={replaying} onClick={() => onReplay(run.id)}>
          {replaying ? 'Queueing replay…' : 'Replay this run'}
        </ActionButton>
      ) : null}
    </li>
  );
}

export function RunList({
  runs,
  replayingId,
  onReplay,
}: {
  runs: CollectionRun[];
  replayingId: string | undefined;
  onReplay: (runId: string) => void;
}) {
  return (
    <ol className={styles.runList}>
      {runs.map((run) => (
        <RunRow key={run.id} run={run} replaying={replayingId === run.id} onReplay={onReplay} />
      ))}
    </ol>
  );
}
