const SOURCE_HOST = 'bangaloreinternationalcentre.org';
const SOURCE_PATH = '/wp-json/tribe/events/v1/events';
const TIMEZONE = 'Asia/Kolkata';
const MAX_RECORDS = 100;
const MAX_PAGES = 2;
const WINDOW_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

const categoryRules = [
  ['books', ['Books', 'Literature', 'Biography', 'Language']],
  ['music', ['Music']],
  ['theatre', ['Performing Arts']],
  [
    'arts',
    [
      'Visual Arts',
      'Architecture',
      'Design',
      'Dance',
      'Film',
      'Experience',
    ],
  ],
  ['community', ['Workshops']],
  [
    'talks',
    [
      'Business',
      'Cities',
      'Climate Change',
      'Defence & security',
      'Development',
      'Environment',
      'Governance',
      'History',
      'Politics',
      'Science',
      'Society',
      'Sustainability',
    ],
  ],
];

function decodeText(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}

function optionalText(value) {
  const text = decodeText(value);
  return text || null;
}

function hasExplicitPort(value) {
  const authority = String(value ?? '').match(/^https:\/\/([^/?#]+)/i)?.[1] ?? '';
  return /:\d+$/.test(authority);
}

function boundedSourceUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    bad_input('BIC input must be a valid URL');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== SOURCE_HOST ||
    url.port ||
    hasExplicitPort(rawUrl) ||
    url.username ||
    url.password ||
    url.pathname !== SOURCE_PATH ||
    url.hash ||
    url.search
  ) {
    bad_input('BIC input must be the bare reviewed official events endpoint');
  }
  return url;
}

function dateInIst(instant) {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function pageUrl(baseUrl, observedAt, page) {
  const url = new URL(baseUrl.toString());
  url.searchParams.set('start_date', `${dateInIst(observedAt)} 00:00:00`);
  url.searchParams.set(
    'end_date',
    `${dateInIst(new Date(observedAt.getTime() + WINDOW_DAYS * DAY_MS))} 23:59:59`,
  );
  url.searchParams.set('per_page', '50');
  url.searchParams.set('page', String(page));
  return url.toString();
}

function responsePayload(response) {
  if (typeof response === 'string') {
    return JSON.parse(response);
  }
  if (response && typeof response === 'object') {
    if (Array.isArray(response.events)) {
      return response;
    }
    if (typeof response.body === 'string') {
      return JSON.parse(response.body);
    }
    if (response.body && typeof response.body === 'object') {
      return response.body;
    }
  }
  throw new Error('BIC returned an unsupported response shape');
}

function categoryFor(categories) {
  const names = new Set(
    (Array.isArray(categories) ? categories : [])
      .map((category) => decodeText(category?.name))
      .filter(Boolean),
  );

  for (const [canonical, sourceNames] of categoryRules) {
    if (sourceNames.some((name) => names.has(name))) {
      return canonical;
    }
  }
  return 'other';
}

function eventUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== SOURCE_HOST ||
    url.port ||
    hasExplicitPort(value) ||
    url.username ||
    url.password
  ) {
    throw new Error('BIC event URL left the canonical host');
  }
  return url.toString();
}

function imageUrl(event) {
  const candidates = [
    event.image?.sizes?.['8-col-4-3-hard']?.url,
    event.image?.sizes?.large?.url,
    event.image?.url,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = new URL(candidate);
    if (url.port || hasExplicitPort(candidate)) {
      throw new Error('BIC image URL contains a port');
    }
    if (
      url.protocol === 'https:' &&
      url.hostname === SOURCE_HOST &&
      !url.username &&
      !url.password
    ) {
      return url.toString();
    }
  }
  return null;
}

function localDate(value) {
  if (!/^\d{4}-\d{2}-\d{2} /.test(value ?? '')) {
    throw new Error('BIC event has an invalid local date');
  }
  return value.slice(0, 10);
}

function utcTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value ?? '')) {
    throw new Error('BIC event has an invalid UTC timestamp');
  }
  return new Date(`${value.replace(' ', 'T')}Z`).toISOString();
}

