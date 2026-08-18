const SOURCE_HOST = "www.jagrititheatre.com";
const LIST_PATH = "/jagriti-events-collections";
const LIST_URL = `https://${SOURCE_HOST}${LIST_PATH}`;
const REGISTRATION_HOST = "in.bookmyshow.com";
const TIMEZONE = "Asia/Kolkata";
const VENUE_NAME = "Jagriti Theatre";
const VENUE_ADDRESS =
  "Jagriti, Ramagondanahalli, Varthur Road, Whitefield, Bengaluru 560066, India";
const MAX_EVENTS = 25;
const MAX_OCCURRENCES_PER_EVENT = 10;
const MAX_RECORDS = 50;
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
const metadataLabels = ["Ticket Price", "Genre", "Language", "Duration", "Age"];

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

function boundedListUrl(rawUrl) {
  const candidateUrl = rawUrl === undefined ? LIST_URL : rawUrl;
  if (typeof candidateUrl !== "string") {
    bad_input("Jagriti input must contain one URL string");
  }

  let url;
  try {
    url = new URL(candidateUrl);
  } catch {
    bad_input("Jagriti input must be a valid URL");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== SOURCE_HOST ||
    url.port ||
    hasExplicitPort(candidateUrl) ||
    url.username ||
    url.password ||
    url.pathname !== LIST_PATH ||
    url.search ||
    url.hash ||
    url.toString() !== LIST_URL
  ) {
    bad_input("Jagriti input must be the bare reviewed What's On URL");
  }
  return url;
}

function boundedDetailUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    throw new Error("Jagriti detail URL must be a string");
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Jagriti detail URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== SOURCE_HOST ||
    url.port ||
    hasExplicitPort(rawUrl) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname === LIST_PATH ||
    !/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname) ||
    url.toString() !== rawUrl
  ) {
    throw new Error("Jagriti detail URL left the reviewed source boundary");
  }
  return url.toString();
}

function boundedImageUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    throw new Error("Jagriti thumbnail URL must be a string");
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Jagriti thumbnail URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== SOURCE_HOST ||
    url.port ||
    hasExplicitPort(rawUrl) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/uploads\/images\/thumbnails\/[a-f0-9]{32}\.(?:jpe?g|png|webp)$/i.test(
      url.pathname,
    ) ||
    url.toString() !== rawUrl
  ) {
    throw new Error("Jagriti thumbnail URL left the reviewed image boundary");
  }
  return url.toString();
}

function boundedRegistrationUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    throw new Error("Jagriti registration URL must be a string");
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Jagriti registration URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== REGISTRATION_HOST ||
    url.port ||
    hasExplicitPort(rawUrl) ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/(?:plays|events|venue)\/[a-z0-9-]+\/[A-Z0-9-]+$/i.test(url.pathname) ||
    (url.search && url.search !== "?webview=true") ||
    url.toString() !== rawUrl
  ) {
    throw new Error(
      "Jagriti registration URL left the reviewed booking boundary",
    );
  }
  return url.toString();
}

function responseHtml(response) {
  if (typeof response === "string") return response;
  if (response && typeof response.body === "string") return response.body;
  throw new Error("Jagriti returned an unsupported response shape");
}

function requireCount(selection, expected, label) {
  if (selection.length !== expected) {
    throw new Error(`Jagriti ${label} count drifted`);
  }
  return selection;
}

function singleText(root, selector, label) {
  return cleanText(requireCount(root.find(selector), 1, label).text());
}

