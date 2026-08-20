const PIANO_SOURCE_HOST = "www.thepianoman.in";
const PIANO_SOURCE_PATH = "/event/list";
const PIANO_SOURCE_URL = `https://${PIANO_SOURCE_HOST}${PIANO_SOURCE_PATH}`;
const PIANO_CITY = "delhi";
const PIANO_TIMEZONE = "Asia/Kolkata";
const PIANO_WINDOW_DAYS = 90;
const PIANO_WEEKLY_REQUESTS = 13;
const PIANO_MIN_RESPONSE_CHARACTERS = 30;
const PIANO_MAX_RESPONSE_CHARACTERS = 200000;
const PIANO_MAX_CARDS_PER_WINDOW = 60;
const PIANO_MIN_RECORDS = 1;
const PIANO_MAX_RECORDS = 150;
const PIANO_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const PIANO_VENUES = {
  1: {
    name: "The Piano Man Jazz Club, Safdarjung",
    address:
      "Commercial Complex B 6/7-22 Opp Deer Park, Safdarjung Enclave, New Delhi, Delhi 110029",
    emit: true,
  },
  2: {
    name: "The Piano Man Eldeco Centre, Saket",
    address: "Eldeco Centre, Hauz Rani, Malviya Nagar, New Delhi, Delhi 110017",
    emit: true,
  },
  3: {
    name: "The Piano Man Gurugram, 32nd Avenue",
    address: "32nd Avenue, Sector 15 Part 2, Gurugram, Haryana 122002",
    emit: false,
  },
};
const PIANO_GENRE_MAP = {
  "Alternative Rock": "music",
  Blues: "music",
  Bollywood: "music",
  "Classic Rock": "music",
  Contemporary: "other",
  "Ethno Jazz": "music",
  "Film Screening": "arts",
  Folk: "music",
  Ghazal: "music",
  "Indian Classical": "music",
  "Indian Fusion": "music",
  Instrumental: "music",
  Jazz: "music",
  "Jazz Fusion": "music",
  "Lunch Sessions": "other",
  "Modern jazz": "music",
  Pop: "music",
  "Pop Rock": "music",
  "Psychedelic Rock": "music",
  Qawwali: "music",
  Recital: "other",
  Retro: "music",
  "Retro pop": "music",
  Rock: "music",
  "Singer - Songwriter": "music",
  "Soft Rock": "music",
  Sufi: "music",
  Theatre: "theatre",
  "World Music": "music",
};
const PIANO_CANONICAL_KEYS = [
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
const PIANO_ONES = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const PIANO_TEENS = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const PIANO_TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function pianoCleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function pianoText(value, label, maximum, required = true) {
  const text = pianoCleanText(value);
  if ((required && text.length === 0) || text.length > maximum) {
    throw new Error(`Piano Man ${label} left the reviewed text boundary`);
  }
  return text;
}

function pianoHasExplicitPort(value) {
  const authority =
    String(value ?? "").match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  return /:\d+$/.test(authority);
}

function pianoBoundedInput(value) {
  const candidate = value === undefined ? PIANO_SOURCE_URL : value;
  if (typeof candidate !== "string" || candidate.length === 0) {
    bad_input("Piano Man input must contain one URL string");
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    bad_input("Piano Man input must contain a valid URL");
  }
  if (
    candidate !== PIANO_SOURCE_URL ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== PIANO_SOURCE_HOST ||
    parsed.host !== PIANO_SOURCE_HOST ||
    parsed.pathname !== PIANO_SOURCE_PATH ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    pianoHasExplicitPort(candidate)
  ) {
    bad_input("Piano Man input must be the bare reviewed event-list URL");
  }
  return PIANO_SOURCE_URL;
}

function pianoCalendarDate(year, month, day, label) {
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
    throw new Error(`Piano Man ${label} is impossible`);
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

function pianoDateFromOrdinal(ordinal, label) {
  if (!Number.isInteger(ordinal)) {
    throw new Error(`Piano Man ${label} ordinal is invalid`);
  }
  const era = Math.floor(ordinal / 146097);
  const dayOfEra = ordinal - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1;
  const month = shiftedMonth + (shiftedMonth < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return pianoCalendarDate(year, month, day, label);
}

function pianoObservedClock(value) {
  if (value === undefined || value === null || value === "") {
    value = new Date();
  }
  if (
    typeof value !== "string" &&
    Object.prototype.toString.call(value) !== "[object Date]"
  ) {
    throw new Error("Piano Man job creation time is required");
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("Piano Man job creation time is invalid");
  }
  const local = new Date(instant.getTime() + 330 * 60 * 1000);
  const date = pianoCalendarDate(
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

function pianoDateText(date) {
  return date.value;
}

function pianoWindowUrl(date) {
  return `https://${PIANO_SOURCE_HOST}${PIANO_SOURCE_PATH}/${pianoDateText(date)}`;
}

function pianoResponseText(value) {
  const text =
    typeof value === "string"
      ? value
      : value && typeof value.body === "string"
        ? value.body
        : null;
  if (
    text === null ||
    text.length < PIANO_MIN_RESPONSE_CHARACTERS ||
    text.length > PIANO_MAX_RESPONSE_CHARACTERS
  ) {
    throw new Error("Piano Man JSON response size left the reviewed boundary");
  }
  return text;
}

function pianoOwnKeys(object, expected, label) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    throw new Error(`Piano Man ${label} is not an object`);
  }
  const actual = Object.keys(object).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new Error(`Piano Man ${label} shape drifted`);
  }
  return object;
}

function pianoPayload(value, expectedNext) {
  const responseText = pianoResponseText(value);
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error("Piano Man JSON response is invalid");
  }
  pianoOwnKeys(payload, ["addSevenDate", "html"], "JSON response");
  if (
    typeof payload.html !== "string" ||
    payload.html.length > PIANO_MAX_RESPONSE_CHARACTERS ||
    payload.addSevenDate !== expectedNext.value
  ) {
    throw new Error("Piano Man weekly response cursor drifted");
  }
  return payload;
}

function pianoClassTokens($, node) {
  return new Set(
    pianoCleanText($(node).attr("class")).split(" ").filter(Boolean),
  );
}

function pianoNodesWithClass($, root, tag, className) {
  const matches = [];
  $(root)
    .find(tag)
    .each((_, node) => {
      if (pianoClassTokens($, node).has(className)) matches.push(node);
    });
  return matches;
}

function pianoOneClassNode($, root, tag, className, label) {
  const matches = pianoNodesWithClass($, root, tag, className);
  if (matches.length !== 1) {
    throw new Error(`Piano Man ${label} shape drifted`);
  }
  return matches[0];
}

function pianoTagNodes($, root, tag) {
  const matches = [];
  $(root)
    .find(tag)
    .each((_, node) => matches.push(node));
  return matches;
}

function pianoOneTagNode($, root, tag, label) {
  const matches = pianoTagNodes($, root, tag);
  if (matches.length !== 1) {
    throw new Error(`Piano Man ${label} shape drifted`);
  }
  return matches[0];
}

function pianoBelowThousandWords(value) {
  const words = [];
  let remaining = value;
  if (remaining >= 100) {
    const hundreds = Math.floor(remaining / 100);
    words.push(
      Object.keys(PIANO_ONES).find((word) => PIANO_ONES[word] === hundreds),
    );
    words.push("hundred");
    remaining %= 100;
  }
  if (remaining >= 20) {
    const tens = Math.floor(remaining / 10) * 10;
    words.push(
      Object.keys(PIANO_TENS).find((word) => PIANO_TENS[word] === tens),
    );
    remaining %= 10;
  } else if (remaining >= 10) {
    words.push(
      Object.keys(PIANO_TEENS).find((word) => PIANO_TEENS[word] === remaining),
    );
    remaining = 0;
  }
  if (remaining > 0) {
    words.push(
      Object.keys(PIANO_ONES).find((word) => PIANO_ONES[word] === remaining),
    );
  }
  return words;
}

function pianoNumberWords(value) {
  if (!Number.isInteger(value) || value < 1 || value > 9999) return null;
  const words = [];
  if (value >= 1000) {
    const thousands = Math.floor(value / 1000);
    words.push(...pianoBelowThousandWords(thousands), "thousand");
    value %= 1000;
  }
  words.push(...pianoBelowThousandWords(value));
  return words.join("-");
}

function pianoParseBelowThousand(tokens) {
  if (tokens.length === 0) return 0;
  let index = 0;
  let value = 0;
  if (
    index + 1 < tokens.length &&
    PIANO_ONES[tokens[index]] &&
    tokens[index + 1] === "hundred"
  ) {
    value += PIANO_ONES[tokens[index]] * 100;
    index += 2;
  }
  if (index < tokens.length && PIANO_TEENS[tokens[index]]) {
    value += PIANO_TEENS[tokens[index]];
    index += 1;
  } else if (index < tokens.length && PIANO_TENS[tokens[index]]) {
    value += PIANO_TENS[tokens[index]];
    index += 1;
    if (index < tokens.length && PIANO_ONES[tokens[index]]) {
      value += PIANO_ONES[tokens[index]];
      index += 1;
    }
  } else if (index < tokens.length && PIANO_ONES[tokens[index]]) {
    value += PIANO_ONES[tokens[index]];
    index += 1;
  }
  return index === tokens.length && value > 0 ? value : null;
}

function pianoParseNumberWords(tokens) {
  const thousandIndexes = [];
  tokens.forEach((token, index) => {
    if (token === "thousand") thousandIndexes.push(index);
  });
  if (thousandIndexes.length > 1) return null;
  if (thousandIndexes.length === 0) return pianoParseBelowThousand(tokens);
  const thousandIndex = thousandIndexes[0];
  const leading = pianoParseBelowThousand(tokens.slice(0, thousandIndex));
  const trailingTokens = tokens.slice(thousandIndex + 1);
  const trailing =
    trailingTokens.length === 0 ? 0 : pianoParseBelowThousand(trailingTokens);
  if (leading === null || trailing === null) return null;
  const value = leading * 1000 + trailing;
  return value >= 1 && value <= 9999 ? value : null;
}

function pianoNativeId(slug) {
  const tokens = slug.split("-");
  const matches = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const suffix = tokens.slice(index);
    const value = pianoParseNumberWords(suffix);
    if (value !== null && pianoNumberWords(value) === suffix.join("-")) {
      matches.push({ index, value });
    }
  }
  if (matches.length === 0) {
    throw new Error("Piano Man detail slug has no canonical native ID suffix");
  }
  matches.sort((left, right) => left.index - right.index);
  return String(matches[0].value);
}

