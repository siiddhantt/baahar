import type { components, operations } from './schema.generated';

export type City = components['schemas']['City'];
export type CitySlug = components['schemas']['CitySlug'];
export type EventCategory = components['schemas']['Category'];
export type EventChange = components['schemas']['EventChange'];
export type EventDetail = components['schemas']['EventDetail'];
export type EventPage = components['schemas']['EventPage'];
export type EventSummary = components['schemas']['EventSummary'];
export type AskResult = components['schemas']['AskResult'];
export type TimeWindow = components['schemas']['TimeWindow'];
export type ListEventsQuery = operations['listEvents']['parameters']['query'];

type CityList = { items: City[] };
type ChangeList = { items: EventChange[] };
type Problem = components['schemas']['Problem'];

export class ApiProblem extends Error {
  readonly code: string;
  readonly status: number;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiProblem';
    this.code = problem.code;
    this.status = problem.status;
  }
}

const apiOrigin = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? '';

function apiPath(path: string) {
  return `${apiOrigin}${path}`;
}

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

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiPath(path), {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isProblem(payload)) throw new ApiProblem(payload);
    throw new ApiProblem({
      type: 'about:blank',
      title: 'Could not load this page',
      status: response.status,
      code: 'unexpected_response',
    });
  }

  if (payload === null) {
    throw new ApiProblem({
      type: 'about:blank',
      title: 'The server returned an empty response',
      status: 502,
      code: 'empty_response',
    });
  }

  return payload as T;
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiPath(path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isProblem(payload)) throw new ApiProblem(payload);
    throw new ApiProblem({
      type: 'about:blank',
      title: 'Could not complete that request',
      status: response.status,
      code: 'unexpected_response',
    });
  }
  if (payload === null) {
    throw new ApiProblem({
      type: 'about:blank',
      title: 'The server returned an empty response',
      status: 502,
      code: 'empty_response',
    });
  }
  return payload as T;
}

export function listCities(signal?: AbortSignal) {
  return requestJson<CityList>('/v1/cities', signal);
}

export function listEvents(query: ListEventsQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ city: query.city });

  if (query.window) params.set('window', query.window);
  if (query.category?.length) params.set('category', query.category.join(','));
  if (query.free) params.set('free', 'true');
  if (query.venue) params.set('venue', query.venue);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));

  return requestJson<EventPage>(`/v1/events?${params.toString()}`, signal);
}

export function askBaahar(city: CitySlug, query: string, signal?: AbortSignal) {
  return postJson<AskResult>('/v1/ask', { city, query }, signal);
}

export function getEvent(occurrenceId: string, signal?: AbortSignal) {
  return requestJson<EventDetail>(`/v1/events/${encodeURIComponent(occurrenceId)}`, signal);
}

export function listEventChanges(occurrenceId: string, signal?: AbortSignal) {
  return requestJson<ChangeList>(`/v1/events/${encodeURIComponent(occurrenceId)}/changes`, signal);
}

export function calendarUrl(occurrenceId: string) {
  return apiPath(`/v1/events/${encodeURIComponent(occurrenceId)}.ics`);
}
