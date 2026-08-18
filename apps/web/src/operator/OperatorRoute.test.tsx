import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { CollectionRun, OperatorSource } from './api';
import OperatorRoute from './OperatorRoute';

const source: OperatorSource = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'bic',
  name: 'Bangalore International Centre',
  official_url: 'https://bangaloreinternationalcentre.org/',
  city: {
    slug: 'bengaluru',
    name: 'Bengaluru',
    timezone: 'Asia/Kolkata',
    accent: 'rain',
  },
  freshness: 'fresh',
  last_healthy_at: '2026-08-18T12:00:00Z',
  collector_id: 'c_private-collector',
  schema_version: 'event-occurrence/v1',
  publication_state: 'active',
  next_due_at: '2026-08-19T03:00:00Z',
  latest_run: null,
  active_incident: null,
};

const publishedRun: CollectionRun = {
  id: '22222222-2222-4222-8222-222222222222',
  source_id: source.id,
  external_collection_id: 'private-external-id',
  status: 'published',
  triggered_at: '2026-08-18T10:00:00Z',
  completed_at: '2026-08-18T10:05:00Z',
  accepted_count: 17,
  quarantined_count: 0,
  health_code: null,
};

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
    }),
  );
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function successfulFetch() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = requestPath(input);
    if (path === '/v1/operator/sources' && (init?.method ?? 'GET') === 'GET') {
      return jsonResponse({ items: [source] });
    }
    if (path.endsWith(`/sources/${source.id}/runs`) && init?.method === 'POST') {
      return jsonResponse({ ...publishedRun, status: 'queued', completed_at: null }, 202);
    }
    if (path.endsWith(`/sources/${source.id}/runs`)) {
      return jsonResponse({ items: [publishedRun] });
    }
    return jsonResponse({ items: [] });
  });
}

function renderOperator() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/operator']}>
        <OperatorRoute />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function enterToken(token: string) {
  fireEvent.change(screen.getByLabelText('Operator token'), { target: { value: token } });
  fireEvent.click(screen.getByRole('button', { name: 'Open operations' }));
}

describe('OperatorRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the operator token out of browser persistence and the URL', async () => {
    vi.stubGlobal('fetch', successfulFetch());
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const token = 'operator-token-that-stays-in-memory';

    renderOperator();
    enterToken(token);

    expect(
      await screen.findByRole('heading', { name: 'Bangalore International Centre' }),
    ).toBeVisible();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(token);
    expect(document.body).not.toHaveTextContent(token);
  });

  it('returns to token entry after an unauthorized response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        jsonResponse(
          {
            type: 'about:blank',
            title: 'Operator authentication failed',
            status: 401,
            code: 'operator_auth_invalid',
          },
          401,
        ),
      ),
    );

    renderOperator();
    enterToken('incorrect-operator-token');

    expect(await screen.findByRole('alert')).toHaveTextContent(/token was not accepted/i);
    expect(screen.getByLabelText('Operator token')).toBeVisible();
  });

  it('renders source health and queues a manual run with bearer auth and idempotency', async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal('fetch', fetchMock);

    renderOperator();
    enterToken('valid-operator-token');

    expect(
      await screen.findByRole('heading', { name: 'Bangalore International Centre' }),
    ).toBeVisible();
    expect(screen.getByText('event-occurrence/v1')).toBeVisible();
    expect(screen.getByText('No open incident')).toBeVisible();
    expect(screen.getByText('Latest run accepted')).toBeVisible();
    expect(screen.getByText('Latest run quarantined')).toBeVisible();
    expect(screen.queryByText('c_private-collector')).not.toBeInTheDocument();
    expect(screen.queryByText('private-external-id')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run collection now' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/collection run is queued/i);

    const sourceRequest = fetchMock.mock.calls.find(
      ([path, init]) => requestPath(path) === '/v1/operator/sources' && init?.method === 'GET',
    );
    expect(new Headers(sourceRequest?.[1]?.headers).get('Authorization')).toBe(
      'Bearer valid-operator-token',
    );

    const triggerRequest = fetchMock.mock.calls.find(
      ([path, init]) =>
        requestPath(path).endsWith(`/sources/${source.id}/runs`) && init?.method === 'POST',
    );
    expect(new Headers(triggerRequest?.[1]?.headers).get('Idempotency-Key')).toMatch(
      /^baahar-trigger-/,
    );
  });
});
