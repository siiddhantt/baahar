const PT_SOURCE_HOST = "prithvitheatre.org";
const PT_SOURCE_URL = "https://prithvitheatre.org/booktickets";
const PT_API_URL =
  "https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV";
const PT_REGISTRATION_HOST = "in.bookmyshow.com";
const PT_IMAGE_HOST = "in.bmscdn.com";
const PT_CITY = "mumbai";
const PT_TIMEZONE = "Asia/Kolkata";
const PT_WINDOW_DAYS = 90;
const PT_MIN_RECORDS = 3;
const PT_MAX_RECORDS = 100;
const PT_MIN_RESPONSE_CHARACTERS = 5000;
const PT_MAX_RESPONSE_CHARACTERS = 500000;
const PT_ADDRESS =
  "20 Janki Kutir, Juhu Church Road, Mumbai, Maharashtra 400049, India";
const PT_VENUES = {
  PHTV: {
    name: "Prithvi House: Juhu, Mumbai",
    screen: "Prithvi House",
  },
  PRCE: {
    name: "Prithvi Cafe: Juhu, Mumbai.",
    screen: "Prithvi Cafe",
  },
  PTHV: {
    name: "Prithvi Theatre",
    screen: "Prithvi Theatre",
  },
};
const PT_CATEGORY_MAP = {
  "Drama,Theatre": "theatre",
  "Drama,Storytelling": "theatre",
  "Music Shows": "music",
  Performances: "arts",
  Screening: "arts",
  Talks: "talks",
};
const PT_CANONICAL_KEYS = [
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

function ptCleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function ptText(value, label, maximum, required = true) {
  const text = ptCleanText(value);
  if ((required && !text) || text.length > maximum) {
    throw new Error(`Prithvi ${label} left the reviewed text boundary`);
  }
  return text;
}

function ptObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Prithvi ${label} must be an object`);
  }
  return value;
}

function ptArray(value, label, minimum, maximum) {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new Error(`Prithvi ${label} count left the reviewed boundary`);
  }
  return value;
}

function ptRejectPagination(value, label) {
  for (const key of Object.keys(ptObject(value, label))) {
    if (
      /^(?:next|previous|page|pages|page_count|total_pages|cursor|pagination)$/i.test(
        key,
      )
    ) {
      throw new Error("Prithvi response requires pagination review");
    }
  }
}

function ptHasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function ptBoundedInput(value) {
  const candidate = value === undefined ? PT_API_URL : value;
  if (typeof candidate !== "string" || !candidate) {
    bad_input("Prithvi input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    bad_input("Prithvi input must contain a valid URL");
  }
  if (
    candidate !== PT_API_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== PT_SOURCE_HOST ||
    parsed.host !== PT_SOURCE_HOST ||
    parsed.pathname !== "/api/getPrithviData" ||
    parsed.search !== "?cmd=DEGETTHEATERS&cc=PTHV" ||
    parsed.hash ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    ptHasExplicitPort(candidate)
  ) {
    bad_input("Prithvi input must be the exact reviewed schedule endpoint");
  }
  return PT_API_URL;
}

function ptResponseText(value) {
  const text =
    typeof value === "string"
      ? value
      : value && typeof value.body === "string"
        ? value.body
        : null;
  if (
    text === null ||
    text.length < PT_MIN_RESPONSE_CHARACTERS ||
    text.length > PT_MAX_RESPONSE_CHARACTERS
  ) {
    throw new Error("Prithvi JSON response left the reviewed boundary");
  }
  return text;
}

function ptCalendarDate(year, month, day, label) {
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
    year < 2000 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > monthDays[month - 1]
  ) {
    throw new Error(`Prithvi ${label} is impossible`);
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
    month,
    day,
    monthDays,
  };
}

function ptDateCode(value, label) {
  const text = ptText(value, label, 8);
  const match = text.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Prithvi ${label} format drifted`);
  return ptCalendarDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    label,
  );
}

function ptNextDate(date) {
  if (date.day < date.monthDays[date.month - 1]) {
    return ptCalendarDate(date.year, date.month, date.day + 1, "end date");
  }
  if (date.month < 12) {
    return ptCalendarDate(date.year, date.month + 1, 1, "end date");
  }
  return ptCalendarDate(date.year + 1, 1, 1, "end date");
}

function ptObservedClock(value) {
  if (value === undefined || value === null || value === "") value = new Date();
  if (
    typeof value !== "string" &&
    Object.prototype.toString.call(value) !== "[object Date]"
  ) {
    throw new Error("Prithvi job creation time is required");
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("Prithvi job creation time is invalid");
  }
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  const date = ptCalendarDate(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    "observed date",
  );
  return {
    date,
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
    observedAt: instant.toISOString(),
  };
}

