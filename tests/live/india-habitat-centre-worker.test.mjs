import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parse } from "parse5";

const sourceURL = "https://indiahabitat.org/Events";
const observedAt = "2026-08-20T00:00:00.000Z";
const expectedIDs = [
  "1353",
  "1354",
  "1355",
  "1356",
  "1357",
  "1358",
  "1359",
  "1375",
  "1361",
  "1362",
  "1363",
  "1364",
  "1365",
  "1366",
  "1367",
  "1368",
  "1369",
  "1370",
  "1371",
  "1372",
];
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
const sourceTypeCategories = new Map([
  ["Music", "music"],
  ["Dance", "arts"],
  ["Film", "arts"],
  ["Film & Talk", "talks"],
  ["Film & Theatre", "theatre"],
  ["Theatre", "theatre"],
  ["Talk", "talks"],
  ["Music & Dance", "arts"],
  ["Walk", "community"],
  ["Workshop", "workshops"],
  ["Online", "other"],
  ["Other", "other"],
]);
const monthNumbers = new Map([
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
const workerURL = new URL(
  "../../sources/delhi/india-habitat-centre/collector/worker.js",
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

function canonicalImage(raw) {
  const parsed = new URL(raw, sourceURL);
  const path = `/${decodeURIComponent(parsed.pathname).replace(/^\/+/, "")}`;
  assert.equal(parsed.hostname, "indiahabitat.org");
  assert.match(path, /^\/uploads\/[0-9]+_[A-Za-z0-9]+\.(?:jpe?g|png|webp)$/i);
  return `https://indiahabitat.org${path}`;
}

function independentTime(value) {
  const match = value.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  assert.ok(match, `unreviewed time ${value}`);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  assert.ok(hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59);
  if (hour === 12) hour = 0;
  if (match[3] === "PM") hour += 12;
  return { hour, minute };
}

function independentShape(markup) {
  const document = parse(markup);
  const pageTitle = exactlyOne(descendants([document], "title"), "page title");
  assert.equal(cleanText(nodeText(pageTitle)), "India Habitat Centre");
  const allEvents = exactlyOne(
    descendants([document], "div").filter(
      (node) => attribute(node, "id") === "all-events",
    ),
    "all-events calendar",
  );
  const dateHeading = exactlyOne(
    withClass([allEvents], "div", "date-e"),
    "month heading",
  );
  const monthLabel = cleanText(
    nodeText(exactlyOne(descendants([dateHeading], "h4"), "month label")),
  );
  const monthMatch = monthLabel.match(/^([A-Z][a-z]+) (\d{4})$/);
  assert.ok(monthMatch);
  const month = monthNumbers.get(monthMatch[1]);
  const year = Number(monthMatch[2]);
  assert.equal(month, 8);
  assert.equal(year, 2026);
  const calendar = exactlyOne(
    withClass([allEvents], "div", "calendar-container"),
    "calendar",
  );
  const dayItems = withClass([calendar], "div", "day-item");
  assert.ok(dayItems.length >= 28 && dayItems.length <= 42);
  const rows = [];
  for (const dayItem of dayItems) {
    if (classTokens(dayItem).has("empty")) {
      assert.equal(withClass([dayItem], "div", "day-content").length, 0);
      continue;
    }
    const header = exactlyOne(
      withClass([dayItem], "div", "item-day"),
      "day header",
    );
    const day = Number(
      cleanText(nodeText(exactlyOne(descendants([header], "span"), "day"))),
    );
    assert.ok(Number.isInteger(day) && day >= 1 && day <= 31);
    for (const card of withClass([dayItem], "div", "day-content")) {
      const time = cleanText(
        nodeText(
          exactlyOne(withClass([card], "h4", "event-time"), "event time"),
        ),
      );
      const titleNode = exactlyOne(
        withClass([card], "h3", "event-name"),
        "event name",
      );
      const title = cleanText(nodeText(titleNode));
      const metadata = cleanText(
        nodeText(exactlyOne(descendants([card], "p"), "metadata")),
      );
      const parts = metadata.split(" | ");
      assert.equal(parts.length, 2);
      const category = sourceTypeCategories.get(parts[0]);
      assert.ok(category, `unmapped source type ${parts[0]}`);
      const moreInfo = exactlyOne(
        withClass([card], "a", "more-info"),
        "more info",
      );
      const detail = new URL(attribute(moreInfo, "href"));
      const id = detail.pathname.match(/^\/Events_details\/([0-9]+)$/)?.[1];
      assert.ok(id);
      assert.equal(detail.hostname, "indiahabitat.org");
      const allCardActions = descendants([card], "a")
        .map((node) => attribute(node, "href"))
        .filter((value) => /\/Events_details\//.test(value));
      assert.deepEqual([...new Set(allCardActions)], [detail.toString()]);
      const image = exactlyOne(descendants([card], "img"), "event image");
      const parsedTime = independentTime(time);
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      rows.push({
        category,
        date,
        id,
        image: canonicalImage(attribute(image, "src")),
        sourceType: parts[0],
        startsAt: `${date}T${String(parsedTime.hour).padStart(2, "0")}:${String(parsedTime.minute).padStart(2, "0")}:00+05:30`,
        title,
        url: detail.toString(),
        venue: parts[1],
      });
    }
  }
  rows.sort(
    (left, right) =>
      left.startsAt.localeCompare(right.startsAt) ||
      Number(left.id) - Number(right.id),
  );
  const pagination = descendants([document], "a").filter((node) =>
    cleanText(attribute(node, "rel")).toLowerCase().split(" ").includes("next"),
  );
  const pagingContainers = ["nav", "ul", "div", "button"].flatMap((tag) =>
    descendants([document], tag).filter((node) => {
      const tokens = classTokens(node);
      return (
        tokens.has("pager") ||
        tokens.has("pagination") ||
        tokens.has("load-more")
      );
    }),
  );
  return { dayItems, monthLabel, pagination, pagingContainers, rows };
}

class Selection {
  constructor(nodes) {
    this.nodes = nodes;
  }

  get length() {
    return this.nodes.length;
  }

  attr(name) {
    return attribute(this.nodes[0], name);
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
  const document = parse(markup);
  return (input) => {
    if (typeof input === "string") {
      return new Selection(descendants([document], input));
    }
    return new Selection(input ? [input] : []);
  };
}

let workerPromise;
function workerCode() {
  workerPromise ??= readFile(workerURL, "utf8");
  return workerPromise;
}

async function executeWorker(markup, options = {}) {
  const inputURL = Object.hasOwn(options, "inputURL")
    ? options.inputURL
    : sourceURL;
  const creationTime = Object.hasOwn(options, "creationTime")
    ? options.creationTime
    : observedAt;
  const worker = await workerCode();
  const requests = [];
  const parses = [];
  const records = [];
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
      return markup;
    },
    load_html(value) {
      parses.push(value);
      return loadHtml(value);
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
    const response = await fetch(sourceURL, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/i);
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      bytes,
      hash: createHash("sha256").update(bytes).digest("hex"),
      markup: bytes.toString("utf8"),
    };
  })();
  return livePromise;
}

test("IHC exposes one complete current-month official list", async (t) => {
  const live = await liveSource();
  assert.ok(live.bytes.length >= 20_000 && live.bytes.length <= 500_000);
  const shape = independentShape(live.markup);
  assert.equal(shape.monthLabel, "August 2026");
  assert.equal(shape.rows.length, 20);
  assert.deepEqual(
    shape.rows.map((row) => row.id),
    expectedIDs,
  );
  assert.equal(new Set(shape.rows.map((row) => row.url)).size, 20);
  assert.equal(shape.pagination.length, 0);
  assert.equal(shape.pagingContainers.length, 0);
  assert.equal(
    shape.rows.every(
      (row) =>
        row.date >= "2026-08-20" &&
        row.date <= "2026-11-18" &&
        row.url.startsWith("https://indiahabitat.org/Events_details/") &&
        row.image.startsWith("https://indiahabitat.org/uploads/"),
    ),
    true,
  );
  t.diagnostic(
    `requests/pages: 1/1; bytes: ${live.bytes.length}; SHA-256: ${live.hash}; current cards/native IDs: 20/20; pagination/detail fanout: 0/0`,
  );
});

test("IHC Code worker emits the exact 20-row canonical preview", async (t) => {
  const live = await liveSource();
  const expected = independentShape(live.markup).rows;
  const result = await executeWorker(live.markup);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [sourceURL]);
  assert.equal(result.parses.length, 1);
  assert.equal(result.records.length, 20);
  assert.deepEqual(
    result.records.map((record) => record.source_event_id),
    expectedIDs,
  );
  await validateAuthoritativeSchema(result.records);

  for (const [index, record] of result.records.entries()) {
    const source = expected[index];
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, source.id);
    assert.equal(record.source_url, source.url);
    assert.equal(record.source_host, "indiahabitat.org");
    assert.equal(record.city_slug, "delhi");
    assert.equal(record.title, source.title);
    assert.equal(record.category, source.category);
    assert.equal(record.start_date, source.date);
    assert.equal(record.starts_at, source.startsAt);
    assert.equal(record.end_date, null);
    assert.equal(record.ends_at, null);
    assert.equal(record.time_precision, "timed");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.venue_name, source.venue);
    assert.equal(
      record.venue_address,
      source.venue === "Online"
        ? null
        : "India Habitat Centre, Lodhi Road, New Delhi - 110003",
    );
    assert.equal(record.is_free, null);
    assert.equal(record.price_min_minor, null);
    assert.equal(record.price_max_minor, null);
    assert.equal(record.currency, null);
    assert.equal(record.registration_url, null);
    assert.equal(record.registration_state, null);
    assert.equal(record.status, "scheduled");
    assert.deepEqual(record.language, []);
    assert.equal(record.age_note, null);
    assert.equal(record.accessibility_note, null);
    assert.equal(record.image_url, source.image);
    assert.equal(record.observed_at, observedAt);
  }
  assert.equal(
    result.records.find((record) => record.source_event_id === "1375").category,
    "talks",
    "Book Discussion title/description must not override source type Talk",
  );
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(`canonical rows: 20; SHA-256: ${recordHash}`);
});