function singleAttribute(root, selector, attribute, label) {
  const selection = requireCount(root.find(selector), 1, label);
  const value = selection.attr(attribute);
  if (typeof value !== "string" || !value) {
    throw new Error(`Jagriti ${label} is missing ${attribute}`);
  }
  return value;
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

function calendarMinute(year, month, day, hour, minute) {
  return dayOrdinal(year, month, day) * 24 * 60 + hour * 60 + minute;
}

function parseLocalTimestamp(value) {
  const match = cleanText(value).match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (AM|PM)$/,
  );
  if (!match) {
    throw new Error("Jagriti performance has an invalid local timestamp");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const twelveHour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    twelveHour < 1 ||
    twelveHour > 12 ||
    minute > 59
  ) {
    throw new Error("Jagriti performance has an impossible local timestamp");
  }
  const hour = (twelveHour % 12) + (match[6] === "PM" ? 12 : 0);
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const time = `${String(hour).padStart(2, "0")}:${match[5]}`;
  return {
    date,
    instant: `${date}T${time}:00+05:30`,
    minute: calendarMinute(year, month, day, hour, minute),
  };
}

function observedLocalMinute(instant) {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS)
    .toISOString()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!shifted)
    throw new Error("Jagriti could not derive the job's local time");
  return calendarMinute(
    Number(shifted[1]),
    Number(shifted[2]),
    Number(shifted[3]),
    Number(shifted[4]),
    Number(shifted[5]),
  );
}

function parsePrice(value, requireLabel) {
  let text = cleanText(value);
  if (requireLabel) {
    const match = text.match(/^Ticket Price:\s*(.+)$/i);
    if (!match) throw new Error("Jagriti list price label drifted");
    text = match[1];
  }
  if (/^free$/i.test(text)) {
    return {
      key: "free",
      isFree: true,
      minimum: null,
      maximum: null,
      currency: null,
    };
  }
  const match = text.match(/^₹\s*([1-9]\d{0,5})$/);
  if (!match) throw new Error("Jagriti ticket price has an unsupported shape");
  const minor = Number(match[1]) * 100;
  return {
    key: `INR:${minor}`,
    isFree: false,
    minimum: minor,
    maximum: minor,
    currency: "INR",
  };
}

function categoryFor(genre) {
  if (/\b(?:music|concert|jazz|vocal)\b/i.test(genre)) return "music";
  if (/\b(?:theatre|drama|comedy|psychological|tragedy)\b/i.test(genre)) {
    return "theatre";
  }
  if (/\b(?:dance|bharatanatyam|visual art)\b/i.test(genre)) return "arts";
  if (/\b(?:talk|lecture)\b/i.test(genre)) return "talks";
  return "other";
}

function languagesFor(value) {
  const languages = cleanText(value).split(",").map(cleanText).filter(Boolean);
  if (
    languages.length < 1 ||
    languages.length > 12 ||
    languages.some((language) => language.length < 2 || language.length > 35) ||
    new Set(languages).size !== languages.length
  ) {
    throw new Error("Jagriti language metadata is outside the reviewed bound");
  }
  return languages;
}

function parseOccurrences($, root, expectedTitle) {
  const blocks = root.find(".addthisevent");
  if (blocks.length < 1 || blocks.length > MAX_OCCURRENCES_PER_EVENT) {
    throw new Error("Jagriti performance count is outside the reviewed bound");
  }
  const occurrences = [];
  blocks.each((_, node) => {
    const selection = $(node);
    const title = singleText(selection, ".title", "performance title");
    const timezone = singleText(selection, ".timezone", "performance timezone");
    const location = singleText(selection, ".location", "performance location");
    const organiser = singleText(
      selection,
      ".organizer",
      "performance organiser",
    );
    if (
      title !== expectedTitle ||
      timezone !== TIMEZONE ||
      location !== "Bangalore" ||
      organiser !== VENUE_NAME
    ) {
      throw new Error("Jagriti structured performance metadata drifted");
    }
    const start = parseLocalTimestamp(
      singleText(selection, ".start", "performance start"),
    );
    const end = parseLocalTimestamp(
      singleText(selection, ".end", "performance end"),
    );
    if (end.minute <= start.minute) {
      throw new Error("Jagriti performance end must follow its start");
    }
    occurrences.push({ title, timezone, start, end });
  });
  for (let index = 1; index < occurrences.length; index += 1) {
    if (
      occurrences[index - 1].start.minute >= occurrences[index].start.minute
    ) {
      throw new Error("Jagriti performances must be unique and ordered");
    }
  }
  return occurrences;
}

