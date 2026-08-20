const UPISACON_SOURCE_URL = "https://upisaconvaranasi2026.com/workshops";
const UPISACON_SOURCE_HOST = "upisaconvaranasi2026.com";
const UPISACON_REGISTRATION_URL =
  "https://registration.upisaconvaranasi2026.com/user/login";
const UPISACON_EVENT_DATE = "2026-10-02";
const UPISACON_VENUE = "Skill Center, Trauma Center, IMS BHU, Varanasi";
const UPISACON_TIMEZONE = "Asia/Kolkata";
const UPISACON_WINDOW_DAYS = 90;
const UPISACON_EXPECTED_TITLES = [
  "POCUS",
  "Regional Anesthesia",
  "Mechanical Ventilation",
  "Airway Management",
  "ECMO",
  "Advance Trauma Nursing Course",
  "Basic Trauma Nursing Course",
];
const UPISACON_EXPECTED_RULES = [
  "• 30 seats per workshop — first come, first served",
  "• One delegate may register for only one workshop",
  "• Select your preferred workshop during conference registration",
];
const UPISACON_CANONICAL_KEYS = [
  "schema_version",
  "source_event_id",
  "source_url",
  "source_host",
  "city_slug",
  "title",
  "category",
  "start_date",
  "starts_at",
  "end_date",
  "ends_at",
  "time_precision",
  "timezone",
  "venue_name",
  "venue_address",
  "is_free",
  "price_min_minor",
  "price_max_minor",
  "currency",
  "registration_url",
  "registration_state",
  "status",
  "language",
  "age_note",
  "accessibility_note",
  "image_url",
  "observed_at",
];

function upisaconBoundedSourceUrl(value) {
  if (value === undefined) return UPISACON_SOURCE_URL;
  if (typeof value !== "string" || value.length === 0) {
    bad_input("UPISACON input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    bad_input("UPISACON input must contain a valid URL");
  }
  if (
    value !== UPISACON_SOURCE_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== UPISACON_SOURCE_HOST ||
    parsed.host !== UPISACON_SOURCE_HOST ||
    parsed.pathname !== "/workshops" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    bad_input("UPISACON input must be the bare reviewed workshop URL");
  }
  return UPISACON_SOURCE_URL;
}

function upisaconCalendarDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("UPISACON event date is not an ISO date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    year < 1970 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1]
  ) {
    throw new Error("UPISACON event date is impossible");
  }
  const shiftedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return {
    value: `${match[1]}-${match[2]}-${match[3]}`,
    ordinal: era * 146097 + dayOfEra,
  };
}

function upisaconObservedLocalOrdinal(instant) {
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  const year = String(local.getUTCFullYear()).padStart(4, "0");
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return upisaconCalendarDate(`${year}-${month}-${day}`).ordinal;
}

function upisaconValidatePage(value) {
  const expectedKeys = [
    "heading",
    "subtitle",
    "cards",
    "rules",
    "registration_links",
  ];
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some(
      (key) => !Object.prototype.hasOwnProperty.call(value, key),
    )
  ) {
    throw new Error("UPISACON parser returned an unexpected shape");
  }
  if (
    value.heading !== "Pre-Conference Workshops" ||
    value.subtitle !== `2nd October, 2026 • ${UPISACON_VENUE}`
  ) {
    throw new Error("UPISACON heading, date, or venue drifted");
  }
  if (!Array.isArray(value.cards) || value.cards.length !== 7) {
    throw new Error("UPISACON workshop card count drifted");
  }
  for (let index = 0; index < value.cards.length; index += 1) {
    const card = value.cards[index];
    const expectedLabel = `WORKSHOP ${String.fromCharCode(65 + index)}`;
    const expectedTitle = UPISACON_EXPECTED_TITLES[index];
    if (
      card === null ||
      typeof card !== "object" ||
      Array.isArray(card) ||
      Object.keys(card).length !== 2 ||
      card.label !== expectedLabel ||
      card.title !== expectedTitle
    ) {
      throw new Error(
        `UPISACON workshop ${index + 1} drifted: expected ${JSON.stringify({ label: expectedLabel, title: expectedTitle })}, received ${JSON.stringify(card)}`,
      );
    }
  }
  if (
    !Array.isArray(value.rules) ||
    value.rules.length !== UPISACON_EXPECTED_RULES.length ||
    value.rules.some((rule, index) => rule !== UPISACON_EXPECTED_RULES[index])
  ) {
    throw new Error("UPISACON registration rules drifted");
  }
  if (
    !Array.isArray(value.registration_links) ||
    value.registration_links.length !== 2 ||
    value.registration_links[0]?.text !== "Registration" ||
    value.registration_links[1]?.text !== "Book Now" ||
    value.registration_links.some(
      (link) => link.href !== UPISACON_REGISTRATION_URL,
    )
  ) {
    throw new Error("UPISACON registration link boundary drifted");
  }
  return value;
}

