const ATTA_SOURCE_HOST = "attagalatta.com";
const ATTA_SOURCE_PATH = "/events.php";
const ATTA_SOURCE_URL = `https://${ATTA_SOURCE_HOST}${ATTA_SOURCE_PATH}`;
const ATTA_DETAIL_PATH = "/event_page.php";
const ATTA_IMAGE_PREFIX = "/admin/uploads/events/";
const ATTA_TIMEZONE = "Asia/Kolkata";
const ATTA_WINDOW_DAYS = 90;
const ATTA_MIN_RECORDS = 3;
const ATTA_MAX_RECORDS = 100;
const ATTA_MIN_SOURCE_ROWS = 1000;
const ATTA_MAX_SOURCE_ROWS = 5000;
const ATTA_MIN_RESPONSE_CHARACTERS = 500000;
const ATTA_MAX_RESPONSE_CHARACTERS = 3000000;
const ATTA_SOURCE_KEYS = [
  "resp",
  "Sno",
  "day",
  "month",
  "year",
  "title",
  "subtitle",
  "eventday",
  "host",
  "image",
  "description",
  "link",
  "monthname",
  "eventid",
  "eventstarttime",
];
const ATTA_CANONICAL_KEYS = [
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
const ATTA_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function attaHasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function attaBoundedInput(value) {
  const candidate = value === undefined ? ATTA_SOURCE_URL : value;
  if (typeof candidate !== "string" || candidate.length === 0) {
    bad_input("Atta Galatta input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    bad_input("Atta Galatta input must contain a valid URL");
  }
  if (
    candidate !== ATTA_SOURCE_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== ATTA_SOURCE_HOST ||
    parsed.host !== ATTA_SOURCE_HOST ||
    parsed.pathname !== ATTA_SOURCE_PATH ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    attaHasExplicitPort(candidate)
  ) {
    bad_input("Atta Galatta input must be the bare reviewed JSON URL");
  }
  return ATTA_SOURCE_URL;
}

function attaOwnKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Atta Galatta ${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const reviewed = [...expected].sort();
  if (
    actual.length !== reviewed.length ||
    actual.some((key, index) => key !== reviewed[index])
  ) {
    throw new Error(`Atta Galatta ${label} shape drifted`);
  }
  return value;
}

function attaResponsePayload(value) {
  let payload = value;
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "body")
  ) {
    payload = value.body;
  }
  if (typeof payload === "string") {
    if (
      payload.length < ATTA_MIN_RESPONSE_CHARACTERS ||
      payload.length > ATTA_MAX_RESPONSE_CHARACTERS
    ) {
      throw new Error(
        "Atta Galatta JSON response size left the reviewed boundary",
      );
    }
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new Error("Atta Galatta response is not valid JSON");
    }
  }
  attaOwnKeys(payload, ["resp", "value"], "response");
  if (payload.resp !== true || !Array.isArray(payload.value)) {
    throw new Error("Atta Galatta response is not successful event data");
  }
  if (
    payload.value.length < ATTA_MIN_SOURCE_ROWS ||
    payload.value.length > ATTA_MAX_SOURCE_ROWS
  ) {
    throw new Error("Atta Galatta source row count left the reviewed boundary");
  }
  return payload.value;
}

function attaSourceText(value, label, maximum, required = true) {
  if (typeof value !== "string") {
    throw new Error(`Atta Galatta ${label} must be source text`);
  }
  if ((required && value.length === 0) || value.length > maximum) {
    throw new Error(`Atta Galatta ${label} length left the reviewed boundary`);
  }
  return value;
}

function attaDecodeCodePoint(raw, radix) {
  const value = Number.parseInt(raw, radix);
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  ) {
    throw new Error("Atta Galatta text contains an invalid entity");
  }
  return String.fromCodePoint(value);
}