function occurrenceSignatures(occurrences) {
  return occurrences.map(
    (occurrence) =>
      `${occurrence.start.instant}\u001f${occurrence.end.instant}\u001f${occurrence.title}\u001f${occurrence.timezone}`,
  );
}

function parseList(markup) {
  const $ = load_html(markup);
  if (typeof $ !== "function") {
    throw new Error("Jagriti list HTML parser was not initialized");
  }
  requireCount($(".evtabbody"), 1, "list body");
  const rows = $(".evtabrow");
  if (rows.length < 1 || rows.length > MAX_EVENTS) {
    throw new Error("Jagriti event count is outside the reviewed bound");
  }
  const events = [];
  const detailURLs = new Set();
  rows.each((_, node) => {
    const row = $(node);
    const title = singleText(row, ".tevtit", "list title");
    if (!title || title.length > 300) {
      throw new Error("Jagriti list title is outside the canonical bound");
    }
    const titleLink = requireCount(
      row.find(".tevtit").find("a"),
      1,
      "list title link",
    );
    const detailURL = boundedDetailUrl(titleLink.attr("href"));
    if (detailURLs.has(detailURL)) {
      throw new Error("Jagriti repeated a detail URL");
    }
    detailURLs.add(detailURL);

    const image = requireCount(
      row.find(".evtabplimg").find("img"),
      1,
      "list thumbnail",
    );
    if (cleanText(image.attr("alt")) !== title) {
      throw new Error("Jagriti thumbnail title disagrees with the event title");
    }
    const imageURL = boundedImageUrl(image.attr("src"));
    const genre = singleText(row, ".evtabgenr", "list genre");
    if (!genre || genre.length > 200) {
      throw new Error("Jagriti genre is outside the reviewed bound");
    }
    const price = parsePrice(singleText(row, ".tevtpri", "list price"), true);
    const registrationURL = boundedRegistrationUrl(
      singleAttribute(
        row.find(".bmslink"),
        "a",
        "href",
        "list registration link",
      ),
    );
    const occurrences = parseOccurrences($, row, title);
    events.push({
      title,
      detailURL,
      imageURL,
      genre,
      price,
      registrationURL,
      occurrences,
    });
  });
  return events;
}

function detailMetadata($) {
  const table = requireCount($(".evedettab"), 1, "detail metadata table");
  const rows = table.find("tr");
  if (rows.length !== metadataLabels.length) {
    throw new Error("Jagriti detail metadata row count drifted");
  }
  const metadata = {};
  rows.each((_, node) => {
    const values = [];
    $(node)
      .children("td")
      .each((__, cell) => values.push(cleanText($(cell).text())));
    if (values.length !== 2 || !values[0] || !values[1]) {
      throw new Error("Jagriti detail metadata row is incomplete");
    }
    const label = values[0].replace(/:\s*$/, "");
    if (!metadataLabels.includes(label) || metadata[label] !== undefined) {
      throw new Error("Jagriti detail metadata label drifted");
    }
    metadata[label] = values[1];
  });
  if (metadataLabels.some((label) => metadata[label] === undefined)) {
    throw new Error("Jagriti detail metadata is incomplete");
  }
  return metadata;
}

