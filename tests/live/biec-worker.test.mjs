import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { parse } from "parse5";

const sourceURL = "https://www.biec.in/events";
const observedAt = "2026-08-20T00:00:00.000Z";
const workerURL = new URL(
  "../../sources/bengaluru/biec/collector/worker.js",
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
const expectedRows = [
  {
    title: "Franchise India",
    start: "2026-08-22T09:00:00+05:30",
    end: "2026-08-23T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/franchise-india.php",
    image: "https://www.biec.in/images/events/franchise-india.webp",
  },
  {
    title: "India Med Expo",
    start: "2026-09-05T09:00:00+05:30",
    end: "2026-09-07T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/india-med-expo-2026.php",
    image: "https://www.biec.in/images/events/indiamed.webp",
  },
  {
    title: "Bangalore Space Expo",
    start: "2026-09-07T09:00:00+05:30",
    end: "2026-09-09T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/bangalore-space-expo.php",
    image: "https://www.biec.in/images/events/bangalore-space-expo.webp",
  },
  {
    title: "Electronica- Productronica",
    start: "2026-09-16T09:00:00+05:30",
    end: "2026-09-18T18:00:00+05:30",
    detail:
      "https://www.biec.in/Calendar_event/2k26/electronica-productronica.php",
    image: "https://www.biec.in/images/events/electronica.webp",
  },
  {
    title: "LWOP",
    start: "2026-09-16T09:00:00+05:30",
    end: "2026-09-18T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/lwop.php",
    image: "https://www.biec.in/images/events/lwop.webp",
  },
  {
    title: "Expodent",
    start: "2026-09-25T09:00:00+05:30",
    end: "2026-09-27T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/expodent.php",
    image: "https://www.biec.in/images/events/expo-dent-2025.webp",
  },
  {
    title: "HBLF",
    start: "2026-09-25T09:00:00+05:30",
    end: "2026-09-27T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/hblf.php",
    image: "https://www.biec.in/images/events/HBLF.webp",
  },
  {
    title: "Acetech",
    start: "2026-10-09T09:00:00+05:30",
    end: "2026-10-11T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/acetech.php",
    image: "https://www.biec.in/images/events/Acetech.webp",
  },
  {
    title: "Hindustan International Furniture Fair",
    start: "2026-10-24T09:00:00+05:30",
    end: "2026-10-26T18:00:00+05:30",
    detail: "https://www.biec.in/Calendar_event/2k26/hiff.php",
    image: "https://www.biec.in/images/events/Hiff-2026.webp",
  },
];
const monthNumber = new Map(
  [
    ["Jan", "January"],
    ["Feb", "February"],
    ["Mar", "March"],
    ["Apr", "April"],
    ["May"],
    ["Jun", "June"],
    ["Jul", "July"],
    ["Aug", "August"],
    ["Sep", "September"],
    ["Oct", "October"],
    ["Nov", "November"],
    ["Dec", "December"],
  ].flatMap((names, index) => names.map((month) => [month, index + 1])),
);

function descendants(nodes, tagName) {
  const matches = [];
  for (const node of nodes) {
    for (const child of node.childNodes ?? []) {
      if (child.tagName === tagName) matches.push(child);
      matches.push(...descendants([child], tagName));
    }
  }
  return matches;
}

function nodeText(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? []).map(nodeText).join("");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceFactAfter(markup, anchor, fact, replacement) {
  const anchorIndex = markup.indexOf(anchor);
  assert.notEqual(anchorIndex, -1, `eligible anchor ${anchor} must exist`);
  const factIndex = markup.indexOf(fact, anchorIndex);
  assert.notEqual(factIndex, -1, `eligible fact ${fact} must follow ${anchor}`);
  return `${markup.slice(0, factIndex)}${replacement}${markup.slice(factIndex + fact.length)}`;
}

function attribute(node, name) {
  return node?.attrs?.find((item) => item.name === name)?.value;
}

function classTokens(node) {
  return new Set(
    cleanText(attribute(node, "class")).split(" ").filter(Boolean),
  );
}

function calendarOrdinal(year, month, day) {
  const instant = new Date(Date.UTC(year, month - 1, day));
  assert.equal(instant.getUTCFullYear(), year);
  assert.equal(instant.getUTCMonth(), month - 1);
  assert.equal(instant.getUTCDate(), day);
  return Math.floor(instant.getTime() / 86_400_000);
}

function independentRange(box) {
  const dateNodes = descendants([box], "span").filter((node) =>
    classTokens(node).has("event-date"),
  );
  const timeNodes = descendants([box], "span").filter((node) =>
    classTokens(node).has("event-time"),
  );
  assert.equal(dateNodes.length, 1);
  assert.equal(timeNodes.length, 1);
  const dateMatch = cleanText(nodeText(dateNodes[0])).match(
    /^([A-Z][a-z]+)\s+(\d{1,2})\s*(?:-\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2}))?,\s*(\d{4})$/,
  );
  const timeMatch = cleanText(nodeText(timeNodes[0])).match(
    /^(\d{1,2}):(\d{2})(am|pm)\s*-\s*(\d{1,2}):(\d{2})(am|pm)$/i,
  );
  assert.ok(dateMatch);
  assert.ok(timeMatch);
  const year = Number(dateMatch[5]);
  const startMonth = monthNumber.get(dateMatch[1]);
  const endMonth = dateMatch[3] ? monthNumber.get(dateMatch[3]) : startMonth;
  assert.ok(startMonth);
  assert.ok(endMonth);
  const minute = (hour, minuteText, meridiem) => {
    const parsedMinute = Number(minuteText);
    let parsedHour = Number(hour);
    assert.ok(parsedHour >= 1 && parsedHour <= 12);
    assert.ok(parsedMinute >= 0 && parsedMinute <= 59);
    if (parsedHour === 12) parsedHour = 0;
    if (meridiem.toLowerCase() === "pm") parsedHour += 12;
    return parsedHour * 60 + parsedMinute;
  };
  return {
    endMinute:
      calendarOrdinal(year, endMonth, Number(dateMatch[4] ?? dateMatch[2])) *
        1440 +
      minute(timeMatch[4], timeMatch[5], timeMatch[6]),
    startOrdinal: calendarOrdinal(year, startMonth, Number(dateMatch[2])),
    year,
  };
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
    if (typeof input === "string")
      return new Selection(descendants([document], input));
    return new Selection(input ? [input] : []);
  };
}

