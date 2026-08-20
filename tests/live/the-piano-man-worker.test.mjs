import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parseFragment } from "parse5";

const sourceURL = "https://www.thepianoman.in/event/list";
const observedAt = "2026-08-20T00:00:00.000Z";
const boundaries = [
  "2026-08-19",
  "2026-08-26",
  "2026-09-02",
  "2026-09-09",
  "2026-09-16",
  "2026-09-23",
  "2026-09-30",
  "2026-10-07",
  "2026-10-14",
  "2026-10-21",
  "2026-10-28",
  "2026-11-04",
  "2026-11-11",
];
const windowURLs = boundaries.map((date) => `${sourceURL}/${date}`);
const venues = new Map([
  [
    "1",
    {
      address:
        "Commercial Complex B 6/7-22 Opp Deer Park, Safdarjung Enclave, New Delhi, Delhi 110029",
      emit: true,
      name: "The Piano Man Jazz Club, Safdarjung",
    },
  ],
  [
    "2",
    {
      address:
        "Eldeco Centre, Hauz Rani, Malviya Nagar, New Delhi, Delhi 110017",
      emit: true,
      name: "The Piano Man Eldeco Centre, Saket",
    },
  ],
  [
    "3",
    {
      address: "32nd Avenue, Sector 15 Part 2, Gurugram, Haryana 122002",
      emit: false,
      name: "The Piano Man Gurugram, 32nd Avenue",
    },
  ],
]);
const musicGenres = new Set([
  "Alternative Rock",
  "Blues",
  "Bollywood",
  "Classic Rock",
  "Ethno Jazz",
  "Folk",
  "Ghazal",
  "Indian Classical",
  "Indian Fusion",
  "Instrumental",
  "Jazz",
  "Jazz Fusion",
  "Modern jazz",
  "Pop",
  "Pop Rock",
  "Psychedelic Rock",
  "Qawwali",
  "Retro",
  "Retro pop",
  "Rock",
  "Singer - Songwriter",
  "Soft Rock",
  "Sufi",
  "World Music",
]);
const otherGenres = new Set(["Contemporary", "Lunch Sessions", "Recital"]);
const expectedKeys = [
  "accessibility_note",
  "age_note",
  "category",
  "city_slug",
  "currency",
  "end_date",
  "ends_at",
  "image_url",
  "is_free",
  "language",
  "observed_at",
  "price_max_minor",
  "price_min_minor",
  "registration_state",
  "registration_url",
  "schema_version",
  "source_event_id",
  "source_host",
  "source_url",
  "start_date",
  "starts_at",
  "status",
  "time_precision",
  "timezone",
  "title",
  "venue_address",
  "venue_name",
].sort();
const workerURL = new URL(
  "../../sources/delhi/the-piano-man/collector/worker.js",
  import.meta.url,
);
const contractURL = new URL(
  "../../contracts/collector-output.schema.json",
  import.meta.url,
);
const outputSchemaURL = new URL(
  "../../contracts/scraper-studio-output-schema.json",
  import.meta.url,
);
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(node, name) {
  return node?.attrs?.find((value) => value.name === name)?.value ?? "";
}

function children(node) {
  return node?.childNodes ?? [];
}

function elementChildren(node) {
  return children(node).filter((child) => Boolean(child.tagName));
}

function descendants(nodes, tag) {
  const matches = [];
  const visit = (node) => {
    for (const child of children(node)) {
      if (!tag || child.tagName === tag) matches.push(child);
      visit(child);
    }
  };
  for (const node of nodes) visit(node);
  return matches;
}

function nodeText(node) {
  if (node?.nodeName === "#text") return node.value;
  return children(node).map(nodeText).join("");
}

function classTokens(node) {
  return new Set(
    cleanText(attribute(node, "class")).split(" ").filter(Boolean),
  );
}

function withClass(nodes, tag, className) {
  return descendants(nodes, tag).filter((node) =>
    classTokens(node).has(className),
  );
}

