const BIEC_SOURCE_HOST = "www.biec.in";
const BIEC_SOURCE_PATH = "/events";
const BIEC_SOURCE_URL = `https://${BIEC_SOURCE_HOST}${BIEC_SOURCE_PATH}`;
const BIEC_CITY = "bengaluru";
const BIEC_LOCATION = "Bengaluru, Karnataka";
const BIEC_TIMEZONE = "Asia/Kolkata";
const BIEC_VENUE = "Bangalore International Exhibition Centre";
const BIEC_WINDOW_DAYS = 90;
const BIEC_MAX_YEAR_CARDS = 150;
const BIEC_MAX_ALL_BOXES = 1000;
const BIEC_MIN_RECORDS = 3;
const BIEC_MAX_RECORDS = 50;
const BIEC_MIN_HTML_CHARACTERS = 10000;
const BIEC_MAX_HTML_CHARACTERS = 1500000;
const BIEC_MONTHS = {
  Jan: 1,
  January: 1,
  Feb: 2,
  February: 2,
  Mar: 3,
  March: 3,
  Apr: 4,
  April: 4,
  May: 5,
  Jun: 6,
  June: 6,
  Jul: 7,
  July: 7,
  Aug: 8,
  August: 8,
  Sep: 9,
  September: 9,
  Oct: 10,
  October: 10,
  Nov: 11,
  November: 11,
  Dec: 12,
  December: 12,
};
const BIEC_CANONICAL_KEYS = [
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

function biecCleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function biecText(value, label, maximum, required = true) {
  const text = biecCleanText(value);
  if ((required && text.length === 0) || text.length > maximum) {
    throw new Error(`BIEC ${label} left the reviewed text boundary`);
  }
  return text;
}

function biecHasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function biecBoundedInput(value) {
  const candidate = value === undefined ? BIEC_SOURCE_URL : value;
  if (typeof candidate !== "string" || candidate.length === 0) {
    bad_input("BIEC input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    bad_input("BIEC input must contain a valid URL");
  }
  if (
    candidate !== BIEC_SOURCE_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== BIEC_SOURCE_HOST ||
    parsed.host !== BIEC_SOURCE_HOST ||
    parsed.pathname !== BIEC_SOURCE_PATH ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    biecHasExplicitPort(candidate)
  ) {
    bad_input("BIEC input must be the bare reviewed events URL");
  }
  return BIEC_SOURCE_URL;
}

function biecResponseHtml(value) {
  const html =
    typeof value === "string"
      ? value
      : value && typeof value.body === "string"
        ? value.body
        : null;
  if (
    html === null ||
    html.length < BIEC_MIN_HTML_CHARACTERS ||
    html.length > BIEC_MAX_HTML_CHARACTERS
  ) {
    throw new Error("BIEC HTML response left the reviewed boundary");
  }
  return html;
}

function biecClassTokens($, node) {
  return new Set(
    biecCleanText($(node).attr("class")).split(" ").filter(Boolean),
  );
}

function biecNodesWithClass($, root, tag, className) {
  const matches = [];
  $(root)
    .find(tag)
    .each((_, node) => {
      if (biecClassTokens($, node).has(className)) matches.push(node);
    });
  return matches;
}

function biecOneNode($, root, tag, className, label) {
  const matches = biecNodesWithClass($, root, tag, className);
  if (matches.length !== 1) {
    throw new Error(`BIEC ${label} shape drifted`);
  }
  return matches[0];
}

function biecOneParagraphText($, root, className, label) {
  const container = biecOneNode($, root, "span", className, label);
  const paragraphs = [];
  $(container)
    .find("p")
    .each((_, paragraph) => paragraphs.push(paragraph));
  if (paragraphs.length !== 1) {
    throw new Error(`BIEC ${label} paragraph shape drifted`);
  }
  return biecText($(paragraphs[0]).text(), label, 160);
}

function biecCalendarDate(year, month, day, label) {
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
    throw new Error(`BIEC ${label} is impossible`);
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

function biecObservedClock(value) {
  if (value === undefined || value === null || value === "") {
    value = new Date();
  }
  if (
    typeof value !== "string" &&
    Object.prototype.toString.call(value) !== "[object Date]"
  ) {
    throw new Error("BIEC job creation time is required");
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("BIEC job creation time is invalid");
  }
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  return {
    date: biecCalendarDate(
      local.getUTCFullYear(),
      local.getUTCMonth() + 1,
      local.getUTCDate(),
      "observed date",
    ),
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
    observedAt: instant.toISOString(),
  };
}

function biecTerminalYear(value) {
  const match = value.match(/\b(\d{4})$/);
  if (!match) throw new Error("BIEC card date lacks one terminal year");
  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("BIEC card date year is invalid");
  }
  return year;
}

function biecDateRange(value, expectedYear) {
  const match = value.match(
    /^([A-Z][a-z]+)\s+(\d{1,2})\s*(?:-\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2}))?,\s*(\d{4})$/,
  );
  if (!match) throw new Error("BIEC current date range format drifted");
  const startMonth = BIEC_MONTHS[match[1]];
  const endMonth = match[3] ? BIEC_MONTHS[match[3]] : startMonth;
  const year = Number(match[5]);
  if (!startMonth || !endMonth || year !== expectedYear) {
    throw new Error("BIEC current date range month or year drifted");
  }
  const start = biecCalendarDate(
    year,
    startMonth,
    Number(match[2]),
    "start date",
  );
  const end = biecCalendarDate(
    year,
    endMonth,
    Number(match[4] ?? match[2]),
    "end date",
  );
  if (end.ordinal < start.ordinal) {
    throw new Error("BIEC event ends before it starts");
  }
  return { start, end };
}

