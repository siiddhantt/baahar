const SOURCE_HOST = "www.rudrakshcentre.com";
const SOURCE_PATH = "/upcoming-event";
const SOURCE_URL = `https://${SOURCE_HOST}${SOURCE_PATH}`;
const TIMEZONE = "Asia/Kolkata";
const VENUE_NAME = "Rudraksh International Cooperation & Convention Centre";
const MAX_RECORDS = 50;
const IST_OFFSET_MS = 330 * 60 * 1000;
const expectedHeaders = [
  "Event Date From",
  "Event Date to",
  "Organizing Body",
  "Event Name",
];
const monthNumbers = {
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
    bad_input("Rudraksh input must contain one URL string");
  }

  let url;
  try {
    url = new URL(candidateUrl);
  } catch {
    bad_input("Rudraksh input must be a valid URL");
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
    bad_input("Rudraksh input must be the bare reviewed upcoming-events URL");
  }
  return url;
}

function responseHtml(response) {
  if (typeof response === "string") return response;
  if (response && typeof response.body === "string") return response.body;
  throw new Error("Rudraksh returned an unsupported response shape");
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function parseSourceDate(value) {
  const match = cleanText(value).match(/^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/);
  if (!match) throw new Error("Rudraksh row has an invalid date format");

  const day = Number(match[1]);
  const month = monthNumbers[match[2]];
  const year = Number(match[3]);
  if (!month) throw new Error("Rudraksh row has an unsupported date month");
  if (year < 1 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error("Rudraksh row has an impossible calendar date");
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateInIst(instant) {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function categoryFor(eventName, organiser) {
  if (/\btheatre\b/i.test(`${eventName} ${organiser}`)) return "theatre";
  if (/\bsatsang\b/i.test(eventName)) return "community";

  const normalizedName = normalizedIdentityText(eventName);
  if (normalizedName === "conference" || normalizedName === "conferences") {
    return "talks";
  }
  return "other";
}

function cellTexts($, row, selector) {
  const values = [];
  const selection = row && typeof row.children === "function" ? row : $(row);
  selection
    .children(selector)
    .each((_, cell) => values.push(cleanText($(cell).text())));
  return values;
}

function hiddenRow($, row) {
  const element = $(row);
  const style = cleanText(element.attr("style"))
    .toLowerCase()
    .replace(/\s/g, "");
  return (
    element.attr("hidden") !== undefined ||
    element.attr("aria-hidden") === "true" ||
    style.includes("display:none") ||
    style.includes("visibility:hidden")
  );
}

function canonicalRecord(cells, observedAt, today) {
  if (cells.length !== 4 || cells.some((cell) => !cell)) {
    throw new Error(
      "Rudraksh visible row must have exactly four non-empty cells",
    );
  }

  const [fromValue, toValue, organiser, eventName] = cells;
  const startDate = parseSourceDate(fromValue);
  const endDate = parseSourceDate(toValue);
  if (startDate < today) {
    throw new Error("Rudraksh upcoming table contains a past visible row");
  }
  if (endDate < startDate) {
    throw new Error("Rudraksh event ends before it starts");
  }
  if (eventName.length > 300 || organiser.length > 300) {
    throw new Error("Rudraksh row exceeds a reviewed text bound");
  }

  return {
    schema_version: "event-occurrence/v1",
    source_event_id: null,
    source_url: SOURCE_URL,
    source_host: SOURCE_HOST,
    city_slug: "varanasi",
    title: eventName,
    category: categoryFor(eventName, organiser),
    start_date: startDate,
    starts_at: null,
    end_date: endDate,
    ends_at: null,
    time_precision: "date",
    timezone: TIMEZONE,
    venue_name: VENUE_NAME,
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
    image_url: null,
    observed_at: observedAt,
  };
}

function identityTuple(record) {
  return [
    normalizedIdentityText(record.title),
    record.source_url,
    record.start_date,
    normalizedIdentityText(record.venue_name),
  ].join("\u001f");
}

function validateRecord(record) {
  if (
    record.title.length > 300 ||
    record.venue_name.length > 300 ||
    record.source_url.length > 2048
  ) {
    throw new Error("Rudraksh event exceeds a canonical field limit");
  }
  return true;
}

const sourceUrl = boundedSourceUrl(input.url);
const observedInstant = new Date(job.created);
if (!Number.isFinite(observedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}

country("in");
const markup = responseHtml(request(sourceUrl.toString()));
const $ = load_html(markup);
if (typeof $ !== "function") {
  throw new Error("Rudraksh HTML parser was not initialized");
}

const reviewedTables = [];
$("table").each((_, table) => {
  const firstRow = $(table).find("tr").first();
  const headers = cellTexts($, firstRow, "th");
  if (
    headers.length === expectedHeaders.length &&
    headers.every((header, index) => header === expectedHeaders[index])
  ) {
    reviewedTables.push(table);
  }
});
if (reviewedTables.length !== 1) {
  throw new Error("Rudraksh page must contain one reviewed event table");
}

const observedAt = observedInstant.toISOString();
const today = dateInIst(observedInstant);
const records = [];
$(reviewedTables[0])
  .find("tr")
  .each((index, row) => {
    if (index === 0 || hiddenRow($, row)) return;
    const headers = cellTexts($, row, "th");
    if (headers.length) {
      throw new Error("Rudraksh event table contains an unexpected header row");
    }
    records.push(canonicalRecord(cellTexts($, row, "td"), observedAt, today));
  });

if (records.length < 1 || records.length > MAX_RECORDS) {
  throw new Error("Rudraksh visible row count is outside the reviewed bound");
}

const identities = new Set();
for (const record of records) {
  const identity = identityTuple(record);
  if (identities.has(identity)) {
    throw new Error("Rudraksh repeated a derived occurrence identity");
  }
  identities.add(identity);
  validateRecord(record);
}

for (const record of records) {
  collect(record, validateRecord);
}
