const SOURCE_HOST = "www.galaxyregistration.com";
const SOURCE_PATH = "/event/skill-school/";
const SOURCE_URL = `https://${SOURCE_HOST}${SOURCE_PATH}`;
const CITY_SLUG = "varanasi";
const TIMEZONE = "Asia/Kolkata";
const VENUE_NAME = "BHU Varanasi";
const WINDOW_DAYS = 90;
const EXPECTED_PUBLIC_OCCURRENCES = 13;
const MAX_RECORDS = 20;
const IST_OFFSET_MS = 330 * 60 * 1000;
const canonicalKeys = [
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
const months = new Map([
  ["January", 1],
  ["February", 2],
  ["March", 3],
  ["April", 4],
  ["May", 5],
  ["June", 6],
  ["July", 7],
  ["August", 8],
  ["September", 9],
  ["October", 10],
  ["November", 11],
  ["December", 12],
]);
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedIdentityText(value) {
  return cleanText(value).toLowerCase();
}

function hasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function boundedSourceUrl(rawUrl) {
  const candidateUrl = rawUrl === undefined ? SOURCE_URL : rawUrl;
  if (typeof candidateUrl !== "string") {
    bad_input("EMINDIA input must contain one URL string");
  }
  let url;
  try {
    url = new URL(candidateUrl);
  } catch {
    bad_input("EMINDIA input must be a valid URL");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== SOURCE_HOST ||
    url.port ||
    hasExplicitPort(candidateUrl) ||
    url.username ||
    url.password ||
    url.pathname !== SOURCE_PATH ||
    url.search ||
    url.hash ||
    url.toString() !== SOURCE_URL
  ) {
    bad_input("EMINDIA input must be the bare reviewed registration URL");
  }
  return url.toString();
}

function responseHtml(response) {
  if (typeof response === "string") return response;
  if (response && typeof response.body === "string") return response.body;
  throw new Error("EMINDIA returned an unsupported response shape");
}

function requireCount(selection, expected, label) {
  if (selection.length !== expected) {
    throw new Error(`EMINDIA ${label} count drifted`);
  }
  return selection;
}

function singleText(root, selector, label) {
  return cleanText(requireCount(root.find(selector), 1, label).text());
}

function selectionLines($, selection, label) {
  requireCount(selection, 1, label);
  const lines = [];
  let buffer = "";
  selection.contents().each((_, node) => {
    const tagName = cleanText(node?.name ?? node?.tagName).toLowerCase();
    if (tagName === "br") {
      const textLine = cleanText(buffer);
      if (textLine) lines.push(textLine);
      buffer = "";
      return;
    }
    buffer += ` ${$(node).text()}`;
  });
  const finalLine = cleanText(buffer);
  if (finalLine) lines.push(finalLine);
  if (lines.length < 1 || lines.some((textLine) => textLine.length > 300)) {
    throw new Error(`EMINDIA ${label} lines are outside the reviewed bound`);
  }
  return lines;
}

function asSelection($, value) {
  return value && typeof value.find === "function" ? value : $(value);
}

function directCells($, row, tagName, expected, label) {
  const selection = requireCount(
    asSelection($, row).children(tagName),
    expected,
    label,
  );
  const cells = [];
  selection.each((_, cell) => cells.push($(cell)));
  return cells;
}

function directRows($, table, section, expected, label) {
  const container = requireCount(
    asSelection($, table).children(section),
    1,
    label,
  );
  const rows = requireCount(container.children("tr"), expected, label);
  const result = [];
  rows.each((_, row) => result.push($(row)));
  return result;
}

function tableClasses(table) {
  return cleanText(table.attr("class")).split(" ").filter(Boolean);
}

function hasExactClasses(table, expected) {
  const actual = tableClasses(table);
  return (
    actual.length === expected.length &&
    expected.every((className) => actual.includes(className))
  );
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function daysBeforeYear(year) {
  const previous = year - 1;
  return (
    previous * 365 +
    Math.floor(previous / 4) -
    Math.floor(previous / 100) +
    Math.floor(previous / 400)
  );
}

function dayOrdinal(year, month, day) {
  let ordinal = daysBeforeYear(year);
  for (let current = 1; current < month; current += 1) {
    ordinal += daysInMonth(year, current);
  }
  return ordinal + day - 1;
}

function ordinalSuffix(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
}

function calendarDate(year, month, day, label) {
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new Error(`EMINDIA ${label} is an impossible calendar date`);
  }
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { date, ordinal: dayOrdinal(year, month, day), year, month, day };
}

function parseSourceDate(value, label) {
  const match = cleanText(value).match(
    /^(\d{1,2})(st|nd|rd|th) ([A-Z][a-z]+) (\d{4})$/,
  );
  if (!match || !months.has(match[3])) {
    throw new Error(`EMINDIA ${label} has an unsupported date`);
  }
  const day = Number(match[1]);
  if (match[2] !== ordinalSuffix(day)) {
    throw new Error(`EMINDIA ${label} has an invalid ordinal suffix`);
  }
  return calendarDate(Number(match[4]), months.get(match[3]), day, label);
}

function parseSourceDateRange(value, label) {
  const match = cleanText(value).match(
    /^(\d{1,2})(st|nd|rd|th) & (\d{1,2})(st|nd|rd|th) ([A-Z][a-z]+) (\d{4})$/,
  );
  if (!match || !months.has(match[5])) {
    throw new Error(`EMINDIA ${label} has an unsupported date range`);
  }
  const first = parseSourceDate(
    `${match[1]}${match[2]} ${match[5]} ${match[6]}`,
    `${label} start`,
  );
  const second = parseSourceDate(
    `${match[3]}${match[4]} ${match[5]} ${match[6]}`,
    `${label} end`,
  );
  if (second.ordinal < first.ordinal) {
    throw new Error(`EMINDIA ${label} ends before it starts`);
  }
  return { start: first, end: second };
}

function parseLongDate(value, label) {
  const match = cleanText(value).match(/^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/);
  if (!match || !months.has(match[1])) {
    throw new Error(`EMINDIA ${label} has an unsupported long date`);
  }
  return calendarDate(
    Number(match[3]),
    months.get(match[1]),
    Number(match[2]),
    label,
  );
}

function parseClock(value, label) {
  if (!/^\d{4}$/.test(value)) {
    throw new Error(`EMINDIA ${label} has an unsupported time`);
  }
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(2));
  if (hour > 23 || minute > 59) {
    throw new Error(`EMINDIA ${label} has an impossible time`);
  }
  return { hour, minute, text: `${value.slice(0, 2)}:${value.slice(2)}` };
}