function pianoDetailUrl(rawValue) {
  const raw = pianoText(rawValue, "detail URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Piano Man detail URL is invalid");
  }
  const match = parsed.pathname.match(
    /^\/event\/detail\/([123])\/([a-z0-9]+(?:-[a-z0-9]+)*)$/,
  );
  if (
    raw !== parsed.toString() ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== PIANO_SOURCE_HOST ||
    parsed.host !== PIANO_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    pianoHasExplicitPort(raw) ||
    !match
  ) {
    throw new Error("Piano Man detail URL left the reviewed boundary");
  }
  return {
    eventId: pianoNativeId(match[2]),
    slug: match[2],
    url: parsed.toString(),
    venueId: match[1],
  };
}

function pianoImageUrl(rawValue) {
  const raw = pianoText(rawValue, "image URL", 2048);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Piano Man image URL is invalid");
  }
  let path;
  try {
    path = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error("Piano Man image URL encoding is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== PIANO_SOURCE_HOST ||
    parsed.host !== PIANO_SOURCE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    pianoHasExplicitPort(raw) ||
    !/^\/admin\/uploads\/(?:events\/image_3_[0-9]+|artist\/profile_pic[23][0-9]+)\.(?:jpe?g|png|webp)$/i.test(
      path,
    )
  ) {
    throw new Error("Piano Man image URL left the reviewed boundary");
  }
  return parsed.toString();
}

