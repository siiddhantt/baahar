const BHU_LIST_URL =
  "https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming";
const BHU_API_URL = "https://www.bhu.ac.in/Homepage/GetAcademicEvents";
const BHU_SOURCE_HOST = "www.bhu.ac.in";
const BHU_API_BODY = '{obj:{"Action":4,"UnitId":"2"}}';
const BHU_TIMEZONE = "Asia/Kolkata";
const BHU_WINDOW_DAYS = 90;
const BHU_MIN_RECORDS = 3;
const BHU_MAX_RECORDS = 20;
const BHU_MAX_SOURCE_ROWS = 1000;
const BHU_MIN_RESPONSE_CHARACTERS = 1000000;
const BHU_MAX_RESPONSE_CHARACTERS = 4000000;
const BHU_CANONICAL_KEYS = [
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
const BHU_MONTHS = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function bhuBoundedInput(value) {
  if (value === undefined) return BHU_LIST_URL;
  if (typeof value !== "string" || value.length === 0) {
    bad_input("BHU input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    bad_input("BHU input must contain a valid URL");
  }
  if (
    value !== BHU_LIST_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== BHU_SOURCE_HOST ||
    parsed.host !== BHU_SOURCE_HOST ||
    parsed.pathname !== "/Site/EventsList/1_2_16_Main" ||
    parsed.search !== "?Upcoming" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== ""
  ) {
    bad_input("BHU input must be the reviewed upcoming-events URL");
  }
  return BHU_LIST_URL;
}

function bhuOwnKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`BHU ${label} must be an object`);
  }
  const keys = Object.keys(value).sort();
  const sorted = [...expected].sort();
  if (
    keys.length !== sorted.length ||
    keys.some((key, index) => key !== sorted[index])
  ) {
    throw new Error(`BHU ${label} shape drifted`);
  }
  return value;
}

function bhuDecodeCodePoint(raw, radix) {
  const value = Number.parseInt(raw, radix);
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  ) {
    throw new Error("BHU source text contains an invalid entity");
  }
  return String.fromCodePoint(value);
}

function bhuText(value, label, maximum) {
  if (typeof value !== "string") {
    throw new Error(`BHU ${label} must be source text`);
  }
  let text = value
    .replace(/&#x([0-9a-f]+);/gi, (_, raw) => bhuDecodeCodePoint(raw, 16))
    .replace(/&#([0-9]+);/g, (_, raw) => bhuDecodeCodePoint(raw, 10))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (/&(?:#[xX]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/.test(text)) {
    throw new Error(`BHU ${label} contains an unsupported entity`);
  }
  if (text.length === 0 || text.length > maximum) {
    throw new Error(`BHU ${label} length is outside the reviewed boundary`);
  }
  return text;
}

function bhuCalendarDate(year, month, day, label) {
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
    throw new Error(`BHU ${label} is impossible`);
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
  };
}

function bhuSourceDate(value, label) {
  if (typeof value !== "string") {
    throw new Error(`BHU ${label} must be a source date`);
  }
  const match = value
    .trim()
    .match(/^(\d{2})(?:-| )([A-Z][a-z]{2})(?:-| )(\d{4})$/);
  if (!match || !BHU_MONTHS[match[2]]) {
    throw new Error(`BHU ${label} format drifted`);
  }
  return bhuCalendarDate(
    Number(match[3]),
    BHU_MONTHS[match[2]],
    Number(match[1]),
    label,
  );
}

function bhuObservedOrdinal(instant) {
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  return bhuCalendarDate(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    "observed date",
  ).ordinal;
}