function biecTimePart(hourText, minuteText, meridiem, label) {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    !Number.isInteger(hour) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`BIEC ${label} is impossible`);
  }
  if (hour === 12) hour = 0;
  if (meridiem.toLowerCase() === "pm") hour += 12;
  return { hour, minute, ordinal: hour * 60 + minute };
}

function biecTimeRange(value) {
  const match = value.match(
    /^(\d{1,2}):(\d{2})(am|pm)\s*-\s*(\d{1,2}):(\d{2})(am|pm)$/i,
  );
  if (!match) throw new Error("BIEC time range format drifted");
  const start = biecTimePart(match[1], match[2], match[3], "start time");
  const end = biecTimePart(match[4], match[5], match[6], "end time");
  if (end.ordinal <= start.ordinal) {
    throw new Error("BIEC time range does not end after it starts");
  }
  return { start, end };
}

function biecTimestamp(date, time) {
  return `${date.value}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00+05:30`;
}

function biecCanonicalImage(rawValue) {
  const raw = biecText(rawValue, "image URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw, BIEC_SOURCE_URL);
  } catch {
    throw new Error("BIEC image URL is invalid");
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error("BIEC image URL encoding is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== BIEC_SOURCE_HOST ||
    parsed.host !== BIEC_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    biecHasExplicitPort(raw) ||
    !/^\/images\/events\/[A-Za-z0-9][A-Za-z0-9 ._()&'%-]*\.(?:webp|png|jpe?g)$/i.test(
      decodedPath,
    )
  ) {
    throw new Error("BIEC image URL left the reviewed boundary");
  }
  return parsed.toString();
}

function biecCanonicalDetail(rawValue, year) {
  const raw = biecText(rawValue, "detail URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw, BIEC_SOURCE_URL);
  } catch {
    throw new Error("BIEC detail URL is invalid");
  }
  const yearPath = `2k${String(year).slice(-2)}`;
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== BIEC_SOURCE_HOST ||
    parsed.host !== BIEC_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    biecHasExplicitPort(raw) ||
    !new RegExp(`^/Calendar_event/${yearPath}/[A-Za-z0-9_%+-]+\\.php$`).test(
      parsed.pathname,
    )
  ) {
    throw new Error("BIEC detail URL left the reviewed boundary");
  }
  return parsed.toString();
}

function biecPaginationPresent($) {
  let found = false;
  $("a").each((_, link) => {
    const rel = biecCleanText($(link).attr("rel")).toLowerCase();
    if (rel.split(" ").includes("next")) found = true;
  });
  for (const tag of ["nav", "ul", "div", "button"]) {
    $(tag).each((_, node) => {
      const tokens = biecClassTokens($, node);
      if (
        tokens.has("pager") ||
        tokens.has("pagination") ||
        tokens.has("load-more")
      )
        found = true;
    });
  }
  return found;
}