function parseSessionHeading(value, label) {
  const match = cleanText(value).match(
    /^(\d{1,2})(st|nd|rd|th) ([A-Z][a-z]+) (\d{4}) \(([A-Z][a-z]+)\) (\d{4})-(\d{4}) Hours$/,
  );
  if (!match) {
    throw new Error(`EMINDIA ${label} has an unsupported session heading`);
  }
  const date = parseSourceDate(
    `${match[1]}${match[2]} ${match[3]} ${match[4]}`,
    `${label} date`,
  );
  if (weekdays[date.ordinal % 7] !== match[5]) {
    throw new Error(`EMINDIA ${label} weekday disagrees with its date`);
  }
  const start = parseClock(match[6], `${label} start`);
  const end = parseClock(match[7], `${label} end`);
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;
  if (endMinute <= startMinute) {
    throw new Error(`EMINDIA ${label} end must follow its start`);
  }
  return {
    date,
    startMinute,
    endMinute,
    startsAt: `${date.date}T${start.text}:00+05:30`,
    endsAt: `${date.date}T${end.text}:00+05:30`,
  };
}

function metadataValue($, label) {
  const headings = [];
  $("h2").each((_, node) => {
    if (cleanText($(node).text()) === label) headings.push($(node));
  });
  if (headings.length !== 1) {
    throw new Error(`EMINDIA ${label} metadata heading count drifted`);
  }
  return cleanText(
    requireCount(
      headings[0].parent().find(".is-acf-field").find(".value"),
      1,
      `${label} metadata value`,
    ).text(),
  );
}

function parseSummaryTable($, table) {
  const headerRow = directRows($, table, "thead", 1, "summary header row")[0];
  const headers = directCells($, headerRow, "th", 3, "summary headers").map(
    (cell) => cleanText(cell.text()),
  );
  if (
    JSON.stringify(headers) !== JSON.stringify(["Dates", "Activity", "Notes"])
  ) {
    throw new Error("EMINDIA summary headers drifted");
  }
  const rows = directRows($, table, "tbody", 3, "summary rows");
  return rows.map((row, index) => {
    const cells = directCells($, row, "td", 3, `summary row ${index + 1}`);
    return {
      dateText: cleanText(cells[0].text()),
      activityLines: selectionLines(
        $,
        cells[1],
        `summary activity ${index + 1}`,
      ),
      noteLines: selectionLines($, cells[2], `summary notes ${index + 1}`),
    };
  });
}