function independentShape(markup, requiredYears = [2026]) {
  const document = parse(markup);
  const boxes = descendants([document], "div").filter((node) =>
    classTokens(node).has("box"),
  );
  const titleLinks = descendants([document], "a").filter((node) =>
    classTokens(node).has("event-tit"),
  );
  const indexByYear = new Map();
  for (const tab of descendants([document], "li").filter((node) =>
    classTokens(node).has("tab"),
  )) {
    const index = cleanText(attribute(tab, "id")).match(
      /^([1-9]\d*)-tab$/,
    )?.[1];
    const year = cleanText(nodeText(tab)).match(/^(20\d{2})$/)?.[1];
    if (index && year) indexByYear.set(Number(year), Number(index));
  }
  const containerByIndex = new Map();
  for (const container of descendants([document], "div").filter((node) =>
    classTokens(node).has("sort"),
  )) {
    const index = cleanText(attribute(container, "id")).match(
      /^tab([1-9]\d*)$/,
    )?.[1];
    if (index) containerByIndex.set(Number(index), container);
  }
  const targetYears = requiredYears.map((year) => {
    const container = containerByIndex.get(indexByYear.get(year));
    assert.ok(container);
    const yearBoxes = descendants([container], "div").filter((node) =>
      classTokens(node).has("box"),
    );
    const modern = yearBoxes.filter(
      (box) =>
        descendants([box], "a").filter((node) =>
          classTokens(node).has("event-tit"),
        ).length === 1,
    );
    return {
      boxes: yearBoxes.length,
      modern: modern.length,
      nodes: yearBoxes,
      year,
    };
  });
  const observedInstant = new Date(observedAt);
  const observedLocal = new Date(observedInstant.getTime() + 330 * 60_000);
  const observedOrdinal = calendarOrdinal(
    observedLocal.getUTCFullYear(),
    observedLocal.getUTCMonth() + 1,
    observedLocal.getUTCDate(),
  );
  const observedMinute =
    observedOrdinal * 1440 +
    observedLocal.getUTCHours() * 60 +
    observedLocal.getUTCMinutes();
  const horizonOrdinal = observedOrdinal + 90;
  const targetNodes = new Set(targetYears.flatMap(({ nodes }) => nodes));
  let relevant = 0;
  let relevantModern = 0;
  for (const { nodes, year } of targetYears) {
    for (const box of nodes) {
      const range = independentRange(box);
      assert.equal(range.year, year);
      if (
        range.startOrdinal <= horizonOrdinal &&
        range.endMinute > observedMinute
      ) {
        relevant += 1;
        const titleLinksForBox = descendants([box], "a").filter((node) =>
          classTokens(node).has("event-tit"),
        );
        assert.equal(titleLinksForBox.length, 1);
        relevantModern += 1;
      }
    }
  }
  for (const box of boxes) {
    if (targetNodes.has(box)) continue;
    const dateNodes = descendants([box], "span").filter((node) =>
      classTokens(node).has("event-date"),
    );
    if (dateNodes.length !== 1) continue;
    const year = cleanText(nodeText(dateNodes[0])).match(/\b(20\d{2})$/)?.[1];
    if (!year || !requiredYears.includes(Number(year))) continue;
    const range = independentRange(box);
    assert.equal(
      range.startOrdinal <= horizonOrdinal && range.endMinute > observedMinute,
      false,
      "an in-horizon public-DOM card escaped the required-year container",
    );
  }
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
  return {
    boxes,
    pagination,
    pagingContainers,
    targetYears,
    titleLinks,
    relevant,
    relevantModern,
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

test("BIEC exposes one complete modern official calendar surface", async (t) => {
  const live = await liveSource();
  assert.ok(live.bytes.length >= 10_000 && live.bytes.length <= 1_500_000);
  const shape = independentShape(live.markup);
  assert.ok(shape.boxes.length >= 2 && shape.boxes.length <= 1000);
  assert.deepEqual(
    shape.targetYears.map(({ year }) => year),
    [2026],
  );
  for (const target of shape.targetYears) {
    assert.ok(target.boxes >= 1 && target.boxes <= 150);
  }
  assert.equal(shape.relevant, 9);
  assert.equal(shape.relevantModern, 9);
  assert.equal(shape.pagination.length, 0);
  assert.equal(shape.pagingContainers.length, 0);
  t.diagnostic(
    `requests/pages: 1/1; bytes: ${live.bytes.length}; SHA-256: ${live.hash}; intersecting-horizon containers: ${shape.targetYears.map((value) => `${value.year}=${value.boxes} boxes (${value.modern} modern diagnostic)`).join(", ")}; relevant coverage=${shape.relevantModern}/${shape.relevant}; public-DOM archive diagnostic: ${shape.boxes.length} boxes/${shape.titleLinks.length} modern links`,
  );
});

test("BIEC Code worker emits the exact nine-row current horizon", async (t) => {
  const live = await liveSource();
  const result = await executeWorker(live.markup);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [sourceURL]);
  assert.equal(result.parses.length, 1);
  assert.deepEqual(
    result.records.map((record) => ({
      title: record.title,
      start: record.starts_at,
      end: record.ends_at,
      detail: record.source_url,
      image: record.image_url,
    })),
    expectedRows,
  );
  await validateAuthoritativeSchema(result.records);

  const identities = new Set();
  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, null);
    assert.equal(record.source_host, "www.biec.in");
    assert.equal(record.city_slug, "bengaluru");
    assert.equal(record.category, "other");
    assert.equal(record.time_precision, "timed");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(
      record.venue_name,
      "Bangalore International Exhibition Centre",
    );
    assert.equal(record.venue_address, null);
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
    assert.equal(record.observed_at, observedAt);
    const identity = [
      record.title.toLowerCase(),
      record.source_url,
      record.starts_at,
      record.venue_name.toLowerCase(),
    ].join("\u001f");
    assert.equal(identities.has(identity), false);
    identities.add(identity);
  }
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(`canonical rows: 9; SHA-256: ${recordHash}`);
});