function exactlyOne(values, label) {
  assert.equal(values.length, 1, label);
  return values[0];
}

function addDays(isoDate, amount) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

const oneValues = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
]);
const teenValues = new Map([
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
]);
const tenValues = new Map([
  ["twenty", 20],
  ["thirty", 30],
  ["forty", 40],
  ["fifty", 50],
  ["sixty", 60],
  ["seventy", 70],
  ["eighty", 80],
  ["ninety", 90],
]);

function belowThousand(tokens) {
  if (tokens.length === 0) return 0;
  let index = 0;
  let value = 0;
  if (oneValues.has(tokens[index]) && tokens[index + 1] === "hundred") {
    value += oneValues.get(tokens[index]) * 100;
    index += 2;
  }
  if (teenValues.has(tokens[index])) {
    value += teenValues.get(tokens[index]);
    index += 1;
  } else if (tenValues.has(tokens[index])) {
    value += tenValues.get(tokens[index]);
    index += 1;
    if (oneValues.has(tokens[index])) {
      value += oneValues.get(tokens[index]);
      index += 1;
    }
  } else if (oneValues.has(tokens[index])) {
    value += oneValues.get(tokens[index]);
    index += 1;
  }
  return index === tokens.length && value > 0 ? value : null;
}

function parseWords(tokens) {
  const thousand = tokens.indexOf("thousand");
  if (thousand !== -1 && tokens.indexOf("thousand", thousand + 1) !== -1) {
    return null;
  }
  if (thousand === -1) return belowThousand(tokens);
  const leading = belowThousand(tokens.slice(0, thousand));
  const tail = tokens.slice(thousand + 1);
  const trailing = tail.length === 0 ? 0 : belowThousand(tail);
  if (leading === null || trailing === null) return null;
  return leading * 1000 + trailing;
}

function independentID(slug) {
  const tokens = slug.split("-");
  const candidates = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const value = parseWords(tokens.slice(index));
    if (value && value <= 9999) candidates.push({ index, value });
  }
  assert.ok(candidates.length > 0, `missing canonical ID in ${slug}`);
  candidates.sort((left, right) => left.index - right.index);
  return String(candidates[0].value);
}

function independentCategory(genre) {
  if (musicGenres.has(genre)) return "music";
  if (otherGenres.has(genre)) return "other";
  if (genre === "Film Screening") return "arts";
  if (genre === "Theatre") return "theatre";
  assert.fail(`unreviewed genre ${genre}`);
}