function parseDetailTable($, table) {
  const headerRows = directRows($, table, "thead", 2, "detail header rows");
  const headingCell = directCells(
    $,
    headerRows[0],
    "th",
    1,
    "detail heading",
  )[0];
  if (cleanText(headingCell.attr("colspan")) !== "2") {
    throw new Error("EMINDIA detail heading colspan drifted");
  }
  const session = parseSessionHeading(
    cleanText(headingCell.text()),
    "detail session",
  );
  const labels = directCells($, headerRows[1], "th", 2, "detail labels").map(
    (cell) => cleanText(cell.text()),
  );
  if (
    !["EMINDIA Skills School Course", "EMINDIA Skills Mela Course"].includes(
      labels[0],
    ) ||
    labels[1] !== "Venue"
  ) {
    throw new Error("EMINDIA detail labels drifted");
  }
  const expectedRows = labels[0] === "EMINDIA Skills School Course" ? 4 : 1;
  const rows = directRows(
    $,
    table,
    "tbody",
    expectedRows,
    "detail course rows",
  );
  const courses = rows.map((row, index) => {
    const cells = directCells($, row, "td", 2, `detail course ${index + 1}`);
    const title = cleanText(cells[0].text());
    const venue = cleanText(cells[1].text());
    if (!title || title.length > 300 || venue !== VENUE_NAME) {
      throw new Error("EMINDIA detail course or venue drifted");
    }
    return title;
  });
  if (new Set(courses).size !== courses.length) {
    throw new Error("EMINDIA repeated a course inside one session");
  }
  return { label: labels[0], session, courses };
}

function findSummaryRow(rows, title) {
  const matches = rows.filter((row) => row.activityLines[0] === title);
  if (matches.length !== 1) {
    throw new Error(`EMINDIA ${title} summary row count drifted`);
  }
  return matches[0];
}

function requireVenueLine(row, label) {
  if (row.activityLines.length !== 2 || row.activityLines[1] !== VENUE_NAME) {
    throw new Error(`EMINDIA ${label} summary venue drifted`);
  }
}

function requireFeeNote(row, label) {
  if (
    !row.noteLines.some((noteLine) =>
      /\bfees? appl(?:y|ies)\b/i.test(noteLine),
    ) ||
    row.noteLines.some((noteLine) => /\bfree\b/i.test(noteLine))
  ) {
    throw new Error(`EMINDIA ${label} fee evidence drifted`);
  }
}

function conferenceTitles(lines) {
  const titles = [];
  for (const activityLine of lines) {
    if (activityLine.startsWith("(")) {
      if (titles.length < 1) {
        throw new Error("EMINDIA conference continuation has no title");
      }
      titles[titles.length - 1] =
        `${titles[titles.length - 1]} ${activityLine}`;
    } else {
      titles.push(activityLine);
    }
  }
  if (titles.length < 1 || titles.some((title) => title.length > 300)) {
    throw new Error("EMINDIA conference titles are outside the reviewed bound");
  }
  return titles;
}

function timedOccurrence(title, session) {
  return {
    title,
    date: session.date,
    startMinute: session.startMinute,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    timePrecision: "timed",
  };
}

function dateOccurrence(title, date) {
  return {
    title,
    date,
    startMinute: null,
    startsAt: null,
    endsAt: null,
    timePrecision: "date",
  };
}

function observedLocalOrdinal(instant) {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS)
    .toISOString()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!shifted) {
    throw new Error("EMINDIA could not derive the job's local date");
  }
  return calendarDate(
    Number(shifted[1]),
    Number(shifted[2]),
    Number(shifted[3]),
    "job local date",
  ).ordinal;
}