function upisaconCanonicalRecord(title, observedAt) {
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: null,
    source_url: UPISACON_SOURCE_URL,
    source_host: UPISACON_SOURCE_HOST,
    city_slug: "varanasi",
    title,
    category: "workshops",
    start_date: UPISACON_EVENT_DATE,
    starts_at: null,
    end_date: UPISACON_EVENT_DATE,
    ends_at: null,
    time_precision: "date",
    timezone: UPISACON_TIMEZONE,
    venue_name: UPISACON_VENUE,
    venue_address: null,
    is_free: null,
    price_min_minor: null,
    price_max_minor: null,
    currency: null,
    registration_url: UPISACON_REGISTRATION_URL,
    registration_state: null,
    status: "scheduled",
    language: [],
    age_note: null,
    accessibility_note: null,
    image_url: null,
    observed_at: observedAt,
  };
}

function upisaconIdentity(record) {
  const normalizedTitle = record.title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const normalizedVenue = record.venue_name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return [
    normalizedTitle,
    record.source_url,
    record.start_date,
    normalizedVenue,
  ].join("\u001f");
}

function upisaconValidateRecord(record) {
  if (
    Object.keys(record).length !== UPISACON_CANONICAL_KEYS.length ||
    UPISACON_CANONICAL_KEYS.some(
      (key) => !Object.prototype.hasOwnProperty.call(record, key),
    )
  ) {
    throw new Error("UPISACON record does not have the canonical key set");
  }
  if (
    !UPISACON_EXPECTED_TITLES.includes(record.title) ||
    record.schema_version !== "event-occurrence/v1" ||
    record.source_event_id !== null ||
    record.source_url !== UPISACON_SOURCE_URL ||
    record.source_host !== UPISACON_SOURCE_HOST ||
    record.city_slug !== "varanasi" ||
    record.category !== "workshops" ||
    record.start_date !== UPISACON_EVENT_DATE ||
    record.starts_at !== null ||
    record.end_date !== UPISACON_EVENT_DATE ||
    record.ends_at !== null ||
    record.time_precision !== "date" ||
    record.timezone !== UPISACON_TIMEZONE ||
    record.venue_name !== UPISACON_VENUE ||
    record.venue_address !== null ||
    record.is_free !== null ||
    record.price_min_minor !== null ||
    record.price_max_minor !== null ||
    record.currency !== null ||
    record.registration_url !== UPISACON_REGISTRATION_URL ||
    record.registration_state !== null ||
    record.status !== "scheduled" ||
    !Array.isArray(record.language) ||
    record.language.length !== 0 ||
    record.age_note !== null ||
    record.accessibility_note !== null ||
    record.image_url !== null ||
    typeof record.observed_at !== "string"
  ) {
    throw new Error("UPISACON record left the reviewed mapping");
  }
  return true;
}

const upisaconInputUrl = upisaconBoundedSourceUrl(input?.url);
const upisaconObservedInstant = new Date(job.created);
if (!Number.isFinite(upisaconObservedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}
const upisaconObservedAt = upisaconObservedInstant.toISOString();
const upisaconObservedOrdinal = upisaconObservedLocalOrdinal(
  upisaconObservedInstant,
);
const upisaconEvent = upisaconCalendarDate(UPISACON_EVENT_DATE);
const upisaconDistance = upisaconEvent.ordinal - upisaconObservedOrdinal;
if (upisaconDistance < 0 || upisaconDistance > UPISACON_WINDOW_DAYS) {
  throw new Error("UPISACON has no occurrence in the current horizon");
}

navigate(upisaconInputUrl, {
  wait_until: "networkidle0",
  timeout: 30000,
});
if (status_code() !== 200) {
  throw new Error("UPISACON navigation did not return HTTP 200");
}
if (location.href !== UPISACON_SOURCE_URL) {
  throw new Error("UPISACON navigation left the reviewed URL");
}

const upisaconPage = upisaconValidatePage(parse());
const upisaconRecords = upisaconPage.cards.map((card) =>
  upisaconCanonicalRecord(card.title, upisaconObservedAt),
);
if (upisaconRecords.length !== 7) {
  throw new Error("UPISACON canonical record count drifted");
}

const upisaconIdentities = new Set();
for (const record of upisaconRecords) {
  upisaconValidateRecord(record);
  const identity = upisaconIdentity(record);
  if (upisaconIdentities.has(identity)) {
    throw new Error("UPISACON repeated a fallback occurrence identity");
  }
  upisaconIdentities.add(identity);
}
for (const record of upisaconRecords) {
  collect(record, upisaconValidateRecord);
}