function parseDetail(event, markup, observedMinute) {
  const $ = load_html(markup);
  if (typeof $ !== "function") {
    throw new Error("Jagriti detail HTML parser was not initialized");
  }
  const title = cleanText(requireCount($("h1"), 1, "detail title").text());
  if (title !== event.title) {
    throw new Error("Jagriti list and detail titles disagree");
  }
  const metadata = detailMetadata($);
  const detailPrice = parsePrice(metadata["Ticket Price"], false);
  if (detailPrice.key !== event.price.key || metadata.Genre !== event.genre) {
    throw new Error("Jagriti list and detail commercial metadata disagree");
  }
  const registrationURL = boundedRegistrationUrl(
    singleAttribute(
      requireCount($(".bmslink"), 1, "detail booking block"),
      "a",
      "href",
      "detail registration link",
    ),
  );
  if (registrationURL !== event.registrationURL) {
    throw new Error("Jagriti list and detail registration URLs disagree");
  }
  const occurrences = parseOccurrences($, $("body"), title);
  if (
    JSON.stringify(occurrenceSignatures(occurrences)) !==
    JSON.stringify(occurrenceSignatures(event.occurrences))
  ) {
    throw new Error("Jagriti list and detail performances disagree");
  }
  const durationMatch = cleanText(metadata.Duration).match(
    /^(\d{1,3}) minutes?$/i,
  );
  if (!durationMatch) {
    throw new Error("Jagriti duration metadata has an unsupported shape");
  }
  const durationMinutes = Number(durationMatch[1]);
  if (durationMinutes < 1 || durationMinutes > 720) {
    throw new Error("Jagriti duration is outside the reviewed bound");
  }
  for (const occurrence of occurrences) {
    if (occurrence.end.minute - occurrence.start.minute !== durationMinutes) {
      throw new Error("Jagriti performance interval disagrees with duration");
    }
  }
  const ageNote = cleanText(metadata.Age);
  if (!ageNote || ageNote.length > 300) {
    throw new Error("Jagriti age guidance is outside the canonical bound");
  }
  return {
    ...event,
    occurrences: occurrences.filter(
      (occurrence) => occurrence.start.minute >= observedMinute,
    ),
    language: languagesFor(metadata.Language),
    ageNote,
  };
}

function canonicalRecord(event, occurrence, observedAt) {
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: null,
    source_url: event.detailURL,
    source_host: SOURCE_HOST,
    city_slug: "bengaluru",
    title: event.title,
    category: categoryFor(event.genre),
    start_date: occurrence.start.date,
    starts_at: occurrence.start.instant,
    end_date: occurrence.end.date,
    ends_at: occurrence.end.instant,
    time_precision: "timed",
    timezone: TIMEZONE,
    venue_name: VENUE_NAME,
    venue_address: VENUE_ADDRESS,
    is_free: event.price.isFree,
    price_min_minor: event.price.minimum,
    price_max_minor: event.price.maximum,
    currency: event.price.currency,
    registration_url: event.registrationURL,
    registration_state: null,
    status: "scheduled",
    language: event.language,
    age_note: event.ageNote,
    accessibility_note: null,
    image_url: event.imageURL,
    observed_at: observedAt,
  };
}

function identityTuple(record) {
  return [
    normalizedIdentityText(record.title),
    record.source_url,
    record.starts_at,
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
    throw new Error("Jagriti record does not have the canonical key set");
  }
  if (
    record.title.length < 1 ||
    record.title.length > 300 ||
    record.source_url.length > 2048 ||
    record.registration_url.length > 2048 ||
    record.image_url.length > 2048 ||
    record.venue_address.length > 1000
  ) {
    throw new Error("Jagriti record exceeds a canonical field bound");
  }
  return true;
}

const listURL = boundedListUrl(input.url);
const observedInstant = new Date(job.created);
if (!Number.isFinite(observedInstant.getTime())) {
  throw new Error("Bright Data job has an invalid creation time");
}
const observedAt = observedInstant.toISOString();
const observedMinute = observedLocalMinute(observedInstant);
const listedEvents = parseList(responseHtml(request(listURL.toString())));
const completeEvents = [];
for (const event of listedEvents) {
  completeEvents.push(
    parseDetail(event, responseHtml(request(event.detailURL)), observedMinute),
  );
}

const records = [];
for (const event of completeEvents) {
  for (const occurrence of event.occurrences) {
    records.push(canonicalRecord(event, occurrence, observedAt));
  }
}
if (records.length < 1 || records.length > MAX_RECORDS) {
  throw new Error(
    "Jagriti total performance count is outside the reviewed bound",
  );
}

const identities = new Set();
for (const record of records) {
  const identity = identityTuple(record);
  if (identities.has(identity)) {
    throw new Error("Jagriti repeated a derived occurrence identity");
  }
  identities.add(identity);
  validateRecord(record);
}

for (const record of records) {
  collect(record, validateRecord);
}