test("BIEC interaction code has one request and no crawler path", async () => {
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

test("BIEC required-year and relevant-field drift fail atomically", async () => {
  const live = await liveSource();
  const eligibleLocationDrift = replaceFactAfter(
    live.markup,
    "Calendar_event/2k26/franchise-india.php",
    "Bengaluru, Karnataka",
    "Changed location",
  );
  const duplicate = live.markup
    .replace(">LWOP</a>", ">Electronica- Productronica</a>")
    .replaceAll(
      "Calendar_event/2k26/lwop.php",
      "Calendar_event/2k26/electronica-productronica.php",
    );
  const mutations = [
    [
      live.markup.replace(
        ":: BIEC - Premier International Exhibition Centre ::",
        "Changed calendar",
      ),
      /page identity drifted/,
    ],
    [
      live.markup.replace(
        "images/events/franchise-india.webp",
        "https://example.com/franchise-india.webp",
      ),
      /image URL left the reviewed boundary/,
    ],
    [eligibleLocationDrift, /location drifted/],
    [
      live.markup.replace("Aug 22 - 23, 2026", "Feb 31 - 32, 2026"),
      /start date is impossible/,
    ],
    [
      live.markup.replace(
        /(href="Calendar_event\/2k26\/franchise-india\.php"\s+class="button )event-tit(">)/,
        "$1event-title$2",
      ),
      /eligible box left the modern card contract/,
    ],
    [
      live.markup.replace(
        /(href=")Calendar_event\/2k26\/franchise-india\.php("\s+class="button event-tit")/,
        "$1https://example.com/franchise$2",
      ),
      /current detail links drifted or disagree/,
    ],
    [duplicate, /repeated an eligible detail URL|fallback identity/],
    [
      live.markup.replace("September 5 - 7, 2025", "September 5 - 7, 2026"),
      /in-horizon card escaped its required year container/,
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

  const historicalOnly = live.markup.replace(
    "images/events/sap-teched.webp",
    "https://example.com/irrelevant-history.webp",
  );
  assert.notEqual(historicalOnly, live.markup);
  const historicalResult = await executeWorker(historicalOnly);
  assert.ifError(historicalResult.error);
  assert.equal(historicalResult.records.length, 9);

  const endedCurrentYear = live.markup.replace(
    "images/events/Leviss.webp",
    "https://example.com/ended-current-year.webp",
  );
  assert.notEqual(endedCurrentYear, live.markup);
  const endedCurrentResult = await executeWorker(endedCurrentYear);
  assert.ifError(endedCurrentResult.error);
  assert.equal(endedCurrentResult.records.length, 9);

  const commentedOnly = live.markup.replace(
    "</body>",
    '<!-- <div class="box"><span class="event-date"><p>1 Sep, 2026</p></span></div> --></body>',
  );
  assert.notEqual(commentedOnly, live.markup);
  const commentedResult = await executeWorker(commentedOnly);
  assert.ifError(commentedResult.error);
  assert.equal(commentedResult.records.length, 9);
});

test("BIEC input, save-probe, response, and local-minute gates are exact", async () => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.markup, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, [sourceURL]);
  assert.equal(saveProbe.records.length, 9);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?page=1`,
    "https://www.biec.in:443/events",
    "https://biec.in/events",
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

  const duringFirstEvent = await executeWorker(live.markup, {
    creationTime: "2026-08-22T04:00:00.000Z",
  });
  assert.ifError(duringFirstEvent.error);
  assert.equal(duringFirstEvent.records.length, 9);
  assert.equal(
    duringFirstEvent.records.some(
      (record) => record.title === "Franchise India",
    ),
    true,
  );

  const afterFirstEvent = await executeWorker(live.markup, {
    creationTime: "2026-08-23T13:00:00.000Z",
  });
  assert.ifError(afterFirstEvent.error);
  assert.equal(afterFirstEvent.records.length, 8);
  assert.equal(
    afterFirstEvent.records.some(
      (record) => record.title === "Franchise India",
    ),
    false,
  );

  for (const creationTime of ["invalid", 42, {}]) {
    const result = await executeWorker(live.markup, { creationTime });
    assert.match(String(result.error), /job creation time/);
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }

  for (const creationTime of [undefined, null, "", new Date(observedAt)]) {
    const clockSaveProbe = await executeWorker(live.markup, { creationTime });
    assert.ifError(clockSaveProbe.error);
    assert.deepEqual(clockSaveProbe.requests, [sourceURL]);
    assert.equal(clockSaveProbe.records.length, 9);
    assert.equal(
      clockSaveProbe.records.every(
        (record) => record.observed_at === observedAt,
      ),
      true,
    );
  }
});

test("BIEC uses the authoritative 27-field Studio schema", async () => {
  const [contract, outputSchema] = await Promise.all([
    readFile(contractURL, "utf8").then(JSON.parse),
    readFile(outputSchemaURL, "utf8").then(JSON.parse),
  ]);
  assert.equal(contract.additionalProperties, false);
  assert.deepEqual([...contract.required].sort(), expectedKeys);
  assert.deepEqual(Object.keys(outputSchema.fields).sort(), expectedKeys);
  for (const field of Object.values(outputSchema.fields)) {
    assert.equal(field.active, true);
    assert.equal(field.default_value, "null");
  }
});