function venueAddress(venue) {
  if (!venue || typeof venue !== 'object') return null;
  const parts = [venue.address, venue.city, venue.state, venue.zip, venue.country]
    .map(optionalText)
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function canonicalEvent(event, observedAt) {
  const sourceEventId = String(event.id ?? '').trim();
  const title = decodeText(event.title);
  if (!/^\d+$/.test(sourceEventId) || !title || event.timezone !== TIMEZONE) {
    throw new Error('BIC event is missing a stable ID, title, or timezone');
  }
  if (event.status !== 'publish') {
    throw new Error(`Unsupported BIC event status: ${event.status ?? 'missing'}`);
  }

  const allDay = event.all_day === true;
  const startsAt = allDay ? null : utcTimestamp(event.utc_start_date);
  const endsAt = allDay ? null : utcTimestamp(event.utc_end_date);
  if (
    startsAt &&
    endsAt &&
    new Date(endsAt).getTime() < new Date(startsAt).getTime()
  ) {
    throw new Error('BIC event ends before it starts');
  }

  return {
    schema_version: 'event-occurrence/v1',
    source_event_id: sourceEventId,
    source_url: eventUrl(event.url),
    source_host: SOURCE_HOST,
    city_slug: 'bengaluru',
    title,
    category: categoryFor(event.categories),
    start_date: localDate(event.start_date),
    starts_at: startsAt,
    end_date: localDate(event.end_date),
    ends_at: endsAt,
    time_precision: allDay ? 'date' : 'timed',
    timezone: TIMEZONE,
    venue_name: optionalText(event.venue?.venue),
    venue_address: venueAddress(event.venue),
    is_free: null,
    price_min_minor: null,
    price_max_minor: null,
    currency: null,
    registration_url: null,
    registration_state: null,
    status: 'scheduled',
    language: [],
    age_note: null,
    accessibility_note: null,
    image_url: imageUrl(event),
    observed_at: observedAt,
  };
}

function validateRecord(record) {
  if (
    record.title.length > 300 ||
    (record.venue_name && record.venue_name.length > 300) ||
    (record.venue_address && record.venue_address.length > 1000) ||
    record.source_url.length > 2048 ||
    (record.image_url && record.image_url.length > 2048)
  ) {
    throw new Error('BIC event exceeds a canonical field limit');
  }
  return true;
}

const sourceUrl = boundedSourceUrl(input.url);
const observedInstant = new Date(job.created);
if (!Number.isFinite(observedInstant.getTime())) {
  throw new Error('Bright Data job has an invalid creation time');
}

const firstPayload = responsePayload(request(pageUrl(sourceUrl, observedInstant, 1)));
if (!firstPayload || !Array.isArray(firstPayload.events)) {
  throw new Error('BIC response is missing the top-level events array');
}
const totalPages = Number(firstPayload.total_pages);
const expectedTotal = Number(firstPayload.total);
if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > MAX_PAGES) {
  throw new Error('BIC total_pages is outside the reviewed page bound');
}
if (
  !Number.isInteger(expectedTotal) ||
  expectedTotal < 1 ||
  expectedTotal > MAX_RECORDS
) {
  throw new Error('BIC total is outside the reviewed record bound');
}

const events = [...firstPayload.events];
for (let page = 2; page <= totalPages; page += 1) {
  const payload = responsePayload(request(pageUrl(sourceUrl, observedInstant, page)));
  if (
    !payload ||
    !Array.isArray(payload.events) ||
    Number(payload.total_pages) !== totalPages ||
    Number(payload.total) !== expectedTotal
  ) {
    throw new Error('BIC pagination changed during collection');
  }
  events.push(...payload.events);
}

if (events.length !== expectedTotal) {
  throw new Error('BIC collected event count does not match source total');
}

const observedAt = observedInstant.toISOString();
const sourceIds = new Set();
for (const event of events) {
  const sourceId = String(event.id ?? '').trim();
  if (sourceIds.has(sourceId)) {
    throw new Error(`BIC source ID repeated across pages: ${sourceId}`);
  }
  sourceIds.add(sourceId);
  collect(canonicalEvent(event, observedAt), validateRecord);
}