function pianoCardDate(value) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) throw new Error("Piano Man card date format drifted");
  return pianoCalendarDate(
    2000 + Number(match[3]),
    Number(match[2]),
    Number(match[1]),
    "card date",
  );
}

function pianoSeatingTime(value) {
  const match = value.match(/^Seating Time (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!match) throw new Error("Piano Man seating time format drifted");
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error("Piano Man seating time is impossible");
  }
  if (hour === 12) hour = 0;
  if (match[3] === "PM") hour += 12;
  return { minute: hour * 60 + minute };
}

function pianoPrice(value) {
  const match = value.match(/^Rs\. ([1-9][0-9]{0,5})$/);
  if (!match) throw new Error("Piano Man public ticket price drifted");
  const rupees = Number(match[1]);
  if (!Number.isSafeInteger(rupees * 100)) {
    throw new Error("Piano Man public ticket price is unsafe");
  }
  return rupees * 100;
}

function pianoCard($, node, observed) {
  const direct = [];
  $(node)
    .children()
    .each((_, child) => direct.push(child));
  if (direct.length !== 2) {
    throw new Error("Piano Man card root shape drifted");
  }
  const imageContainer = direct[0];
  const body = direct[1];
  if (
    !pianoClassTokens($, imageContainer).has("card-img-top") ||
    !pianoClassTokens($, body).has("card-body")
  ) {
    throw new Error("Piano Man card container shape drifted");
  }
  const image = pianoOneTagNode($, imageContainer, "img", "card image");
  const bodyChildren = [];
  $(body)
    .children()
    .each((_, child) => bodyChildren.push(child));
  if (
    bodyChildren.length !== 5 ||
    bodyChildren[0].tagName !== "div" ||
    bodyChildren[1].tagName !== "div" ||
    bodyChildren[2].tagName !== "h3" ||
    bodyChildren[3].tagName !== "div" ||
    bodyChildren[4].tagName !== "div" ||
    !pianoClassTokens($, bodyChildren[4]).has("price")
  ) {
    throw new Error("Piano Man card body shape drifted");
  }
  const hero = pianoOneClassNode(
    $,
    bodyChildren[0],
    "div",
    "hero-venue-date",
    "date and seating block",
  );
  const spans = pianoTagNodes($, hero, "span");
  if (spans.length !== 3) {
    throw new Error("Piano Man date and seating shape drifted");
  }
  const weekday = pianoText($(spans[0]).text(), "weekday", 20);
  const date = pianoCardDate(pianoText($(spans[1]).text(), "date", 8));
  const seating = pianoSeatingTime(
    pianoText($(spans[2]).text(), "seating time", 40),
  );
  if (PIANO_WEEKDAYS[(date.ordinal + 3) % 7] !== weekday) {
    throw new Error("Piano Man weekday and date disagree");
  }
  const genre = pianoText($(bodyChildren[1]).text(), "genre", 100);
  const title = pianoText($(bodyChildren[2]).text(), "title", 300);
  const venueName = pianoText($(bodyChildren[3]).text(), "venue", 300);
  const priceText = pianoText($(bodyChildren[4]).text(), "price", 80);
  const detail = pianoDetailUrl($(node).attr("href"));
  const venue = PIANO_VENUES[detail.venueId];
  if (!venue || venueName !== venue.name) {
    throw new Error("Piano Man venue ID and name disagree");
  }
  const imageUrl = pianoImageUrl($(image).attr("src"));
  const privateClosure =
    genre === "Private Event" &&
    title === "Venue Closed" &&
    priceText === "NON-TICKETED";
  if (
    genre === "Private Event" ||
    title === "Venue Closed" ||
    priceText === "NON-TICKETED"
  ) {
    if (!privateClosure) {
      throw new Error("Piano Man non-public row contract drifted");
    }
    return { date, detail, emit: false, seating };
  }
  if (!venue.emit) {
    pianoPrice(priceText);
    return { date, detail, emit: false, seating };
  }
  const category = PIANO_GENRE_MAP[genre];
  if (!category) throw new Error("Piano Man genre needs mapping review");
  const priceMinor = pianoPrice(priceText);
  return {
    date,
    detail,
    emit: venue.emit,
    seating,
    record: {
      schema_version: "event-occurrence/v1",
      source_event_id: detail.eventId,
      source_url: detail.url,
      source_host: PIANO_SOURCE_HOST,
      city_slug: PIANO_CITY,
      title,
      category,
      start_date: date.value,
      starts_at: null,
      end_date: null,
      ends_at: null,
      time_precision: "date",
      timezone: PIANO_TIMEZONE,
      venue_name: venue.name,
      venue_address: venue.address,
      is_free: false,
      price_min_minor: priceMinor,
      price_max_minor: null,
      currency: "INR",
      registration_url: detail.url,
      registration_state: null,
      status: "scheduled",
      language: [],
      age_note: null,
      accessibility_note: null,
      image_url: imageUrl,
      observed_at: observed.observedAt,
    },
  };
}