function ptNumericTime(value, label) {
  const text = ptText(value, label, 4);
  const match = text.match(/^(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Prithvi ${label} format drifted`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Prithvi ${label} is impossible`);
  }
  return { hour, minute, ordinal: hour * 60 + minute };
}

function ptDisplayTime(value, label) {
  const text = ptText(value, label, 8);
  const match = text.match(/^(\d{2}):(\d{2}) (AM|PM)$/);
  if (!match) throw new Error(`Prithvi ${label} format drifted`);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) {
    throw new Error(`Prithvi ${label} is impossible`);
  }
  if (hour === 12) hour = 0;
  if (match[3] === "PM") hour += 12;
  return { hour, minute, ordinal: hour * 60 + minute };
}

function ptTimestamp(date, time) {
  return `${date.value}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00+05:30`;
}

function ptEventCode(value) {
  const code = ptText(value, "event code", 32);
  if (!/^ET\d{8}$/.test(code)) {
    throw new Error("Prithvi event code format drifted");
  }
  return code;
}

function ptSessionId(value) {
  const id = ptText(value, "session ID", 32);
  if (!/^[1-9]\d*$/.test(id)) {
    throw new Error("Prithvi session ID format drifted");
  }
  return id;
}

function ptRegistrationUrl(value, eventCode) {
  const raw = ptText(value, "registration URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Prithvi registration URL is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== PT_REGISTRATION_HOST ||
    parsed.host !== PT_REGISTRATION_HOST ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    ptHasExplicitPort(raw) ||
    !new RegExp(`^/(?:plays|events)/[a-z0-9-]+/${eventCode}$`).test(
      parsed.pathname,
    ) ||
    parsed.toString() !== raw
  ) {
    throw new Error("Prithvi registration URL left the reviewed boundary");
  }
  return raw;
}

function ptImageUrl(value) {
  const code = ptText(value, "image code", 300);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
    throw new Error("Prithvi image code left the reviewed boundary");
  }
  return `https://${PT_IMAGE_HOST}/Events/moviecard/${code}.jpg`;
}

function ptLanguages(value) {
  const text = ptCleanText(value);
  if (!text) return [];
  const languages = text.split("/").map(ptCleanText).filter(Boolean);
  if (
    languages.length < 1 ||
    languages.length > 12 ||
    languages.some((language) => language.length < 2 || language.length > 35) ||
    new Set(languages).size !== languages.length
  ) {
    throw new Error("Prithvi language metadata left the reviewed boundary");
  }
  return languages;
}

function ptPrice(value) {
  const text = ptText(value, "minimum price", 20);
  const match = text.match(/^(\d{1,6})\.(\d{2})$/);
  if (!match) throw new Error("Prithvi minimum price format drifted");
  const minor = Number(match[1]) * 100 + Number(match[2]);
  if (!Number.isSafeInteger(minor)) {
    throw new Error("Prithvi minimum price is outside the reviewed bound");
  }
  if (minor === 0) {
    return { isFree: true, minimum: null, currency: null };
  }
  return { isFree: false, minimum: minor, currency: "INR" };
}

function ptOwnKeys(record) {
  const actual = Object.keys(record).sort();
  const expected = [...PT_CANONICAL_KEYS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("Prithvi canonical record shape drifted");
  }
}

function ptValidateRecord(record) {
  ptOwnKeys(record);
  const venueNames = Object.values(PT_VENUES).map((venue) => venue.name);
  if (
    record.schema_version !== "event-occurrence/v1" ||
    !/^[1-9]\d*$/.test(record.source_event_id) ||
    record.source_url !== PT_SOURCE_URL ||
    record.source_host !== PT_SOURCE_HOST ||
    record.city_slug !== PT_CITY ||
    typeof record.title !== "string" ||
    record.title.length < 1 ||
    record.title.length > 300 ||
    !Object.values(PT_CATEGORY_MAP).includes(record.category) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.end_date) ||
    !record.starts_at.startsWith(`${record.start_date}T`) ||
    !record.ends_at.startsWith(`${record.end_date}T`) ||
    !record.starts_at.endsWith("+05:30") ||
    !record.ends_at.endsWith("+05:30") ||
    record.time_precision !== "timed" ||
    record.timezone !== PT_TIMEZONE ||
    !venueNames.includes(record.venue_name) ||
    record.venue_address !== PT_ADDRESS ||
    typeof record.is_free !== "boolean" ||
    (record.is_free
      ? record.price_min_minor !== null || record.currency !== null
      : !Number.isInteger(record.price_min_minor) ||
        record.price_min_minor <= 0 ||
        record.currency !== "INR") ||
    record.price_max_minor !== null ||
    !["open", "sold_out"].includes(record.registration_state) ||
    record.status !== "scheduled" ||
    !Array.isArray(record.language) ||
    record.language.length > 12 ||
    (record.age_note !== null && typeof record.age_note !== "string") ||
    record.accessibility_note !== null ||
    typeof record.observed_at !== "string"
  ) {
    throw new Error("Prithvi record left the reviewed mapping");
  }
  ptRegistrationUrl(
    record.registration_url,
    record.registration_url.match(/(ET\d{8})$/)?.[1] ?? "",
  );
  const image = new URL(record.image_url);
  if (
    image.protocol !== "https:" ||
    image.host !== PT_IMAGE_HOST ||
    !/^\/Events\/moviecard\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/.test(image.pathname)
  ) {
    throw new Error("Prithvi record image left the reviewed boundary");
  }
  return true;
}

