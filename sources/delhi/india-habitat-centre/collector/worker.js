const IHC_SOURCE_HOST = "indiahabitat.org";
const IHC_SOURCE_PATH = "/Events";
const IHC_SOURCE_URL = `https://${IHC_SOURCE_HOST}${IHC_SOURCE_PATH}`;
const IHC_CITY = "delhi";
const IHC_TIMEZONE = "Asia/Kolkata";
const IHC_PHYSICAL_ADDRESS =
  "India Habitat Centre, Lodhi Road, New Delhi - 110003";
const IHC_WINDOW_DAYS = 90;
const IHC_MIN_HTML_CHARACTERS = 20000;
const IHC_MAX_HTML_CHARACTERS = 500000;
const IHC_MIN_RECORDS = 1;
const IHC_MAX_RECORDS = 100;
const IHC_MONTHS = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};
const IHC_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const IHC_CATEGORY_MAP = {
  Music: "music",
  Dance: "arts",
  Film: "arts",
  "Film & Talk": "talks",
  "Film & Theatre": "theatre",
  Theatre: "theatre",
  Talk: "talks",
  "Music & Dance": "arts",
  Walk: "community",
  Workshop: "workshops",
  Online: "other",
  Other: "other",
};
const IHC_PHYSICAL_VENUES = new Set([
  "The Theatre",
  "The Stein Auditorium",
  "Gulmohar",
  "Casuarina",
]);
const IHC_CANONICAL_KEYS = [
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

function ihcCleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function ihcText(value, label, maximum, required = true) {
  const text = ihcCleanText(value);
  if ((required && text.length === 0) || text.length > maximum) {
    throw new Error(`IHC ${label} left the reviewed text boundary`);
  }
  return text;
}

function ihcHasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function ihcBoundedInput(value) {
  const candidate = value === undefined ? IHC_SOURCE_URL : value;
  if (typeof candidate !== "string" || candidate.length === 0) {
    bad_input("IHC input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    bad_input("IHC input must contain a valid URL");
  }
  if (
    candidate !== IHC_SOURCE_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== IHC_SOURCE_HOST ||
    parsed.host !== IHC_SOURCE_HOST ||
    parsed.pathname !== IHC_SOURCE_PATH ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    ihcHasExplicitPort(candidate)
  ) {
    bad_input("IHC input must be the bare reviewed events URL");
  }
  return IHC_SOURCE_URL;
}

function ihcResponseHtml(value) {
  const html =
    typeof value === "string"
      ? value
      : value && typeof value.body === "string"
        ? value.body
        : null;
  if (
    html === null ||
    html.length < IHC_MIN_HTML_CHARACTERS ||
    html.length > IHC_MAX_HTML_CHARACTERS
  ) {
    throw new Error("IHC HTML response left the reviewed boundary");
  }
  return html;
}

function ihcClassTokens($, node) {
  return new Set(
    ihcCleanText($(node).attr("class")).split(" ").filter(Boolean),
  );
}

function ihcNodesWithClass($, root, tag, className) {
  const matches = [];
  $(root)
    .find(tag)
    .each((_, node) => {
      if (ihcClassTokens($, node).has(className)) matches.push(node);
    });
  return matches;
}

function ihcOneClassNode($, root, tag, className, label) {
  const matches = ihcNodesWithClass($, root, tag, className);
  if (matches.length !== 1) {
    throw new Error(`IHC ${label} shape drifted`);
  }
  return matches[0];
}

function ihcTagNodes($, root, tag) {
  const nodes = [];
  $(root)
    .find(tag)
    .each((_, node) => nodes.push(node));
  return nodes;
}

function ihcOneTagNode($, root, tag, label) {
  const nodes = ihcTagNodes($, root, tag);
  if (nodes.length !== 1) {
    throw new Error(`IHC ${label} shape drifted`);
  }
  return nodes[0];
}

function ihcCalendarDate(year, month, day, label) {
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
    throw new Error(`IHC ${label} is impossible`);
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
  };
}

function ihcObservedClock(value) {
  if (value === undefined || value === null || value === "") {
    value = new Date();
  }
  if (
    typeof value !== "string" &&
    Object.prototype.toString.call(value) !== "[object Date]"
  ) {
    throw new Error("IHC job creation time is required");
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("IHC job creation time is invalid");
  }
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  const date = ihcCalendarDate(
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

function ihcMonth(value, observed) {
  const match = value.match(/^([A-Z][a-z]+) (\d{4})$/);
  const month = match ? IHC_MONTHS[match[1]] : null;
  const year = match ? Number(match[2]) : null;
  if (!month || year !== observed.date.year || month !== observed.date.month) {
    throw new Error("IHC current month label drifted");
  }
  return { month, year };
}

function ihcTime(value) {
  const match = value.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!match) throw new Error("IHC start time format drifted");
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error("IHC start time is impossible");
  }
  if (hour === 12) hour = 0;
  if (match[3] === "PM") hour += 12;
  return { hour, minute, ordinal: hour * 60 + minute };
}

function ihcTimestamp(date, time) {
  return `${date.value}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00+05:30`;
}

function ihcDetailUrl(rawValue) {
  const raw = ihcText(rawValue, "detail URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw, IHC_SOURCE_URL);
  } catch {
    throw new Error("IHC detail URL is invalid");
  }
  const match = parsed.pathname.match(/^\/Events_details\/([0-9]+)$/);
  if (
    raw !== parsed.toString() ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== IHC_SOURCE_HOST ||
    parsed.host !== IHC_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    ihcHasExplicitPort(raw) ||
    !match
  ) {
    throw new Error("IHC detail URL left the reviewed boundary");
  }
  return { eventId: match[1], url: parsed.toString() };
}

function ihcImageUrl(rawValue) {
  const raw = ihcText(rawValue, "image URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw, IHC_SOURCE_URL);
  } catch {
    throw new Error("IHC image URL is invalid");
  }
  let path;
  try {
    path = `/${decodeURIComponent(parsed.pathname).replace(/^\/+/, "")}`;
  } catch {
    throw new Error("IHC image URL encoding is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== IHC_SOURCE_HOST ||
    parsed.host !== IHC_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    ihcHasExplicitPort(raw) ||
    !/^\/uploads\/[0-9]+_[A-Za-z0-9]+\.(?:jpe?g|png|webp)$/i.test(path)
  ) {
    throw new Error("IHC image URL left the reviewed boundary");
  }
  return `https://${IHC_SOURCE_HOST}${path}`;
}

function ihcPaginationPresent($) {
  let found = false;
  $("a").each((_, link) => {
    const rel = ihcCleanText($(link).attr("rel")).toLowerCase();
    if (rel.split(" ").includes("next")) found = true;
  });
  for (const tag of ["nav", "ul", "div", "button"]) {
    $(tag).each((_, node) => {
      const tokens = ihcClassTokens($, node);
      if (
        tokens.has("pager") ||
        tokens.has("pagination") ||
        tokens.has("load-more")
      ) {
        found = true;
      }
    });
  }
  return found;
}

function ihcCard($, node, date, observedAt) {
  const imageContainer = ihcOneClassNode(
    $,
    node,
    "div",
    "event-img",
    "event image container",
  );
  const image = ihcOneTagNode($, imageContainer, "img", "event image");
  const imageAnchor = ihcOneTagNode(
    $,
    imageContainer,
    "a",
    "event image action",
  );
  const timeNode = ihcOneClassNode($, node, "h4", "event-time", "event time");
  const titleNode = ihcOneClassNode($, node, "h3", "event-name", "event title");
  const titleAnchor = ihcOneTagNode($, titleNode, "a", "title action");
  const moreInfo = ihcOneClassNode(
    $,
    node,
    "a",
    "more-info",
    "more info action",
  );
  const paragraphs = ihcTagNodes($, node, "p");
  if (paragraphs.length !== 1) {
    throw new Error("IHC event type and venue shape drifted");
  }
  const metadata = ihcText(
    $(paragraphs[0]).text(),
    "event type and venue",
    400,
  );
  const metadataParts = metadata.split(" | ");
  if (metadataParts.length !== 2) {
    throw new Error("IHC event type and venue delimiter drifted");
  }
  const sourceType = ihcText(metadataParts[0], "source type", 100);
  const venue = ihcText(metadataParts[1], "venue", 300);
  const category = IHC_CATEGORY_MAP[sourceType];
  if (!category) throw new Error("IHC source type needs mapping review");
  if (venue !== "Online" && !IHC_PHYSICAL_VENUES.has(venue)) {
    throw new Error("IHC venue needs mapping review");
  }
  const detail = ihcDetailUrl($(moreInfo).attr("href"));
  for (const action of [imageAnchor, titleAnchor]) {
    const candidate = ihcDetailUrl($(action).attr("href"));
    if (candidate.url !== detail.url || candidate.eventId !== detail.eventId) {
      throw new Error("IHC card detail actions disagree");
    }
  }
  const time = ihcTime(ihcText($(timeNode).text(), "start time", 40));
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: detail.eventId,
    source_url: detail.url,
    source_host: IHC_SOURCE_HOST,
    city_slug: IHC_CITY,
    title: ihcText($(titleNode).text(), "title", 300),
    category,
    start_date: date.value,
    starts_at: ihcTimestamp(date, time),
    end_date: null,
    ends_at: null,
    time_precision: "timed",
    timezone: IHC_TIMEZONE,
    venue_name: venue,
    venue_address: venue === "Online" ? null : IHC_PHYSICAL_ADDRESS,
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
    image_url: ihcImageUrl($(image).attr("src")),
    observed_at: observedAt,
  };
}

function ihcOwnKeys(record) {
  const actual = Object.keys(record).sort();
  const expected = [...IHC_CANONICAL_KEYS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("IHC canonical record shape drifted");
  }
}

function ihcValidateRecord(record) {
  ihcOwnKeys(record);
  if (
    record.schema_version !== "event-occurrence/v1" ||
    !/^[0-9]+$/.test(record.source_event_id) ||
    record.source_host !== IHC_SOURCE_HOST ||
    record.city_slug !== IHC_CITY ||
    typeof record.title !== "string" ||
    record.title.length < 1 ||
    record.title.length > 300 ||
    !Object.values(IHC_CATEGORY_MAP).includes(record.category) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.start_date) ||
    !record.starts_at.startsWith(`${record.start_date}T`) ||
    !record.starts_at.endsWith("+05:30") ||
    record.end_date !== null ||
    record.ends_at !== null ||
    record.time_precision !== "timed" ||
    record.timezone !== IHC_TIMEZONE ||
    (record.venue_name !== "Online" &&
      !IHC_PHYSICAL_VENUES.has(record.venue_name)) ||
    (record.venue_name === "Online"
      ? record.venue_address !== null
      : record.venue_address !== IHC_PHYSICAL_ADDRESS) ||
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
    throw new Error("IHC record left the reviewed mapping");
  }
  const detail = ihcDetailUrl(record.source_url);
  if (detail.eventId !== record.source_event_id) {
    throw new Error("IHC record identity and detail disagree");
  }
  if (ihcImageUrl(record.image_url) !== record.image_url) {
    throw new Error("IHC record image is not canonical");
  }
  return true;
}

