import type { components, operations } from '../api/schema.generated';

export type OperatorSource = components['schemas']['OperatorSource'];
export type CollectionRun = components['schemas']['CollectionRun'];
export type Incident = components['schemas']['Incident'];

type OperatorSourceList =
  operations['listOperatorSources']['responses'][200]['content']['application/json'];
type CollectionRunList =
  operations['listCollectionRuns']['responses'][200]['content']['application/json'];
type Problem = components['schemas']['Problem'];

type RequestOptions = {
  token: string;
  method?: 'GET' | 'POST';
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export class OperatorProblem extends Error {
  readonly code: string;
  readonly status: number;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'OperatorProblem';
    this.code = problem.code;
    this.status = problem.status;
  }
}

const apiOrigin = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isProblem(value: unknown): value is Problem {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'number' &&
    typeof value.code === 'string'
  );
}

async function operatorRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${options.token}`,
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const response = await fetch(`${apiOrigin}${path}`, {
    method: options.method ?? 'GET',
    headers,
    cache: 'no-store',
    credentials: 'same-origin',
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isProblem(payload)) throw new OperatorProblem(payload);
    throw new OperatorProblem({
      type: 'about:blank',
      title: 'The operator request failed',
      status: response.status,
      code: 'unexpected_operator_response',
    });
  }

  if (payload === null) {
    throw new OperatorProblem({
      type: 'about:blank',
      title: 'The operator service returned an empty response',
      status: 502,
      code: 'empty_operator_response',
    });
  }

  return payload as T;
}

export function listOperatorSources(token: string, signal?: AbortSignal) {
  return operatorRequest<OperatorSourceList>('/v1/operator/sources', {
    token,
    ...(signal ? { signal } : {}),
  });
}

export function listCollectionRuns(token: string, sourceId: string, signal?: AbortSignal) {
  return operatorRequest<CollectionRunList>(
    `/v1/operator/sources/${encodeURIComponent(sourceId)}/runs`,
    { token, ...(signal ? { signal } : {}) },
  );
}

export function triggerCollection(token: string, sourceId: string, idempotencyKey: string) {
  return operatorRequest<CollectionRun>(
    `/v1/operator/sources/${encodeURIComponent(sourceId)}/runs`,
    { token, method: 'POST', idempotencyKey },
  );
}

export function replayCollection(token: string, runId: string, idempotencyKey: string) {
  return operatorRequest<CollectionRun>(`/v1/operator/runs/${encodeURIComponent(runId)}/replay`, {
    token,
    method: 'POST',
    idempotencyKey,
  });
}

export function acknowledgeIncident(token: string, incidentId: string) {
  return operatorRequest<Incident>(
    `/v1/operator/incidents/${encodeURIComponent(incidentId)}/acknowledge`,
    { token, method: 'POST' },
  );
}