const ptInputUrl = ptBoundedInput(input?.url);
const ptObserved = ptObservedClock(job?.created);
const ptRaw = ptResponseText(request(ptInputUrl));
let ptPayload;
try {
  ptPayload = JSON.parse(ptRaw);
} catch {
  throw new Error("Prithvi response is not valid JSON");
}
const ptRoot = ptObject(ptPayload, "payload");
ptRejectPagination(ptRoot, "payload");
const ptBookMyShow = ptObject(ptRoot.BookMyShow, "BookMyShow payload");
ptRejectPagination(ptBookMyShow, "BookMyShow payload");
const ptVenueRows = ptArray(ptBookMyShow.aVN, "venue", 3, 3);
const ptEventRows = ptArray(
  ptBookMyShow.aEV,
  "event",
  PT_MIN_RECORDS,
  PT_MAX_RECORDS,
);
const ptDayRows = ptArray(
  ptBookMyShow.aSI,
  "day session",
  PT_MIN_RECORDS,
  PT_MAX_RECORDS,
);
const ptSessionRows = ptArray(
  ptBookMyShow.aST,
  "timed session",
  PT_MIN_RECORDS,
  PT_MAX_RECORDS,
);
if (ptDayRows.length !== ptSessionRows.length) {
  throw new Error("Prithvi day and timed session coverage disagree");
}

const ptVenues = new Map();
for (const rawVenue of ptVenueRows) {
  const venue = ptObject(rawVenue, "venue row");
  const id = ptText(venue.Venue_strID, "venue ID", 8);
  const reviewed = PT_VENUES[id];
  if (
    !reviewed ||
    ptVenues.has(id) ||
    ptText(venue.Venue_strName, "venue name", 300) !== reviewed.name ||
    ptText(venue.Venue_strCompanyCode, "venue company", 8) !== "PTHV" ||
    ptText(venue.Region_strCode, "venue region code", 20) !== "MUMBAI" ||
    ptText(venue.Region_strName, "venue region", 100) !== "Mumbai" ||
    ptText(venue.SubRegion_strCode, "venue subregion code", 20) !== "MWEST" ||
    ptText(venue.SubRegion_strName, "venue subregion", 100) !==
      "Mumbai: Western" ||
    ptText(venue.Venue_strAddress, "venue address", 1000) !== PT_ADDRESS
  ) {
    throw new Error("Prithvi venue inventory drifted");
  }
  ptVenues.set(id, reviewed);
}

const ptEvents = new Map();
for (const rawEvent of ptEventRows) {
  const event = ptObject(rawEvent, "event row");
  const code = ptEventCode(event.EventCode);
  const title = ptText(event.EventTitle, "event title", 300);
  const category = PT_CATEGORY_MAP[ptText(event.Genre, "event genre", 100)];
  if (!category || ptEvents.has(code)) {
    throw new Error("Prithvi event identity or genre drifted");
  }
  ptEvents.set(code, {
    code,
    title,
    category,
    languages: ptLanguages(event.strLanguage),
    ageNote: ptCleanText(event.Event_strAgeLimit) || null,
    price: ptPrice(event.MinPrice),
    registrationUrl: ptRegistrationUrl(event.Event_strUrlMapping, code),
    imageUrl: ptImageUrl(event.ImageCode),
  });
}