function biecCanonicalRecord(card, observedAt) {
  return {
    schema_version: "event-occurrence/v1",
    source_event_id: null,
    source_url: card.sourceUrl,
    source_host: BIEC_SOURCE_HOST,
    city_slug: BIEC_CITY,
    title: card.title,
    category: "other",
    start_date: card.dates.start.value,
    starts_at: biecTimestamp(card.dates.start, card.times.start),
    end_date: card.dates.end.value,
    ends_at: biecTimestamp(card.dates.end, card.times.end),
    time_precision: "timed",
    timezone: BIEC_TIMEZONE,
    venue_name: BIEC_VENUE,
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
    image_url: card.imageUrl,
    observed_at: observedAt,
  };
}

function biecOwnKeys(record) {
  const actual = Object.keys(record).sort();
  const expected = [...BIEC_CANONICAL_KEYS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("BIEC canonical record shape drifted");
  }
}

function biecValidateRecord(record) {
  biecOwnKeys(record);
  if (
    record.schema_version !== "event-occurrence/v1" ||
    record.source_event_id !== null ||
    record.source_host !== BIEC_SOURCE_HOST ||
    record.city_slug !== BIEC_CITY ||
    typeof record.title !== "string" ||
    record.title.length < 1 ||
    record.title.length > 300 ||
    record.category !== "other" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.end_date) ||
    !record.starts_at.startsWith(`${record.start_date}T`) ||
    !record.ends_at.startsWith(`${record.end_date}T`) ||
    !record.starts_at.endsWith("+05:30") ||
    !record.ends_at.endsWith("+05:30") ||
    record.time_precision !== "timed" ||
    record.timezone !== BIEC_TIMEZONE ||
    record.venue_name !== BIEC_VENUE ||
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
    throw new Error("BIEC record left the reviewed mapping");
  }
  const detail = new URL(record.source_url);
  const image = new URL(record.image_url);
  if (
    detail.protocol !== "https:" ||
    detail.host !== BIEC_SOURCE_HOST ||
    image.protocol !== "https:" ||
    image.host !== BIEC_SOURCE_HOST
  ) {
    throw new Error("BIEC record URL host drifted");
  }
  return true;
}

function biecIdentity(record) {
  return [
    biecCleanText(record.title).toLowerCase(),
    record.source_url,
    record.starts_at,
    biecCleanText(record.venue_name).toLowerCase(),
  ].join("\u001f");
}

const biecInputUrl = biecBoundedInput(input?.url);
const biecObserved = biecObservedClock(job?.created);
const biecHorizonOrdinal = biecObserved.date.ordinal + BIEC_WINDOW_DAYS;
const biecHtml = biecResponseHtml(request(biecInputUrl));
const $ = load_html(biecHtml);

const biecPageTitles = [];
$("title").each((_, node) =>
  biecPageTitles.push(biecCleanText($(node).text())),
);
const biecHeadings = [];
$("h1").each((_, node) => biecHeadings.push(biecCleanText($(node).text())));
if (
  biecPageTitles.length !== 1 ||
  biecPageTitles[0] !==
    ":: BIEC - Premier International Exhibition Centre ::" ||
  biecHeadings.length !== 1 ||
  biecHeadings[0] !== "Calender Of Events"
) {
  throw new Error("BIEC page identity drifted");
}
if (biecPaginationPresent($)) {
  throw new Error("BIEC page requires pagination review");
}

const biecObservedMinuteOrdinal =
  biecObserved.date.ordinal * 1440 + biecObserved.minute;
const biecEndOfObservedYear = biecCalendarDate(
  biecObserved.date.year,
  12,
  31,
  "observed year end",
).ordinal;
const biecHorizonYear =
  biecHorizonOrdinal > biecEndOfObservedYear
    ? biecObserved.date.year + 1
    : biecObserved.date.year;
const biecRequiredYears = [];
for (
  let biecRequiredYear = biecObserved.date.year;
  biecRequiredYear <= biecHorizonYear;
  biecRequiredYear += 1
) {
  biecRequiredYears.push(biecRequiredYear);
}