function bhuSourceTime(value, date, label) {
  if (typeof value !== "string") {
    throw new Error(`BHU ${label} must be a source time`);
  }
  const match = value.trim().match(/^(0[1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/);
  if (!match) throw new Error(`BHU ${label} format drifted`);
  let hour = Number(match[1]) % 12;
  if (match[3] === "PM") hour += 12;
  return {
    minute: hour * 60 + Number(match[2]),
    value: `${date}T${String(hour).padStart(2, "0")}:${match[2]}:00+05:30`,
  };
}

function bhuCategory(title) {
  if (/\b(?:workshops?|summer schools?)\b/i.test(title)) return "workshops";
  if (/\b(?:seminar|conference|conclave)\b/i.test(title)) return "talks";
  return "other";
}

function bhuRegistrationUrl(details) {
  if (details === null || details === undefined || details === "") return null;
  if (typeof details !== "string" || details.length > 10000) {
    throw new Error("BHU event details left the reviewed boundary");
  }
  const explicitlyRegistration = /registration\s+link\s*:/i.test(details);
  const links = details.match(/https:\/\/forms\.gle\/[A-Za-z0-9]+/g) ?? [];
  const unique = [...new Set(links)];
  if (!explicitlyRegistration) {
    if (unique.length !== 0) {
      throw new Error("BHU form link lacks an explicit registration label");
    }
    return null;
  }
  if (unique.length !== 1) {
    throw new Error("BHU explicit registration link is missing or ambiguous");
  }
  const parsed = new URL(unique[0]);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "forms.gle" ||
    parsed.host !== "forms.gle" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    !/^\/[A-Za-z0-9]+$/.test(parsed.pathname)
  ) {
    throw new Error("BHU registration URL left the reviewed host boundary");
  }
  return unique[0];
}

function bhuDetailUrl(sourceEventId) {
  const value = `https://www.bhu.ac.in/Site/EventDetails/1_2_16_Main?Upcoming&${sourceEventId}`;
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== BHU_SOURCE_HOST ||
    parsed.host !== BHU_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.pathname !== "/Site/EventDetails/1_2_16_Main" ||
    parsed.search !== `?Upcoming&${sourceEventId}` ||
    parsed.hash !== ""
  ) {
    throw new Error("BHU detail URL left the reviewed boundary");
  }
  return value;
}

function bhuResponsePayload(value) {
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
      payload.length < BHU_MIN_RESPONSE_CHARACTERS ||
      payload.length > BHU_MAX_RESPONSE_CHARACTERS
    ) {
      throw new Error("BHU API response size left the reviewed boundary");
    }
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new Error("BHU API response is not valid JSON");
    }
  }
  bhuOwnKeys(payload, ["Table", "Table1"], "API response");
  if (
    !Array.isArray(payload.Table) ||
    payload.Table.length < 1 ||
    payload.Table.length > 200
  ) {
    throw new Error("BHU month metadata count left the reviewed boundary");
  }
  if (
    !Array.isArray(payload.Table1) ||
    payload.Table1.length < 1 ||
    payload.Table1.length > BHU_MAX_SOURCE_ROWS
  ) {
    throw new Error("BHU source row count left the reviewed boundary");
  }
  return payload.Table1;
}

function bhuOptionalTime(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`BHU ${label} has an unsupported type`);
  }
  const text = value.trim();
  return text === "" ? null : text;
}

function bhuCanonicalRecord(row, sourceEventId, start, end, observedAt) {
  const title = bhuText(row.EventName, "event title", 300);
  const venueName = bhuText(row.Location, "event location", 300);
  const startRaw = bhuOptionalTime(row.EventStartTime, "start time");
  const endRaw = bhuOptionalTime(row.EventEndTime, "end time");
  if ((startRaw === null) !== (endRaw === null)) {
    throw new Error("BHU event has only one time boundary");
  }
  let startsAt = null;
  let endsAt = null;
  let precision = "date";
  if (startRaw !== null) {
    const startTime = bhuSourceTime(startRaw, start.value, "start time");
    const endTime = bhuSourceTime(endRaw, end.value, "end time");
    if (
      end.ordinal < start.ordinal ||
      (end.ordinal === start.ordinal && endTime.minute <= startTime.minute)
    ) {
      throw new Error("BHU event end does not follow its start");
    }
    startsAt = startTime.value;
    endsAt = endTime.value;
    precision = "timed";
  } else if (end.ordinal < start.ordinal) {
    throw new Error("BHU event end date precedes its start date");
  }
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: sourceEventId,
    source_url: bhuDetailUrl(sourceEventId),
    source_host: BHU_SOURCE_HOST,
    city_slug: "varanasi",
    title,
    category: bhuCategory(title),
    start_date: start.value,
    starts_at: startsAt,
    end_date: end.value,
    ends_at: endsAt,
    time_precision: precision,
    timezone: BHU_TIMEZONE,
    venue_name: venueName,
    venue_address: null,
    is_free: null,
    price_min_minor: null,
    price_max_minor: null,
    currency: null,
    registration_url: bhuRegistrationUrl(row.AcademicEventsDetails),
    registration_state: null,
    status: "scheduled",
    language: [],
    age_note: null,
    accessibility_note: null,
    image_url: null,
    observed_at: observedAt,
  };
}