const ptDays = new Map();
for (const rawDay of ptDayRows) {
  const day = ptObject(rawDay, "day session row");
  const id = ptSessionId(day.SessionId);
  const eventCode = ptEventCode(day.EventCode);
  const venueId = ptText(day.VenueID, "day venue ID", 8);
  const date = ptDateCode(day.ShowDateCode, "day date");
  if (
    ptDays.has(id) ||
    !ptEvents.has(eventCode) ||
    !ptVenues.has(venueId) ||
    ptText(day.VenueName, "day venue name", 300) !== PT_VENUES[venueId].name ||
    ptText(day.Region, "day region", 20) !== "MUMBAI" ||
    !["Y", "N"].includes(ptText(day.SeatsAvail, "day availability", 1))
  ) {
    throw new Error("Prithvi day session inventory drifted");
  }
  ptDays.set(id, {
    eventCode,
    venueId,
    date,
    seatsAvailable: day.SeatsAvail,
  });
}

const ptSessionIds = new Set();
const ptOccurrenceKeys = new Set();
const ptRecords = [];
for (const rawSession of ptSessionRows) {
  const session = ptObject(rawSession, "timed session row");
  const id = ptSessionId(session.SessionId);
  const eventCode = ptEventCode(session.EventCode);
  const venueId = ptText(session.VenueID, "timed venue ID", 8);
  const date = ptDateCode(session.ShowDateCode, "timed date");
  const day = ptDays.get(id);
  const event = ptEvents.get(eventCode);
  const venue = ptVenues.get(venueId);
  const start = ptNumericTime(session.ShowTimeNumeric, "start time");
  const displayedStart = ptDisplayTime(
    session.ShowTimeDisplay,
    "displayed start time",
  );
  const end = ptDisplayTime(session.EndShowTimeDisplay, "displayed end time");
  const seatsAvailable = ptText(session.SeatsAvail, "timed availability", 1);
  const status = ptText(session.SessionStatus, "session status", 1);
  if (
    ptSessionIds.has(id) ||
    !day ||
    !event ||
    !venue ||
    day.eventCode !== eventCode ||
    day.venueId !== venueId ||
    day.date.value !== date.value ||
    day.seatsAvailable !== seatsAvailable ||
    start.ordinal !== displayedStart.ordinal ||
    ptText(session.ScreenName, "screen name", 300) !== venue.screen ||
    status !== "Y" ||
    !["Y", "N"].includes(seatsAvailable)
  ) {
    throw new Error("Prithvi timed session inventory drifted");
  }
  ptSessionIds.add(id);
  const endDate = end.ordinal <= start.ordinal ? ptNextDate(date) : date;
  const startOrder = date.ordinal * 1440 + start.ordinal;
  const endOrder = endDate.ordinal * 1440 + end.ordinal;
  const occurrenceKey = `${eventCode}\u001f${date.value}\u001f${start.ordinal}\u001f${venueId}`;
  if (ptOccurrenceKeys.has(occurrenceKey) || endOrder <= startOrder) {
    throw new Error("Prithvi occurrence identity or interval drifted");
  }
  ptOccurrenceKeys.add(occurrenceKey);
  const observedOrder = ptObserved.date.ordinal * 1440 + ptObserved.minute;
  if (
    endOrder <= observedOrder ||
    date.ordinal > ptObserved.date.ordinal + PT_WINDOW_DAYS
  ) {
    continue;
  }
  const record = {
    schema_version: "event-occurrence/v1",
    source_event_id: id,
    source_url: PT_SOURCE_URL,
    source_host: PT_SOURCE_HOST,
    city_slug: PT_CITY,
    title: event.title,
    category: event.category,
    start_date: date.value,
    starts_at: ptTimestamp(date, start),
    end_date: endDate.value,
    ends_at: ptTimestamp(endDate, end),
    time_precision: "timed",
    timezone: PT_TIMEZONE,
    venue_name: venue.name,
    venue_address: PT_ADDRESS,
    is_free: event.price.isFree,
    price_min_minor: event.price.minimum,
    price_max_minor: null,
    currency: event.price.currency,
    registration_url: event.registrationUrl,
    registration_state: seatsAvailable === "Y" ? "open" : "sold_out",
    status: "scheduled",
    language: event.languages,
    age_note: event.ageNote,
    accessibility_note: null,
    image_url: event.imageUrl,
    observed_at: ptObserved.observedAt,
  };
  ptValidateRecord(record);
  ptRecords.push(record);
}

if (ptSessionIds.size !== ptDays.size) {
  throw new Error("Prithvi timed session coverage is incomplete");
}
ptRecords.sort(
  (left, right) =>
    left.starts_at.localeCompare(right.starts_at) ||
    Number(left.source_event_id) - Number(right.source_event_id),
);
if (ptRecords.length < PT_MIN_RECORDS || ptRecords.length > PT_MAX_RECORDS) {
  throw new Error("Prithvi eligible record count left the reviewed boundary");
}
for (const record of ptRecords) collect(record, ptValidateRecord);