const ihcInputUrl = ihcBoundedInput(input?.url);
const ihcObserved = ihcObservedClock(job?.created);
const ihcHorizonOrdinal = ihcObserved.date.ordinal + IHC_WINDOW_DAYS;
const ihcHtml = ihcResponseHtml(request(ihcInputUrl));
const $ = load_html(ihcHtml);

const ihcTitles = [];
$("title").each((_, node) => ihcTitles.push(ihcCleanText($(node).text())));
if (ihcTitles.length !== 1 || ihcTitles[0] !== "India Habitat Centre") {
  throw new Error("IHC page identity drifted");
}
if (ihcPaginationPresent($)) {
  throw new Error("IHC page requires pagination review");
}

const ihcAllEvents = [];
$("div").each((_, node) => {
  if (ihcCleanText($(node).attr("id")) === "all-events") {
    ihcAllEvents.push(node);
  }
});
if (ihcAllEvents.length !== 1) {
  throw new Error("IHC all-events calendar shape drifted");
}
const ihcAllEventsRoot = ihcAllEvents[0];
const ihcMonthDay = ihcOneClassNode(
  $,
  ihcAllEventsRoot,
  "div",
  "month-day",
  "month container",
);
const ihcDateHeading = ihcOneClassNode(
  $,
  ihcMonthDay,
  "div",
  "date-e",
  "month heading",
);
const ihcMonthHeading = ihcOneTagNode($, ihcDateHeading, "h4", "month label");
const ihcPageMonth = ihcMonth(
  ihcText($(ihcMonthHeading).text(), "month label", 40),
  ihcObserved,
);
const ihcCalendar = ihcOneClassNode(
  $,
  ihcAllEventsRoot,
  "div",
  "calendar-container",
  "calendar",
);
const ihcDayItems = ihcNodesWithClass($, ihcCalendar, "div", "day-item");
if (ihcDayItems.length < 28 || ihcDayItems.length > 42) {
  throw new Error("IHC calendar day coverage drifted");
}