test("IHC interaction code has exactly one request and no crawler path", async () => {
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

test("IHC source, month, mapping, URL, and identity drift fail atomically", async () => {
  const live = await liveSource();
  const mutations = [
    [
      live.markup.replace(
        "<title>India Habitat Centre</title>",
        "<title>Changed</title>",
      ),
      /page identity drifted/,
    ],
    [
      live.markup.replace("August 2026", "September 2026"),
      /current month label drifted/,
    ],
    [
      live.markup.replace("Music | The Theatre", "Lecture | The Theatre"),
      /source type needs mapping review/,
    ],
    [
      live.markup.replace("Music | The Theatre", "Music | External Hall"),
      /venue needs mapping review/,
    ],
    [live.markup.replace("7:00 PM", "19:00"), /start time format drifted/],
    [
      live.markup.replace(
        "https://indiahabitat.org/Events_details/1353",
        "https://example.com/Events_details/1353",
      ),
      /detail URL left the reviewed boundary|card detail actions disagree/,
    ],
    [
      live.markup.replace(
        "https://indiahabitat.org//uploads/1784706429_5378c89aec2944b5854a.jpg",
        "https://example.com/uploads/1784706429_5378c89aec2944b5854a.jpg",
      ),
      /image URL left the reviewed boundary/,
    ],
    [
      live.markup.replaceAll("Events_details/1354", "Events_details/1353"),
      /repeated an eligible native event identity/,
    ],
    [
      live.markup.replace(
        "</body>",
        '<a rel="next" href="?page=2">Next</a></body>',
      ),
      /requires pagination review/,
    ],
  ];
  for (const [markup, expectedError] of mutations) {
    assert.notEqual(
      markup,
      live.markup,
      `mutation ${expectedError} must apply`,
    );
    const result = await executeWorker(markup);
    assert.match(String(result.error), expectedError);
    assert.deepEqual(result.records, []);
    assert.equal(result.requests.length, 1);
  }
});

test("IHC input, response, and no-inferred-ongoing gates are exact", async () => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.markup, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, [sourceURL]);
  assert.equal(saveProbe.records.length, 20);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?page=1`,
    "https://indiahabitat.org:443/Events",
    "https://www.indiahabitat.org/Events",
  ]) {
    const result = await executeWorker(live.markup, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed events URL/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }

  const truncated = await executeWorker("<html></html>");
  assert.match(
    String(truncated.error),
    /HTML response left the reviewed boundary/,
  );
  assert.deepEqual(truncated.records, []);

  const atFirstStart = await executeWorker(live.markup, {
    creationTime: "2026-08-21T13:30:00.000Z",
  });
  assert.ifError(atFirstStart.error);
  assert.equal(atFirstStart.records.length, 20);

  const afterFirstStart = await executeWorker(live.markup, {
    creationTime: "2026-08-21T13:31:00.000Z",
  });
  assert.ifError(afterFirstStart.error);
  assert.equal(afterFirstStart.records.length, 18);
  assert.equal(
    afterFirstStart.records.some(
      (record) =>
        record.source_event_id === "1353" || record.source_event_id === "1354",
    ),
    false,
  );

  const nextMonth = await executeWorker(live.markup, {
    creationTime: "2026-09-01T00:00:00.000Z",
  });
  assert.match(String(nextMonth.error), /current month label drifted/);
  assert.deepEqual(nextMonth.records, []);

  for (const creationTime of ["invalid", 42, {}]) {
    const result = await executeWorker(live.markup, { creationTime });
    assert.match(String(result.error), /job creation time/);
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }
});

test("IHC uses the authoritative 27-field staging schema", async () => {
  const [contract, outputSchema] = await Promise.all([
    readFile(contractURL, "utf8").then(JSON.parse),
    readFile(outputSchemaURL, "utf8").then(JSON.parse),
  ]);
  assert.equal(contract.additionalProperties, false);
  assert.deepEqual([...contract.required].sort(), expectedKeys);
  assert.deepEqual(contract.properties.city_slug.enum, [
    "bengaluru",
    "delhi",
    "varanasi",
  ]);
  assert.deepEqual(Object.keys(outputSchema.fields).sort(), expectedKeys);
  for (const field of Object.values(outputSchema.fields)) {
    assert.equal(field.active, true);
    assert.equal(field.default_value, "null");
  }
});