function independentRows(payloadTexts) {
  const rows = [];
  const allCards = [];
  for (const [index, text] of payloadTexts.entries()) {
    assert.ok(text.length >= 30 && text.length <= 200_000);
    const payload = JSON.parse(text);
    assert.deepEqual(Object.keys(payload).sort(), ["addSevenDate", "html"]);
    assert.equal(payload.addSevenDate, addDays(boundaries[index], 7));
    const fragment = parseFragment(payload.html);
    const cards = descendants([fragment], "a").filter((node) => {
      const tokens = classTokens(node);
      return tokens.has("card") && tokens.has("img-content-card");
    });
    assert.ok(cards.length <= 60);
    for (const card of cards) {
      const path = new URL(attribute(card, "href"));
      const detailMatch = path.pathname.match(
        /^\/event\/detail\/([123])\/([a-z0-9]+(?:-[a-z0-9]+)*)$/,
      );
      assert.ok(detailMatch);
      assert.equal(path.hostname, "www.thepianoman.in");
      const body = exactlyOne(withClass([card], "div", "card-body"), "body");
      const parts = elementChildren(body);
      assert.deepEqual(
        parts.map((node) => node.tagName),
        ["div", "div", "h3", "div", "div"],
      );
      assert.equal(classTokens(parts[4]).has("price"), true);
      const hero = exactlyOne(
        withClass([parts[0]], "div", "hero-venue-date"),
        "hero",
      );
      const spans = descendants([hero], "span");
      assert.equal(spans.length, 3);
      const sourceDate = cleanText(nodeText(spans[1]));
      const dateMatch = sourceDate.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
      assert.ok(dateMatch);
      const date = `20${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      assert.ok(
        date >= addDays(boundaries[index], 1) &&
          date <= addDays(boundaries[index], 7),
      );
      const timeMatch = cleanText(nodeText(spans[2])).match(
        /^Seating Time (\d{1,2}):(\d{2}) (AM|PM)$/,
      );
      assert.ok(timeMatch);
      let hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      if (hour === 12) hour = 0;
      if (timeMatch[3] === "PM") hour += 12;
      const genre = cleanText(nodeText(parts[1]));
      const title = cleanText(nodeText(parts[2]));
      const venueName = cleanText(nodeText(parts[3]));
      const price = cleanText(nodeText(parts[4]));
      const venue = venues.get(detailMatch[1]);
      assert.equal(venueName, venue.name);
      const image = exactlyOne(descendants([card], "img"), "image");
      const imageURL = new URL(attribute(image, "src"));
      assert.equal(imageURL.hostname, "www.thepianoman.in");
      assert.match(
        decodeURIComponent(imageURL.pathname),
        /^\/admin\/uploads\/(?:events\/image_3_[0-9]+|artist\/profile_pic[23][0-9]+)\.(?:jpe?g|png|webp)$/i,
      );
      const eventID = independentID(detailMatch[2]);
      const privateClosure =
        genre === "Private Event" &&
        title === "Venue Closed" &&
        price === "NON-TICKETED";
      if (
        genre === "Private Event" ||
        title === "Venue Closed" ||
        price === "NON-TICKETED"
      ) {
        assert.equal(privateClosure, true);
      }
      const source = {
        date,
        detail: path.toString(),
        eventID,
        genre,
        image: imageURL.toString(),
        privateClosure,
        seatingMinute: hour * 60 + minute,
        title,
        venue,
        venueID: detailMatch[1],
      };
      allCards.push(source);
      if (!venue.emit || privateClosure) continue;
      const priceMatch = price.match(/^Rs\. ([1-9][0-9]{0,5})$/);
      assert.ok(priceMatch);
      rows.push({
        ...source,
        category: independentCategory(genre),
        priceMinor: Number(priceMatch[1]) * 100,
      });
    }
  }
  rows.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      Number(left.eventID) - Number(right.eventID),
  );
  return { allCards, rows };
}

class Selection {
  constructor(nodes) {
    this.nodes = nodes;
  }

  attr(name) {
    return attribute(this.nodes[0], name);
  }

  children(selector) {
    let values = this.nodes.flatMap(elementChildren);
    if (selector) values = values.filter((node) => node.tagName === selector);
    return new Selection(values);
  }

  each(callback) {
    this.nodes.forEach((node, index) => callback(index, node));
    return this;
  }

  find(selector) {
    return new Selection(descendants(this.nodes, selector));
  }

  text() {
    return this.nodes.map(nodeText).join("");
  }
}

function loadHtml(markup) {
  const fragment = parseFragment(markup);
  return (input) => {
    if (typeof input === "string") {
      return new Selection(descendants([fragment], input));
    }
    return new Selection(input ? [input] : []);
  };
}

let workerPromise;
function workerCode() {
  workerPromise ??= readFile(workerURL, "utf8");
  return workerPromise;
}

async function executeWorker(payloadTexts, options = {}) {
  const inputURL = Object.hasOwn(options, "inputURL")
    ? options.inputURL
    : sourceURL;
  const creationTime = Object.hasOwn(options, "creationTime")
    ? options.creationTime
    : observedAt;
  const responseMap = new Map(
    windowURLs.map((url, index) => [url, payloadTexts[index]]),
  );
  const worker = await workerCode();
  const parses = [];
  const records = [];
  const requests = [];
  class SandboxDate extends Date {
    constructor(value) {
      super(arguments.length === 0 ? observedAt : value);
    }
  }
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  Object.defineProperty(SandboxDate, "UTC", { value: undefined });
  const context = {
    input: { url: inputURL },
    job: { created: creationTime },
    request(url) {
      assert.equal(arguments.length, 1);
      requests.push(url);
      assert.equal(responseMap.has(url), true, `unexpected request ${url}`);
      return responseMap.get(url);
    },
    load_html(markup) {
      parses.push(markup);
      return loadHtml(markup);
    },
    bad_input(message) {
      throw new Error(`bad_input: ${message}`);
    },
    collect(record, validate) {
      assert.equal(validate(record), true);
      records.push(structuredClone(record));
    },
    Date: SandboxDate,
    URL,
    Map,
    Set,
    Number,
    String,
    Object,
    Array,
    Math,
    RegExp,
    JSON,
    structuredClone,
    decodeURIComponent,
  };
  try {
    vm.runInNewContext(worker, context, { filename: workerURL.pathname });
    return { error: null, parses, records, requests };
  } catch (error) {
    return { error, parses, records, requests };
  }
}

async function validateAuthoritativeSchema(records) {
  const child = spawn(
    process.env.GO_BINARY ?? "go",
    ["run", "./tests/live/collector-schema-validator.go"],
    { cwd: moduleRoot, stdio: ["pipe", "pipe", "pipe"] },
  );
  const output = [];
  const errors = [];
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.stderr.on("data", (chunk) => errors.push(chunk));
  child.stdin.end(JSON.stringify(records));
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", resolveExit);
  });
  assert.equal(
    exitCode,
    0,
    `${Buffer.concat(errors).toString()}${Buffer.concat(output).toString()}`,
  );
}

let livePromise;
function liveSource() {
  livePromise ??= (async () => {
    const payloadTexts = [];
    const diagnostics = [];
    for (const url of windowURLs) {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(20_000),
      });
      assert.equal(response.status, 200);
      assert.match(
        response.headers.get("content-type") ?? "",
        /^application\/json/i,
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      payloadTexts.push(bytes.toString("utf8"));
      diagnostics.push({
        bytes: bytes.length,
        hash: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    return { diagnostics, payloadTexts };
  })();
  return livePromise;
}

test("Piano Man exposes 13 complete official weekly windows", async (t) => {
  const live = await liveSource();
  const shape = independentRows(live.payloadTexts);
  assert.equal(live.payloadTexts.length, 13);
  assert.equal(shape.allCards.length, 106);
  assert.equal(
    new Set(shape.allCards.map((row) => row.eventID)).size,
    shape.allCards.length,
  );
  assert.equal(shape.allCards.filter((row) => row.venue.emit).length, 69);
  assert.equal(
    shape.allCards.filter((row) => row.venue.emit && row.privateClosure).length,
    2,
  );
  assert.equal(shape.rows.length, 67);
  assert.equal(shape.rows[0].date, "2026-08-20");
  assert.equal(shape.rows.at(-1).date, "2026-09-29");
  assert.equal(
    shape.rows.every(
      (row) => row.date >= "2026-08-20" && row.date <= "2026-11-18",
    ),
    true,
  );
  t.diagnostic(
    `requests/windows: 13/13; response bytes: ${live.diagnostics.map((item) => item.bytes).join(",")}; SHA-256s: ${live.diagnostics.map((item) => item.hash).join(",")}; all/Delhi/public: 106/69/67`,
  );
});

test("Piano Man Code worker emits the exact 67-row Delhi preview", async (t) => {
  const live = await liveSource();
  const expected = independentRows(live.payloadTexts).rows;
  const result = await executeWorker(live.payloadTexts);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, windowURLs);
  assert.equal(
    result.parses.length,
    live.payloadTexts.filter((payload) => JSON.parse(payload).html !== "")
      .length,
  );
  assert.equal(result.parses.includes(""), false);
  assert.equal(result.records.length, 67);
  await validateAuthoritativeSchema(result.records);

  for (const [index, record] of result.records.entries()) {
    const source = expected[index];
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, source.eventID);
    assert.equal(record.source_url, source.detail);
    assert.equal(record.source_host, "www.thepianoman.in");
    assert.equal(record.city_slug, "delhi");
    assert.equal(record.title, source.title);
    assert.equal(record.category, source.category);
    assert.equal(record.start_date, source.date);
    assert.equal(record.starts_at, null);
    assert.equal(record.end_date, null);
    assert.equal(record.ends_at, null);
    assert.equal(record.time_precision, "date");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.venue_name, source.venue.name);
    assert.equal(record.venue_address, source.venue.address);
    assert.equal(record.is_free, false);
    assert.equal(record.price_min_minor, source.priceMinor);
    assert.equal(record.price_max_minor, null);
    assert.equal(record.currency, "INR");
    assert.equal(record.registration_url, source.detail);
    assert.equal(record.registration_state, null);
    assert.equal(record.status, "scheduled");
    assert.deepEqual(record.language, []);
    assert.equal(record.age_note, null);
    assert.equal(record.accessibility_note, null);
    assert.equal(record.image_url, source.image);
    assert.equal(record.observed_at, observedAt);
  }
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(`canonical rows: 67; SHA-256: ${recordHash}`);
});

test("Piano Man interaction stays at 13 Code requests with no crawler path", async () => {
  const worker = await workerCode();
  assert.equal((worker.match(/\brequest\s*\(/g) ?? []).length, 1);
  assert.equal((worker.match(/\bload_html\s*\(/g) ?? []).length, 1);
  for (const forbidden of [
    /\bcountry\s*\(/,
    /\bnavigate\s*\(/,
    /\btag_response\s*\(/,
    /\bclick\s*\(/,
    /\bscroll_\w+\s*\(/,
    /\bnext_stage\s*\(/,
    /\brerun_stage\s*\(/,
  ]) {
    assert.doesNotMatch(worker, forbidden);
  }
});

test("Piano Man cursor, mapping, action, venue, and URL drift fail atomically", async () => {
  const live = await liveSource();
  const mutations = [];
  const mutateFirst = (transform) => {
    const values = [...live.payloadTexts];
    const payload = JSON.parse(values[0]);
    transform(payload);
    values[0] = JSON.stringify(payload);
    return values;
  };

  mutations.push([
    mutateFirst((payload) => {
      payload.addSevenDate = "2026-08-27";
    }),
    /weekly response cursor drifted/,
  ]);
  mutations.push([
    mutateFirst((payload) => {
      payload.extra = true;
    }),
    /JSON response shape drifted/,
  ]);
  mutations.push([
    mutateFirst((payload) => {
      payload.html = payload.html.replace("<div>Pop</div>", "<div>Magic</div>");
    }),
    /genre needs mapping review/,
  ]);
  mutations.push([
    mutateFirst((payload) => {
      payload.html = payload.html.replace(
        "https://www.thepianoman.in/event/detail/1/",
        "https://example.com/event/detail/1/",
      );
    }),
    /detail URL left the reviewed boundary/,
  ]);
  mutations.push([
    mutateFirst((payload) => {
      payload.html = payload.html.replace(
        "The Piano Man Jazz Club, Safdarjung",
        "Unreviewed Hall",
      );
    }),
    /venue ID and name disagree/,
  ]);
  mutations.push([
    mutateFirst((payload) => {
      payload.html = payload.html.replace("Rs. 199", "Free");
    }),
    /public ticket price drifted/,
  ]);
  mutations.push([
    mutateFirst((payload) => {
      payload.html = payload.html.replace("NON-TICKETED", "Rs. 1");
    }),
    /non-public row contract drifted/,
  ]);

  for (const [payloads, expectedError] of mutations) {
    const result = await executeWorker(payloads);
    assert.match(String(result.error), expectedError);
    assert.deepEqual(result.records, []);
    assert.ok(result.requests.length >= 1 && result.requests.length <= 13);
  }
});

test("Piano Man input, response, and seating-time gates are exact", async (t) => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.payloadTexts, {
    inputURL: undefined,
  });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, windowURLs);
  assert.equal(saveProbe.records.length, 67);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?venue=1`,
    "https://www.thepianoman.in:443/event/list",
    "https://thepianoman.in/event/list",
  ]) {
    const result = await executeWorker(live.payloadTexts, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed event-list URL/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }

  const invalid = [...live.payloadTexts];
  invalid[0] = "{}";
  const invalidResult = await executeWorker(invalid);
  assert.match(
    String(invalidResult.error),
    /JSON response size left the reviewed boundary/,
  );
  assert.deepEqual(invalidResult.records, []);

  const atEveningSeating = await executeWorker(live.payloadTexts, {
    creationTime: "2026-08-20T15:00:00.000Z",
  });
  assert.ifError(atEveningSeating.error);
  assert.equal(atEveningSeating.records.length, 66);

  const afterEveningSeating = await executeWorker(live.payloadTexts, {
    creationTime: "2026-08-20T15:01:00.000Z",
  });
  assert.ifError(afterEveningSeating.error);
  assert.equal(afterEveningSeating.records.length, 64);
  assert.equal(
    afterEveningSeating.records.every(
      (record) => record.start_date > "2026-08-20",
    ),
    true,
  );
  const afterEveningHash = createHash("sha256")
    .update(JSON.stringify(afterEveningSeating.records))
    .digest("hex");
  assert.equal(
    afterEveningHash,
    "11549d234c0486aec8c92ee921cf500c9a54547fff98860e2bc4a24a4572b04d",
  );
  const afterEveningStableHash = createHash("sha256")
    .update(
      JSON.stringify(
        afterEveningSeating.records.map((record) =>
          Object.fromEntries(Object.entries(record).sort()),
        ),
      ),
    )
    .digest("hex");
  assert.equal(
    afterEveningStableHash,
    "dd1245a3966dd6a110b207865650b7f202630a59a3e4e91b3c75f50a0cc5027d",
  );
  t.diagnostic(`post-evening canonical SHA-256: ${afterEveningHash}`);
  t.diagnostic(`post-evening stable SHA-256: ${afterEveningStableHash}`);

  if (process.env.PIANO_STUDIO_DATASET) {
    const studioRows = JSON.parse(
      await readFile(
        resolve(moduleRoot, process.env.PIANO_STUDIO_DATASET),
        "utf8",
      ),
    );
    assert.deepEqual(
      studioRows.map((row) => row.input),
      Array.from({ length: studioRows.length }, () => ({ url: sourceURL })),
    );
    const normalizedStudioRows = studioRows.map(
      ({ input: _input, ...row }) => ({
        ...row,
        observed_at: "2026-08-20T15:01:00.000Z",
      }),
    );
    const byNativeID = (left, right) =>
      Number(left.source_event_id) - Number(right.source_event_id);
    assert.deepEqual(
      normalizedStudioRows.sort(byNativeID),
      [...afterEveningSeating.records].sort(byNativeID),
    );
  }

  for (const creationTime of ["invalid", 42, {}]) {
    const result = await executeWorker(live.payloadTexts, { creationTime });
    assert.match(String(result.error), /job creation time/);
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }
});

test("Piano Man uses the authoritative 27-field staging schema", async () => {
  const [contract, outputSchema] = await Promise.all([
    readFile(contractURL, "utf8").then(JSON.parse),
    readFile(outputSchemaURL, "utf8").then(JSON.parse),
  ]);
  assert.equal(contract.additionalProperties, false);
  assert.deepEqual([...contract.required].sort(), expectedKeys);
  assert.equal(contract.properties.city_slug.enum.includes("delhi"), true);
  assert.deepEqual(Object.keys(outputSchema.fields).sort(), expectedKeys);
  for (const field of Object.values(outputSchema.fields)) {
    assert.equal(field.active, true);
    assert.equal(field.default_value, "null");
  }
});