function pianoValidateRecord(record) {
  pianoOwnKeys(record, PIANO_CANONICAL_KEYS, "canonical record");
  if (
    record.schema_version !== "event-occurrence/v1" ||
    !/^[0-9]+$/.test(record.source_event_id) ||
    record.source_host !== PIANO_SOURCE_HOST ||
    record.city_slug !== PIANO_CITY ||
    typeof record.title !== "string" ||
    record.title.length < 1 ||
    record.title.length > 300 ||
    !Object.values(PIANO_GENRE_MAP).includes(record.category) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.start_date) ||
    record.starts_at !== null ||
    record.end_date !== null ||
    record.ends_at !== null ||
    record.time_precision !== "date" ||
    record.timezone !== PIANO_TIMEZONE ||
    !Object.values(PIANO_VENUES).some(
      (venue) =>
        venue.emit &&
        venue.name === record.venue_name &&
        venue.address === record.venue_address,
    ) ||
    record.is_free !== false ||
    !Number.isInteger(record.price_min_minor) ||
    record.price_min_minor < 100 ||
    record.price_max_minor !== null ||
    record.currency !== "INR" ||
    record.registration_url !== record.source_url ||
    record.registration_state !== null ||
    record.status !== "scheduled" ||
    !Array.isArray(record.language) ||
    record.language.length !== 0 ||
    record.age_note !== null ||
    record.accessibility_note !== null ||
    typeof record.image_url !== "string" ||
    typeof record.observed_at !== "string"
  ) {
    throw new Error("Piano Man record left the reviewed mapping");
  }
  const detail = pianoDetailUrl(record.source_url);
  if (detail.eventId !== record.source_event_id || detail.venueId === "3") {
    throw new Error("Piano Man record identity or Delhi venue drifted");
  }
  if (pianoImageUrl(record.image_url) !== record.image_url) {
    throw new Error("Piano Man record image is not canonical");
  }
  return true;
}