function attaCanonicalText(value, label, maximum) {
  let text = attaSourceText(value, label, maximum)
    .replace(/&#x([0-9a-f]+);/gi, (_, raw) => attaDecodeCodePoint(raw, 16))
    .replace(/&#([0-9]+);/g, (_, raw) => attaDecodeCodePoint(raw, 10))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (
    text.length === 0 ||
    text.length > maximum ||
    /&(?:#[xX]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/.test(text)
  ) {
    throw new Error(`Atta Galatta ${label} cannot be canonicalized safely`);
  }
  return text;
}

function attaCalendarDate(year, month, day, label) {
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
    !Number.isInteger(year) ||
    year < 1970 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > monthDays[month - 1]
  ) {
    throw new Error(`Atta Galatta ${label} is impossible`);
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
    value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ordinal: era * 146097 + dayOfEra,
    year,
  };
}

function attaObservedBoundary(instant) {
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  const date = attaCalendarDate(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    "observed date",
  );
  return {
    ...date,
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function attaRowDate(row, year) {
  if (!/^(?:[1-9]|[12][0-9]|3[01])$/.test(row.day)) {
    throw new Error("Atta Galatta day format drifted");
  }
  if (!/^(?:[1-9]|1[0-2])$/.test(row.month)) {
    throw new Error("Atta Galatta month format drifted");
  }
  const date = attaCalendarDate(
    year,
    Number(row.month),
    Number(row.day),
    "event date",
  );
  const monthName = ATTA_MONTHS[Number(row.month) - 1];
  const expectedEventDay = `${String(Number(row.day)).padStart(2, "0")} ${monthName} ${year}`;
  if (row.monthname !== monthName || row.eventday !== expectedEventDay) {
    throw new Error("Atta Galatta redundant date fields disagree");
  }
  return date;
}

function attaRowTime(value, date) {
  if (typeof value !== "string") {
    throw new Error("Atta Galatta start time must be source text");
  }
  const match = value.match(/^(0[1-9]|1[0-2]):([0-5][0-9]) (am|pm)$/);
  if (!match) throw new Error("Atta Galatta start time format drifted");
  let hour = Number(match[1]) % 12;
  if (match[3] === "pm") hour += 12;
  const minute = hour * 60 + Number(match[2]);
  return {
    minute,
    value: `${date.value}T${String(hour).padStart(2, "0")}:${match[2]}:00+05:30`,
  };
}

function attaEventId(value) {
  if (typeof value !== "string" || !/^EVT[0-9]+$/.test(value)) {
    throw new Error("Atta Galatta row lacks a reviewed native event ID");
  }
  return value;
}

function attaDetailUrl(value, eventId) {
  if (
    typeof value !== "string" ||
    value !==
      `${ATTA_SOURCE_URL.slice(0, -ATTA_SOURCE_PATH.length)}${ATTA_DETAIL_PATH}?eventid=${eventId}`
  ) {
    throw new Error("Atta Galatta detail URL left the reviewed boundary");
  }
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== ATTA_SOURCE_HOST ||
    parsed.host !== ATTA_SOURCE_HOST ||
    parsed.pathname !== ATTA_DETAIL_PATH ||
    parsed.search !== `?eventid=${eventId}` ||
    parsed.hash !== "" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    attaHasExplicitPort(value)
  ) {
    throw new Error("Atta Galatta detail URL failed canonicalization");
  }
  return value;
}

function attaImageUrl(value) {
  if (typeof value !== "string") {
    throw new Error("Atta Galatta image URL must be source text");
  }
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== ATTA_SOURCE_HOST ||
    parsed.host !== ATTA_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    attaHasExplicitPort(value) ||
    !new RegExp(`^${ATTA_IMAGE_PREFIX}[0-9]+\\.(?:jpe?g|png)$`, "i").test(
      parsed.pathname,
    )
  ) {
    throw new Error("Atta Galatta image URL left the reviewed boundary");
  }
  return value;
}

function attaCanonicalRecord(
  row,
  eventId,
  detailUrl,
  imageUrl,
  date,
  time,
  observedAt,
) {
  if (row.subtitle !== "" || row.host !== "") {
    throw new Error(
      "Atta Galatta current subtype or host needs mapping review",
    );
  }
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: eventId,
    source_url: detailUrl,
    source_host: ATTA_SOURCE_HOST,
    city_slug: "bengaluru",
    title: attaCanonicalText(row.title, "event title", 300),
    category: "other",
    start_date: date.value,
    starts_at: time.value,
    end_date: null,
    ends_at: null,
    time_precision: "timed",
    timezone: ATTA_TIMEZONE,
    venue_name: null,
    venue_address: null,
    is_free: null,
    price_min_minor: null,
    price_max_minor: null,
    currency: null,
    registration_url: null,
    registration_state: null,
    status: "scheduled",
    language: [],
    age_note: null,
    accessibility_note: null,
    image_url: imageUrl,
    observed_at: observedAt,
  };
}