const ihcRecords = [];
for (const ihcDayItem of ihcDayItems) {
  if (ihcClassTokens($, ihcDayItem).has("empty")) {
    if (
      ihcNodesWithClass($, ihcDayItem, "div", "item-day").length !== 0 ||
      ihcNodesWithClass($, ihcDayItem, "div", "day-content").length !== 0
    ) {
      throw new Error("IHC empty calendar cell contains event content");
    }
    continue;
  }
  const ihcDayHeader = ihcOneClassNode(
    $,
    ihcDayItem,
    "div",
    "item-day",
    "day header",
  );
  const ihcWeekdayNode = ihcOneTagNode($, ihcDayHeader, "p", "weekday label");
  const ihcDayNode = ihcOneTagNode($, ihcDayHeader, "span", "day number");
  const ihcWeekday = ihcText($(ihcWeekdayNode).text(), "weekday", 20);
  const ihcDayText = ihcText($(ihcDayNode).text(), "day number", 2);
  if (!/^\d{1,2}$/.test(ihcDayText)) {
    throw new Error("IHC day number format drifted");
  }
  const ihcDate = ihcCalendarDate(
    ihcPageMonth.year,
    ihcPageMonth.month,
    Number(ihcDayText),
    "event date",
  );
  if (IHC_WEEKDAYS[(ihcDate.ordinal + 3) % 7] !== ihcWeekday) {
    throw new Error("IHC weekday and date disagree");
  }
  const ihcCards = ihcNodesWithClass($, ihcDayItem, "div", "day-content");
  for (const ihcCardNode of ihcCards) {
    const ihcRecord = ihcCard($, ihcCardNode, ihcDate, ihcObserved.observedAt);
    const ihcStartHour = Number(ihcRecord.starts_at.slice(11, 13));
    const ihcStartMinute = Number(ihcRecord.starts_at.slice(14, 16));
    const ihcStartOrder =
      ihcDate.ordinal * 1440 + ihcStartHour * 60 + ihcStartMinute;
    const ihcObservedOrder =
      ihcObserved.date.ordinal * 1440 + ihcObserved.minute;
    if (
      ihcDate.ordinal <= ihcHorizonOrdinal &&
      ihcStartOrder >= ihcObservedOrder
    ) {
      ihcRecords.push(ihcRecord);
    }
  }
}

ihcRecords.sort(
  (left, right) =>
    left.starts_at.localeCompare(right.starts_at) ||
    Number(left.source_event_id) - Number(right.source_event_id),
);
if (
  ihcRecords.length < IHC_MIN_RECORDS ||
  ihcRecords.length > IHC_MAX_RECORDS
) {
  throw new Error("IHC eligible record count left the reviewed boundary");
}
const ihcEventIds = new Set();
const ihcDetailUrls = new Set();
for (const record of ihcRecords) {
  ihcValidateRecord(record);
  if (
    ihcEventIds.has(record.source_event_id) ||
    ihcDetailUrls.has(record.source_url)
  ) {
    throw new Error("IHC repeated an eligible native event identity");
  }
  ihcEventIds.add(record.source_event_id);
  ihcDetailUrls.add(record.source_url);
}
for (const record of ihcRecords) {
  collect(record, ihcValidateRecord);
}
