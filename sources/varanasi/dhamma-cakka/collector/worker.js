const DHAMMA_SOURCE_HOST = "schedule.vridhamma.org";
const DHAMMA_SOURCE_PATH = "/courses/cakka";
const DHAMMA_SOURCE_URL = `https://${DHAMMA_SOURCE_HOST}${DHAMMA_SOURCE_PATH}`;
const DHAMMA_TIMEZONE = "Asia/Kolkata";
const DHAMMA_VENUE_NAME = "Dhamma Chakka";
const DHAMMA_VENUE_ADDRESS = "Kharagipur, Uttar Pradesh - 221104";
const DHAMMA_LOCATION = "India | Uttar Pradesh | Varanasi";
const DHAMMA_WINDOW_DAYS = 90;
const DHAMMA_MIN_RECORDS = 3;
const DHAMMA_MAX_RECORDS = 20;
const DHAMMA_MIN_HTML_CHARACTERS = 20000;
const DHAMMA_MAX_HTML_CHARACTERS = 200000;
const DHAMMA_HEADERS = ["Apply", "Dates", "Course Type", "Status", "Comments"];
const DHAMMA_FORM_PATHS = [
  "/form/application-form",
  "/form/children-application-form",
  "/form/long-course-application-form",
  "/form/stp-application-form",
];
const DHAMMA_MONTHS = {
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
const DHAMMA_CANONICAL_KEYS = [
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

function dhammaCleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function dhammaText(value, label, maximum, required = true) {
  const text = dhammaCleanText(value);
  if ((required && text.length === 0) || text.length > maximum) {
    throw new Error(`Dhamma Cakka ${label} left the reviewed text boundary`);
  }
  return text;
}

function dhammaHasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function dhammaBoundedInput(value) {
  const candidate = value === undefined ? DHAMMA_SOURCE_URL : value;
  if (typeof candidate !== "string" || candidate.length === 0) {
    bad_input("Dhamma Cakka input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    bad_input("Dhamma Cakka input must contain a valid URL");
  }
  if (
    candidate !== DHAMMA_SOURCE_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== DHAMMA_SOURCE_HOST ||
    parsed.host !== DHAMMA_SOURCE_HOST ||
    parsed.pathname !== DHAMMA_SOURCE_PATH ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    dhammaHasExplicitPort(candidate)
  ) {
    bad_input("Dhamma Cakka input must be the bare reviewed course URL");
  }
  return DHAMMA_SOURCE_URL;
}

function dhammaResponseHtml(value) {
  const html =
    typeof value === "string"
      ? value
      : value && typeof value.body === "string"
        ? value.body
        : null;
  if (
    html === null ||
    html.length < DHAMMA_MIN_HTML_CHARACTERS ||
    html.length > DHAMMA_MAX_HTML_CHARACTERS
  ) {
    throw new Error("Dhamma Cakka HTML response left the reviewed boundary");
  }
  return html;
}

function dhammaCalendarDate(year, month, day, label) {
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
    throw new Error(`Dhamma Cakka ${label} is impossible`);
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

function dhammaObservedDate(instant) {
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  return dhammaCalendarDate(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    "observed date",
  );
}

function dhammaDateRange(value, startYear) {
  if (typeof value !== "string") {
    throw new Error("Dhamma Cakka date range must be source text");
  }
  const match = dhammaCleanText(value).match(
    /^(\d{1,2}) ([A-Z][a-z]{2}) - (\d{1,2}) ([A-Z][a-z]{2})$/,
  );
  if (!match || !DHAMMA_MONTHS[match[2]] || !DHAMMA_MONTHS[match[4]]) {
    throw new Error("Dhamma Cakka date range format drifted");
  }
  const startMonth = DHAMMA_MONTHS[match[2]];
  const endMonth = DHAMMA_MONTHS[match[4]];
  const start = dhammaCalendarDate(
    startYear,
    startMonth,
    Number(match[1]),
    "start date",
  );
  const endYear = endMonth < startMonth ? startYear + 1 : startYear;
  const end = dhammaCalendarDate(
    endYear,
    endMonth,
    Number(match[3]),
    "end date",
  );
  if (end.ordinal < start.ordinal) {
    throw new Error("Dhamma Cakka course ends before it starts");
  }
  return { start, end };
}

function dhammaClassTokens($, node) {
  return new Set(dhammaCleanText($(node).attr("class")).split(" "));
}

function dhammaHiddenRow($, row) {
  const element = $(row);
  const style = dhammaCleanText(element.attr("style"))
    .toLowerCase()
    .replace(/\s/g, "");
  return (
    element.attr("hidden") !== undefined ||
    element.attr("aria-hidden") === "true" ||
    style.includes("display:none") ||
    style.includes("visibility:hidden")
  );
}

function dhammaCellTexts($, row, selector) {
  const values = [];
  $(row)
    .children(selector)
    .each((_, cell) => values.push(dhammaCleanText($(cell).text())));
  return values;
}

function dhammaPaginationPresent($) {
  let found = false;
  $("a").each((_, link) => {
    const rel = dhammaCleanText($(link).attr("rel")).toLowerCase();
    if (rel.split(" ").includes("next")) found = true;
  });
  for (const tag of ["nav", "ul", "div"]) {
    $(tag).each((_, node) => {
      const tokens = dhammaClassTokens($, node);
      if (tokens.has("pager") || tokens.has("pagination")) found = true;
    });
  }
  return found;
}

function dhammaRegistrationUrl($, cell, linkedCourseIds) {
  const links = [];
  $(cell)
    .find("a")
    .each((_, link) => links.push(link));
  const cellText = dhammaCleanText($(cell).text());
  if (links.length === 0) {
    if (cellText !== "") {
      throw new Error("Dhamma Cakka apply cell contains unsupported text");
    }
    return null;
  }
  if (links.length !== 1 || cellText !== "Apply") {
    throw new Error("Dhamma Cakka apply cell shape drifted");
  }
  const href = $(links[0]).attr("href");
  if (typeof href !== "string") {
    throw new Error("Dhamma Cakka application link lacks an href");
  }
  const match = href.match(
    /^\/form\/(application-form|children-application-form|long-course-application-form|stp-application-form)\?centre=31&course=([1-9][0-9]*)$/,
  );
  if (!match) {
    throw new Error("Dhamma Cakka application URL left the reviewed boundary");
  }
  const courseId = match[2];
  if (linkedCourseIds.has(courseId)) {
    throw new Error("Dhamma Cakka repeated an application course ID");
  }
  linkedCourseIds.add(courseId);
  const absolute = new URL(href, DHAMMA_SOURCE_URL);
  if (
    absolute.protocol !== "https:" ||
    absolute.hostname !== DHAMMA_SOURCE_HOST ||
    absolute.host !== DHAMMA_SOURCE_HOST ||
    absolute.port !== "" ||
    absolute.username !== "" ||
    absolute.password !== "" ||
    absolute.hash !== "" ||
    !DHAMMA_FORM_PATHS.includes(absolute.pathname) ||
    absolute.search !== `?centre=31&course=${courseId}`
  ) {
    throw new Error("Dhamma Cakka application URL failed canonicalization");
  }
  return absolute.toString();
}

function dhammaCanonicalRecord(title, dates, registrationUrl, observedAt) {
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: null,
    source_url: DHAMMA_SOURCE_URL,
    source_host: DHAMMA_SOURCE_HOST,
    city_slug: "varanasi",
    title,
    category: "community",
    start_date: dates.start.value,
    starts_at: null,
    end_date: dates.end.value,
    ends_at: null,
    time_precision: "date",
    timezone: DHAMMA_TIMEZONE,
    venue_name: DHAMMA_VENUE_NAME,
    venue_address: DHAMMA_VENUE_ADDRESS,
    is_free: null,
    price_min_minor: null,
    price_max_minor: null,
    currency: null,
    registration_url: registrationUrl,
    registration_state: null,
    status: "scheduled",
    language: [],
    age_note: null,
    accessibility_note: null,
    image_url: null,
    observed_at: observedAt,
  };
}

function dhammaOwnKeys(record) {
  const actual = Object.keys(record).sort();
  const expected = [...DHAMMA_CANONICAL_KEYS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("Dhamma Cakka canonical record shape drifted");
  }
}

function dhammaValidateRecord(record) {
  dhammaOwnKeys(record);
  if (
    record.schema_version !== "event-occurrence/v1" ||
    record.source_event_id !== null ||
    record.source_url !== DHAMMA_SOURCE_URL ||
    record.source_host !== DHAMMA_SOURCE_HOST ||
    record.city_slug !== "varanasi" ||
    typeof record.title !== "string" ||
    record.title.length < 1 ||
    record.title.length > 300 ||
    record.category !== "community" ||
    record.starts_at !== null ||
    record.ends_at !== null ||
    record.time_precision !== "date" ||
    record.timezone !== DHAMMA_TIMEZONE ||
    record.venue_name !== DHAMMA_VENUE_NAME ||
    record.venue_address !== DHAMMA_VENUE_ADDRESS ||
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
    throw new Error("Dhamma Cakka record left the reviewed mapping");
  }
  return true;
}

function dhammaIdentity(record) {
  return [
    dhammaCleanText(record.title).toLowerCase(),
    record.source_url,
    record.start_date,
    dhammaCleanText(record.venue_name).toLowerCase(),
  ].join("\u001f");
}

const dhammaSourceUrl = dhammaBoundedInput(input?.url);
const dhammaObservedInstant = new Date(job.created);
if (!Number.isFinite(dhammaObservedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}
const dhammaObservedAt = dhammaObservedInstant.toISOString();
const dhammaToday = dhammaObservedDate(dhammaObservedInstant);
const dhammaHorizonOrdinal = dhammaToday.ordinal + DHAMMA_WINDOW_DAYS;

const dhammaMarkup = dhammaResponseHtml(request(dhammaSourceUrl));
const $ = load_html(dhammaMarkup);
if (typeof $ !== "function") {
  throw new Error("Dhamma Cakka HTML parser was not initialized");
}
if (dhammaPaginationPresent($)) {
  throw new Error("Dhamma Cakka schedule unexpectedly requires pagination");
}

const dhammaCentreTables = [];
const dhammaScheduleTables = [];
$("table").each((_, table) => {
  if (dhammaClassTokens($, table).has("centre-info")) {
    dhammaCentreTables.push(table);
    return;
  }
  const caption = dhammaCleanText($(table).find("caption").first().text());
  const match = caption.match(/^Course Year (\d{4})$/);
  if (match) {
    dhammaScheduleTables.push({ table, year: Number(match[1]) });
  }
});
if (dhammaCentreTables.length !== 1) {
  throw new Error("Dhamma Cakka page must contain one centre table");
}
if (dhammaScheduleTables.length < 1 || dhammaScheduleTables.length > 4) {
  throw new Error(
    "Dhamma Cakka schedule table count left the reviewed boundary",
  );
}

const dhammaCentre = dhammaCentreTables[0];
const dhammaCentreHeadings = [];
$(dhammaCentre)
  .find("h2")
  .each((_, heading) =>
    dhammaCentreHeadings.push(dhammaCleanText($(heading).text())),
  );
let dhammaAddress = null;
let dhammaLocation = null;
$(dhammaCentre)
  .find("div")
  .each((_, node) => {
    const classes = dhammaClassTokens($, node);
    if (classes.has("views-field-c-address")) {
      if (dhammaAddress !== null)
        throw new Error("Dhamma Cakka repeated its centre address");
      dhammaAddress = dhammaCleanText($(node).text());
    }
    if (classes.has("views-field-centre-location")) {
      if (dhammaLocation !== null)
        throw new Error("Dhamma Cakka repeated its centre location");
      dhammaLocation = dhammaCleanText($(node).text());
    }
  });
if (
  dhammaCentreHeadings.length !== 1 ||
  dhammaCentreHeadings[0] !== DHAMMA_VENUE_NAME ||
  dhammaAddress !== DHAMMA_VENUE_ADDRESS ||
  dhammaLocation !== DHAMMA_LOCATION
) {
  throw new Error("Dhamma Cakka centre facts drifted");
}

const dhammaYears = new Set();
let dhammaPreviousYear = null;
let dhammaPreviousStartOrdinal = null;
const dhammaLinkedCourseIds = new Set();
const dhammaRecords = [];

for (const schedule of dhammaScheduleTables) {
  if (
    dhammaYears.has(schedule.year) ||
    (dhammaPreviousYear !== null && schedule.year <= dhammaPreviousYear)
  ) {
    throw new Error("Dhamma Cakka schedule years are duplicated or unordered");
  }
  dhammaYears.add(schedule.year);
  dhammaPreviousYear = schedule.year;
  const headers = [];
  $(schedule.table)
    .find("thead")
    .first()
    .find("th")
    .each((_, header) => headers.push(dhammaCleanText($(header).text())));
  if (
    headers.length !== DHAMMA_HEADERS.length ||
    headers.some((header, index) => header !== DHAMMA_HEADERS[index])
  ) {
    throw new Error("Dhamma Cakka schedule headers drifted");
  }
  const rows = [];
  $(schedule.table)
    .find("tbody")
    .first()
    .find("tr")
    .each((_, row) => rows.push(row));
  if (rows.length < 1 || rows.length > 100) {
    throw new Error("Dhamma Cakka annual row count left the reviewed boundary");
  }
  for (const row of rows) {
    if (dhammaHiddenRow($, row)) continue;
    const cells = [];
    $(row)
      .children("td")
      .each((_, cell) => cells.push(cell));
    if (cells.length !== 5 || dhammaCellTexts($, row, "th").length !== 0) {
      throw new Error("Dhamma Cakka visible row must have exactly five cells");
    }
    const dates = dhammaDateRange($(cells[1]).text(), schedule.year);
    const title = dhammaText($(cells[2]).text(), "course type", 300);
    dhammaText($(cells[3]).text(), "availability status", 2000);
    dhammaText($(cells[4]).text(), "course comments", 2000, false);
    const registrationUrl = dhammaRegistrationUrl(
      $,
      cells[0],
      dhammaLinkedCourseIds,
    );
    if (
      dhammaPreviousStartOrdinal !== null &&
      dates.start.ordinal < dhammaPreviousStartOrdinal
    ) {
      throw new Error("Dhamma Cakka schedule rows are not chronological");
    }
    dhammaPreviousStartOrdinal = dates.start.ordinal;
    if (
      dates.start.ordinal >= dhammaToday.ordinal &&
      dates.start.ordinal <= dhammaHorizonOrdinal
    ) {
      dhammaRecords.push(
        dhammaCanonicalRecord(title, dates, registrationUrl, dhammaObservedAt),
      );
    }
  }
}

if (!dhammaYears.has(dhammaToday.year)) {
  throw new Error("Dhamma Cakka schedule omits the observed year");
}
const dhammaEndOfYear = dhammaCalendarDate(
  dhammaToday.year,
  12,
  31,
  "observed year end",
).ordinal;
if (
  dhammaHorizonOrdinal > dhammaEndOfYear &&
  !dhammaYears.has(dhammaToday.year + 1)
) {
  throw new Error("Dhamma Cakka schedule omits the horizon year");
}
if (
  dhammaRecords.length < DHAMMA_MIN_RECORDS ||
  dhammaRecords.length > DHAMMA_MAX_RECORDS
) {
  throw new Error(
    "Dhamma Cakka eligible record count left the reviewed boundary",
  );
}

const dhammaIdentities = new Set();
for (const record of dhammaRecords) {
  dhammaValidateRecord(record);
  const identity = dhammaIdentity(record);
  if (dhammaIdentities.has(identity)) {
    throw new Error("Dhamma Cakka repeated a fallback occurrence identity");
  }
  dhammaIdentities.add(identity);
}
for (const record of dhammaRecords) {
  collect(record, dhammaValidateRecord);
}