function attaValidateRecord(record) {
  attaOwnKeys(record, ATTA_CANONICAL_KEYS, "canonical record");
  if (
    record.schema_version !== "event-occurrence/v1" ||
    !/^EVT[0-9]+$/.test(record.source_event_id) ||
    record.source_host !== ATTA_SOURCE_HOST ||
    record.city_slug !== "bengaluru" ||
    record.category !== "other" ||
    typeof record.starts_at !== "string" ||
    record.end_date !== null ||
    record.ends_at !== null ||
    record.time_precision !== "timed" ||
    record.timezone !== ATTA_TIMEZONE ||
    record.venue_name !== null ||
    record.venue_address !== null ||
    record.is_free !== null ||
    record.price_min_minor !== null ||
    record.price_max_minor !== null ||
    record.currency !== null ||
    record.registration_url !== null ||
    record.registration_state !== null ||
    record.status !== "scheduled" ||
    !Array.isArray(record.language) ||
    record.language.length !== 0 ||
    record.age_note !== null ||
    record.accessibility_note !== null ||
    typeof record.image_url !== "string" ||
    typeof record.observed_at !== "string"
  ) {
    throw new Error("Atta Galatta record left the reviewed mapping");
  }
  return true;
}

const attaSourceUrl = attaBoundedInput(input?.url);
const attaObservedInstant = new Date(job.created);
if (!Number.isFinite(attaObservedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}
const attaObservedAt = attaObservedInstant.toISOString();
const attaToday = attaObservedBoundary(attaObservedInstant);
const attaHorizonOrdinal = attaToday.ordinal + ATTA_WINDOW_DAYS;
const attaRows = attaResponsePayload(request(attaSourceUrl));
const attaRecords = [];
let attaPreviousStart = null;

for (let index = 0; index < attaRows.length; index += 1) {
  const row = attaOwnKeys(attaRows[index], ATTA_SOURCE_KEYS, "source row");
  if (row.resp !== true || row.Sno !== index) {
    throw new Error("Atta Galatta source sequence is incomplete or reordered");
  }
  const eventId = attaEventId(row.eventid);
  attaSourceText(row.day, "day", 2);
  attaSourceText(row.month, "month", 2);
  attaSourceText(row.year, "year", 4);
  attaSourceText(row.title, "title", 1000);
  attaSourceText(row.subtitle, "subtitle", 300, false);
  attaSourceText(row.eventday, "event day", 20);
  attaSourceText(row.host, "host", 300, false);
  attaSourceText(row.description, "description", 2000, false);
  attaSourceText(row.link, "detail URL", 1000);
  attaSourceText(row.image, "image URL", 1000);
  attaSourceText(row.monthname, "month name", 3);
  attaSourceText(row.eventstarttime, "start time", 8);

  if (
    row.year !== String(attaToday.year) &&
    row.year !== String(attaToday.year + 1)
  ) {
    continue;
  }
  const date = attaRowDate(row, Number(row.year));
  const time = attaRowTime(row.eventstarttime, date);
  const insideDateHorizon =
    date.ordinal >= attaToday.ordinal && date.ordinal <= attaHorizonOrdinal;
  const notAlreadyStarted =
    date.ordinal > attaToday.ordinal || time.minute >= attaToday.minute;
  if (!insideDateHorizon || !notAlreadyStarted) continue;

  const detailUrl = attaDetailUrl(row.link, eventId);
  const imageUrl = attaImageUrl(row.image);
  const startOrder = date.ordinal * 1440 + time.minute;
  if (attaPreviousStart !== null && startOrder < attaPreviousStart) {
    throw new Error("Atta Galatta eligible rows are not chronological");
  }
  attaPreviousStart = startOrder;
  attaRecords.push(
    attaCanonicalRecord(
      row,
      eventId,
      detailUrl,
      imageUrl,
      date,
      time,
      attaObservedAt,
    ),
  );
}

if (
  attaRecords.length < ATTA_MIN_RECORDS ||
  attaRecords.length > ATTA_MAX_RECORDS
) {
  throw new Error(
    "Atta Galatta eligible record count left the reviewed boundary",
  );
}
const attaEventIds = new Set();
for (const record of attaRecords) {
  attaValidateRecord(record);
  if (attaEventIds.has(record.source_event_id)) {
    throw new Error("Atta Galatta repeated an eligible native event ID");
  }
  attaEventIds.add(record.source_event_id);
}
for (const record of attaRecords) {
  collect(record, attaValidateRecord);
}