const biecTargetBoxes = new Set();
const biecTargetCards = [];
for (const biecRequiredYear of biecRequiredYears) {
  const biecMatchingTabs = [];
  $("li").each((_, node) => {
    if (
      biecClassTokens($, node).has("tab") &&
      biecCleanText($(node).text()) === String(biecRequiredYear)
    ) {
      biecMatchingTabs.push(node);
    }
  });
  if (biecMatchingTabs.length !== 1) {
    throw new Error("BIEC required year tab is missing or duplicated");
  }
  const biecRequiredTab = biecMatchingTabs[0];
  const biecTabIndex = biecCleanText($(biecRequiredTab).attr("id")).match(
    /^([1-9]\d*)-tab$/,
  )?.[1];
  const biecTabAnchors = [];
  $(biecRequiredTab)
    .find("a")
    .each((_, anchor) => biecTabAnchors.push(anchor));
  if (
    !biecTabIndex ||
    biecTabAnchors.length !== 1 ||
    biecCleanText($(biecTabAnchors[0]).attr("href")) !== "#"
  ) {
    throw new Error("BIEC required year tab shape drifted");
  }

  const biecMatchingContainers = [];
  $("div").each((_, node) => {
    if (biecCleanText($(node).attr("id")) === `tab${biecTabIndex}`) {
      biecMatchingContainers.push(node);
    }
  });
  if (
    biecMatchingContainers.length !== 1 ||
    !biecClassTokens($, biecMatchingContainers[0]).has("sort")
  ) {
    throw new Error("BIEC required year container is missing or invalid");
  }

  const biecYearBoxes = [];
  $(biecMatchingContainers[0])
    .find("div")
    .each((_, node) => {
      if (biecClassTokens($, node).has("box")) biecYearBoxes.push(node);
    });
  if (biecYearBoxes.length < 1 || biecYearBoxes.length > BIEC_MAX_YEAR_CARDS) {
    throw new Error("BIEC required year card count left the reviewed boundary");
  }
  for (const biecYearBox of biecYearBoxes) {
    biecTargetBoxes.add(biecYearBox);
    biecTargetCards.push({ box: biecYearBox, year: biecRequiredYear });
  }
}

const biecAllBoxes = [];
$("div").each((_, node) => {
  if (biecClassTokens($, node).has("box")) biecAllBoxes.push(node);
});
if (
  biecAllBoxes.length < biecTargetBoxes.size ||
  biecAllBoxes.length > BIEC_MAX_ALL_BOXES
) {
  throw new Error("BIEC page box count left the broad security boundary");
}
for (const biecOtherBox of biecAllBoxes) {
  if (biecTargetBoxes.has(biecOtherBox)) continue;
  const biecOtherDateNodes = biecNodesWithClass(
    $,
    biecOtherBox,
    "span",
    "event-date",
  );
  if (biecOtherDateNodes.length !== 1) continue;
  const biecOtherDateText = biecCleanText($(biecOtherDateNodes[0]).text());
  const biecOtherYear = biecOtherDateText.match(/\b(20\d{2})$/)?.[1];
  if (!biecOtherYear || !biecRequiredYears.includes(Number(biecOtherYear))) {
    continue;
  }
  const biecOtherDates = biecDateRange(
    biecOtherDateText,
    Number(biecOtherYear),
  );
  const biecOtherTimeText = biecOneParagraphText(
    $,
    biecOtherBox,
    "event-time",
    "escaped time",
  );
  const biecOtherTimes = biecTimeRange(biecOtherTimeText);
  const biecOtherEndMinuteOrdinal =
    biecOtherDates.end.ordinal * 1440 + biecOtherTimes.end.ordinal;
  if (
    biecOtherDates.start.ordinal <= biecHorizonOrdinal &&
    biecOtherEndMinuteOrdinal > biecObservedMinuteOrdinal
  ) {
    throw new Error("BIEC in-horizon card escaped its required year container");
  }
}