function bhuValidateRecord(record) {
  bhuOwnKeys(record, BHU_CANONICAL_KEYS, "canonical record");
  if (
    record.schema_version !== "event-occurrence/v1" ||
    !/^[1-9][0-9]*$/.test(record.source_event_id) ||
    record.source_host !== BHU_SOURCE_HOST ||
    record.city_slug !== "varanasi" ||
    !["talks", "workshops", "other"].includes(record.category) ||
    record.timezone !== BHU_TIMEZONE ||
    record.venue_address !== null ||
    record.is_free !== null ||
    record.price_min_minor !== null ||
    record.price_max_minor !== null ||
    record.currency !== null ||
    record.registration_state !== null ||
    record.status !== "scheduled" ||
    !Array.isArray(record.language) ||
    record.language.length !== 0 ||
    record.age_note !== null ||
    record.accessibility_note !== null ||
    record.image_url !== null ||
    typeof record.observed_at !== "string"
  ) {
    throw new Error("BHU record left the reviewed mapping");
  }
  return true;
}

bhuBoundedInput(input?.url);
const bhuObservedInstant = new Date(job.created);
if (!Number.isFinite(bhuObservedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}
const bhuObservedAt = bhuObservedInstant.toISOString();
const bhuObservedDateOrdinal = bhuObservedOrdinal(bhuObservedInstant);

const bhuSourceRows = bhuResponsePayload(
  request({
    url: BHU_API_URL,
    method: "POST",
    headers: { "content-type": "application/json; charset=UTF-8" },
    body: BHU_API_BODY,
  }),
);
const bhuUpcomingIds = new Set();
const bhuRecords = [];

for (const row of bhuSourceRows) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("BHU source row is not an object");
  }
  if (row.EventType !== "Upcoming") continue;
  const sourceEventId = String(row.AcademicEventsId);
  if (!/^[1-9][0-9]*$/.test(sourceEventId)) {
    throw new Error("BHU upcoming row lacks a native positive event ID");
  }
  if (bhuUpcomingIds.has(sourceEventId)) {
    throw new Error("BHU repeated an upcoming native event ID");
  }
  bhuUpcomingIds.add(sourceEventId);
  const start = bhuSourceDate(row.EventFromDate, "start date");
  const end = bhuSourceDate(row.EventToDate, "end date");
  if (end.ordinal < start.ordinal) {
    throw new Error("BHU event end date precedes its start date");
  }
  const withinHorizon =
    start.ordinal >= bhuObservedDateOrdinal &&
    start.ordinal <= bhuObservedDateOrdinal + BHU_WINDOW_DAYS;
  const publicAudience = row.OpenTo === "All";
  const sourceLocation =
    typeof row.Location === "string"
      ? row.Location.replace(/&nbsp;/gi, " ")
      : "";
  const inVaranasi = /\bVaranasi\b/i.test(sourceLocation);
  if (!withinHorizon || !publicAudience || !inVaranasi) continue;
  bhuRecords.push(
    bhuCanonicalRecord(row, sourceEventId, start, end, bhuObservedAt),
  );
}

if (
  bhuRecords.length < BHU_MIN_RECORDS ||
  bhuRecords.length > BHU_MAX_RECORDS
) {
  throw new Error("BHU eligible record count left the reviewed boundary");
}
const bhuRecordIds = new Set();
for (const record of bhuRecords) {
  bhuValidateRecord(record);
  if (bhuRecordIds.has(record.source_event_id)) {
    throw new Error("BHU repeated a canonical native event ID");
  }
  bhuRecordIds.add(record.source_event_id);
}
for (const record of bhuRecords) {
  collect(record, bhuValidateRecord);
}