function parseSchedule(markup, observedOrdinal) {
  const $ = load_html(markup);
  if (typeof $ !== "function") {
    throw new Error("EMINDIA HTML parser was not initialized");
  }
  const conferenceHeading = requireCount(
    $("h2").filter(
      (_, node) => cleanText($(node).text()) === "Conference Details",
    ),
    1,
    "Conference Details heading",
  );
  const globalVenue = metadataValue($, "Location");
  if (globalVenue !== VENUE_NAME) {
    throw new Error("EMINDIA global venue drifted");
  }
  const globalStart = parseLongDate(
    metadataValue($, "Start Date"),
    "global start",
  );
  const globalEnd = parseLongDate(metadataValue($, "End Date"), "global end");

  const allTables = $("table");
  requireCount(allTables, 8, "page table");
  const scheduleSelection = requireCount(
    requireCount(
      conferenceHeading.parent().children(".is-acf-field"),
      1,
      "Conference Details field",
    ).children(".value"),
    1,
    "Conference Details value",
  ).children("table");
  requireCount(scheduleSelection, 5, "schedule table");
  const scheduleTables = [];
  scheduleSelection.each((_, node) => {
    const table = $(node);
    if (
      hasExactClasses(table, ["table", "table-bordered", "text-center"]) &&
      table.attr("border") === "1" &&
      table.attr("cellspacing") === "0" &&
      table.attr("cellpadding") === "5"
    ) {
      scheduleTables.push(table);
    } else {
      throw new Error("EMINDIA schedule table signature drifted");
    }
  });
  const commercialTables = [];
  allTables.each((_, node) => {
    const table = $(node);
    if (
      hasExactClasses(table, [
        "table",
        "table-bordered",
        "text-center",
        "align-middle",
      ]) ||
      hasExactClasses(table, ["table", "table-bordered"])
    ) {
      commercialTables.push(table);
    }
  });
  if (
    scheduleTables.length !== 5 ||
    commercialTables.length !== 3 ||
    commercialTables.filter((table) =>
      hasExactClasses(table, [
        "table",
        "table-bordered",
        "text-center",
        "align-middle",
      ]),
    ).length !== 1 ||
    commercialTables.filter((table) =>
      hasExactClasses(table, ["table", "table-bordered"]),
    ).length !== 2
  ) {
    throw new Error("EMINDIA schedule/commercial table boundary drifted");
  }
  const summaries = [];
  const details = [];
  for (const table of scheduleTables) {
    const headerRows = requireCount(
      table.children("thead"),
      1,
      "table head",
    ).children("tr");
    if (headerRows.length === 1) summaries.push(parseSummaryTable($, table));
    else if (headerRows.length === 2) details.push(parseDetailTable($, table));
    else throw new Error("EMINDIA schedule table shape drifted");
  }
  if (summaries.length !== 2 || details.length !== 3) {
    throw new Error("EMINDIA schedule table roles drifted");
  }

  const preCandidates = summaries.filter((rows) =>
    rows.some(
      (row) =>
        row.activityLines[0] ===
        "WHO-CCET Emergency Care Network (WECAN) Roundtable",
    ),
  );
  if (preCandidates.length !== 1) {
    throw new Error("EMINDIA pre-conference summary count drifted");
  }
  const preRows = preCandidates[0];
  const conferenceRows = summaries.find((rows) => rows !== preRows);
  if (!conferenceRows || conferenceRows.length !== 3) {
    throw new Error("EMINDIA conference summary count drifted");
  }

  const restricted = findSummaryRow(
    preRows,
    "WHO-CCET Emergency Care Network (WECAN) Roundtable",
  );
  requireVenueLine(restricted, "WECAN");
  requireFeeNote(restricted, "WECAN");
  parseSourceDateRange(restricted.dateText, "WECAN date");
  if (
    restricted.noteLines.filter(
      (noteLine) => noteLine === "By invitation only.",
    ).length !== 1
  ) {
    throw new Error("EMINDIA WECAN invitation-only marker drifted");
  }

  const melaSummary = findSummaryRow(preRows, "Skills Mela");
  const schoolsSummary = findSummaryRow(preRows, "EMINDIA Skills Schools");
  requireVenueLine(melaSummary, "Skills Mela");
  requireVenueLine(schoolsSummary, "Skills Schools");
  requireFeeNote(melaSummary, "Skills Mela");
  requireFeeNote(schoolsSummary, "Skills Schools");
  const melaDate = parseSourceDate(melaSummary.dateText, "Skills Mela date");
  const schoolsDate = parseSourceDate(
    schoolsSummary.dateText,
    "Skills Schools date",
  );

  const melaDetails = details.filter(
    (detail) => detail.label === "EMINDIA Skills Mela Course",
  );
  const schoolDetails = details
    .filter((detail) => detail.label === "EMINDIA Skills School Course")
    .sort(
      (left, right) => left.session.startMinute - right.session.startMinute,
    );
  if (melaDetails.length !== 1 || schoolDetails.length !== 2) {
    throw new Error("EMINDIA detailed session count drifted");
  }
  if (
    melaDetails[0].session.date.date !== melaDate.date ||
    schoolDetails.some(
      (detail) => detail.session.date.date !== schoolsDate.date,
    )
  ) {
    throw new Error("EMINDIA summary and detail dates disagree");
  }
  if (
    schoolDetails[0].session.endMinute > schoolDetails[1].session.startMinute ||
    JSON.stringify(schoolDetails[0].courses) !==
      JSON.stringify(schoolDetails[1].courses)
  ) {
    throw new Error("EMINDIA Skills School sessions disagree or overlap");
  }

  const occurrences = [];
  for (const title of melaDetails[0].courses) {
    occurrences.push(timedOccurrence(title, melaDetails[0].session));
  }
  for (const detail of schoolDetails) {
    for (const title of detail.courses) {
      occurrences.push(timedOccurrence(title, detail.session));
    }
  }
  for (const row of conferenceRows) {
    requireFeeNote(row, "conference");
    const date = parseSourceDate(row.dateText, "conference date");
    for (const title of conferenceTitles(row.activityLines)) {
      occurrences.push(dateOccurrence(title, date));
    }
  }

  if (occurrences.length !== EXPECTED_PUBLIC_OCCURRENCES) {
    throw new Error("EMINDIA public occurrence count drifted");
  }
  const ordinals = occurrences.map((occurrence) => occurrence.date.ordinal);
  if (
    Math.min(...ordinals) !== globalStart.ordinal ||
    Math.max(...ordinals) !== globalEnd.ordinal
  ) {
    throw new Error("EMINDIA global and schedule date bounds disagree");
  }
  return occurrences.filter(
    (occurrence) =>
      occurrence.date.ordinal >= observedOrdinal &&
      occurrence.date.ordinal <= observedOrdinal + WINDOW_DAYS,
  );
}