const biecTargetDetailUrls = new Set();
const biecEligibleCards = [];
for (const biecCard of biecTargetCards) {
  const biecDateText = biecOneParagraphText(
    $,
    biecCard.box,
    "event-date",
    "date",
  );
  const biecTimeText = biecOneParagraphText(
    $,
    biecCard.box,
    "event-time",
    "time",
  );
  const biecTimes = biecTimeRange(biecTimeText);
  const biecYear = biecTerminalYear(biecDateText);
  if (biecYear !== biecCard.year) {
    throw new Error("BIEC card date disagrees with its year container");
  }
  const biecDates = biecDateRange(biecDateText, biecYear);
  const biecEndMinuteOrdinal =
    biecDates.end.ordinal * 1440 + biecTimes.end.ordinal;
  if (
    biecDates.start.ordinal > biecHorizonOrdinal ||
    biecEndMinuteOrdinal <= biecObservedMinuteOrdinal
  ) {
    continue;
  }

  biecOneNode($, biecCard.box, "div", "box-top", "box top");
  biecOneNode($, biecCard.box, "div", "title-flex", "title container");
  biecOneNode($, biecCard.box, "h3", "box-title", "title heading");
  const biecTitleAnchors = biecNodesWithClass(
    $,
    biecCard.box,
    "a",
    "event-tit",
  );
  if (biecTitleAnchors.length !== 1) {
    throw new Error("BIEC eligible box left the modern card contract");
  }
  const biecTitle = biecText($(biecTitleAnchors[0]).text(), "title", 300);
  const biecTitleHref = biecText(
    $(biecTitleAnchors[0]).attr("href"),
    "title href",
    2048,
  );
  const biecSmallNodes = [];
  $(biecCard.box)
    .find("small")
    .each((_, node) => biecSmallNodes.push(node));
  if (biecSmallNodes.length !== 1) {
    throw new Error("BIEC organizer container shape drifted");
  }
  const biecOrganizerBold = [];
  $(biecSmallNodes[0])
    .find("b")
    .each((_, node) => biecOrganizerBold.push(node));
  if (biecOrganizerBold.length !== 1) {
    throw new Error("BIEC organizer shape drifted");
  }
  biecText($(biecOrganizerBold[0]).text(), "organizer", 300, false);
  const biecLocation = biecOneParagraphText(
    $,
    biecCard.box,
    "event-loc",
    "location",
  );
  if (biecLocation !== BIEC_LOCATION) {
    throw new Error("BIEC location drifted");
  }
  const biecImageNode = biecOneNode(
    $,
    biecCard.box,
    "img",
    "box-image",
    "image",
  );
  const biecImageUrl = biecCanonicalImage($(biecImageNode).attr("src"));

  const biecButtons = biecNodesWithClass($, biecCard.box, "a", "event-btn");
  if (
    biecButtons.length !== 1 ||
    biecCleanText($(biecButtons[0]).text()) !== "Read More" ||
    biecCleanText($(biecButtons[0]).attr("href")) !== biecTitleHref
  ) {
    throw new Error("BIEC current detail links drifted or disagree");
  }
  const biecSourceUrl = biecCanonicalDetail(biecTitleHref, biecYear);
  if (biecTargetDetailUrls.has(biecSourceUrl)) {
    throw new Error("BIEC repeated an eligible detail URL");
  }
  biecTargetDetailUrls.add(biecSourceUrl);
  biecEligibleCards.push({
    dates: biecDates,
    imageUrl: biecImageUrl,
    sourceUrl: biecSourceUrl,
    times: biecTimes,
    title: biecTitle,
  });
}

biecEligibleCards.sort((left, right) => {
  const leftStart = biecTimestamp(left.dates.start, left.times.start);
  const rightStart = biecTimestamp(right.dates.start, right.times.start);
  if (leftStart < rightStart) return -1;
  if (leftStart > rightStart) return 1;
  if (left.title < right.title) return -1;
  if (left.title > right.title) return 1;
  return 0;
});
if (
  biecEligibleCards.length < BIEC_MIN_RECORDS ||
  biecEligibleCards.length > BIEC_MAX_RECORDS
) {
  throw new Error("BIEC eligible record count left the reviewed boundary");
}

const biecRecords = biecEligibleCards.map((card) =>
  biecCanonicalRecord(card, biecObserved.observedAt),
);
const biecIdentities = new Set();
const biecSourceUrls = new Set();
for (const biecRecord of biecRecords) {
  biecValidateRecord(biecRecord);
  const biecFallback = biecIdentity(biecRecord);
  if (
    biecIdentities.has(biecFallback) ||
    biecSourceUrls.has(biecRecord.source_url)
  ) {
    throw new Error(
      "BIEC repeated an eligible fallback identity or detail URL",
    );
  }
  biecIdentities.add(biecFallback);
  biecSourceUrls.add(biecRecord.source_url);
}
for (const biecRecord of biecRecords) {
  collect(biecRecord, biecValidateRecord);
}