pianoBoundedInput(input?.url);
const pianoObserved = pianoObservedClock(job?.created);
const pianoHorizonOrdinal = pianoObserved.date.ordinal + PIANO_WINDOW_DAYS;
let pianoBoundary = pianoDateFromOrdinal(
  pianoObserved.date.ordinal - 1,
  "initial weekly boundary",
);
const pianoRows = [];

for (let index = 0; index < PIANO_WEEKLY_REQUESTS; index += 1) {
  const pianoExpectedNext = pianoDateFromOrdinal(
    pianoBoundary.ordinal + 7,
    "weekly cursor",
  );
  const pianoPayloadValue = pianoPayload(
    request(pianoWindowUrl(pianoBoundary)),
    pianoExpectedNext,
  );
  const pianoCards = [];
  let $ = null;
  if (pianoPayloadValue.html !== "") {
    $ = load_html(pianoPayloadValue.html);
    $("a").each((_, node) => {
      const tokens = pianoClassTokens($, node);
      if (tokens.has("card") && tokens.has("img-content-card")) {
        pianoCards.push(node);
      }
    });
  }
  if (pianoCards.length > PIANO_MAX_CARDS_PER_WINDOW) {
    throw new Error("Piano Man weekly card count left the reviewed boundary");
  }
  for (const pianoCardNode of pianoCards) {
    const row = pianoCard($, pianoCardNode, pianoObserved);
    const minimumOrdinal = pianoBoundary.ordinal + 1;
    const maximumOrdinal = pianoExpectedNext.ordinal;
    if (
      row.date.ordinal < minimumOrdinal ||
      row.date.ordinal > maximumOrdinal ||
      row.date.ordinal < pianoObserved.date.ordinal ||
      row.date.ordinal > pianoHorizonOrdinal
    ) {
      throw new Error("Piano Man card escaped its weekly or 90-day window");
    }
    pianoRows.push(row);
  }
  pianoBoundary = pianoExpectedNext;
}

const pianoAllEventIds = new Set();
const pianoAllDetailUrls = new Set();
for (const row of pianoRows) {
  if (
    pianoAllEventIds.has(row.detail.eventId) ||
    pianoAllDetailUrls.has(row.detail.url)
  ) {
    throw new Error("Piano Man repeated a native event identity");
  }
  pianoAllEventIds.add(row.detail.eventId);
  pianoAllDetailUrls.add(row.detail.url);
}

const pianoRecords = pianoRows
  .filter(
    (row) =>
      row.emit &&
      (row.date.ordinal > pianoObserved.date.ordinal ||
        row.seating.minute >= pianoObserved.minute),
  )
  .map((row) => row.record)
  .sort(
    (left, right) =>
      left.start_date.localeCompare(right.start_date) ||
      Number(left.source_event_id) - Number(right.source_event_id),
  );

if (
  pianoRecords.length < PIANO_MIN_RECORDS ||
  pianoRecords.length > PIANO_MAX_RECORDS
) {
  throw new Error("Piano Man eligible record count left the reviewed boundary");
}
for (const record of pianoRecords) pianoValidateRecord(record);
for (const record of pianoRecords) collect(record, pianoValidateRecord);