function canonicalRecord(occurrence, observedAt) {
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: null,
    source_url: SOURCE_URL,
    source_host: SOURCE_HOST,
    city_slug: CITY_SLUG,
    title: occurrence.title,
    category: "other",
    start_date: occurrence.date.date,
    starts_at: occurrence.startsAt,
    end_date: occurrence.date.date,
    ends_at: occurrence.endsAt,
    time_precision: occurrence.timePrecision,
    timezone: TIMEZONE,
    venue_name: VENUE_NAME,
    venue_address: null,
    is_free: false,
    price_min_minor: null,
    price_max_minor: null,
    currency: null,
    registration_url: SOURCE_URL,
    registration_state: null,
    status: "scheduled",
    language: [],
    age_note: null,
    accessibility_note: null,
    image_url: null,
    observed_at: observedAt,
  };
}

function identityTuple(record) {
  return [
    normalizedIdentityText(record.title),
    record.source_url,
    record.starts_at ?? record.start_date,
    normalizedIdentityText(record.venue_name),
  ].join("\u001f");
}

function validateRecord(record) {
  if (
    Object.keys(record).length !== canonicalKeys.length ||
    canonicalKeys.some(
      (key) => !Object.prototype.hasOwnProperty.call(record, key),
    )
  ) {
    throw new Error("EMINDIA record does not have the canonical key set");
  }
  if (
    record.title.length < 1 ||
    record.title.length > 300 ||
    record.source_url !== SOURCE_URL ||
    record.registration_url !== SOURCE_URL ||
    record.source_host !== SOURCE_HOST ||
    record.venue_name !== VENUE_NAME ||
    record.city_slug !== CITY_SLUG ||
    record.timezone !== TIMEZONE ||
    record.is_free !== false ||
    record.price_min_minor !== null ||
    record.price_max_minor !== null ||
    record.currency !== null ||
    record.registration_state !== null ||
    record.image_url !== null
  ) {
    throw new Error("EMINDIA record left the reviewed mapping");
  }
  if (
    (record.time_precision === "timed" &&
      (typeof record.starts_at !== "string" ||
        typeof record.ends_at !== "string")) ||
    (record.time_precision === "date" &&
      (record.starts_at !== null || record.ends_at !== null))
  ) {
    throw new Error("EMINDIA record has inconsistent time precision");
  }
  return true;
}

const sourceURL = boundedSourceUrl(input.url);
const observedInstant = new Date(job.created);
if (!Number.isFinite(observedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}
const observedAt = observedInstant.toISOString();
const observedOrdinal = observedLocalOrdinal(observedInstant);
const occurrences = parseSchedule(
  responseHtml(request(sourceURL)),
  observedOrdinal,
);
if (occurrences.length < 1 || occurrences.length > MAX_RECORDS) {
  throw new Error(
    "EMINDIA current occurrence count is outside the reviewed bound",
  );
}

const records = occurrences.map((occurrence) =>
  canonicalRecord(occurrence, observedAt),
);
const identities = new Set();
for (const record of records) {
  validateRecord(record);
  const identity = identityTuple(record);
  if (identities.has(identity)) {
    throw new Error("EMINDIA repeated a fallback occurrence identity");
  }
  identities.add(identity);
}
for (const record of records) {
  collect(record, validateRecord);
}
