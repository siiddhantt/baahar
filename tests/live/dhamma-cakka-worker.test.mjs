import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { parse } from "parse5";

const sourceURL = "https://schedule.vridhamma.org/courses/cakka";
const observedAt = "2026-08-19T00:00:00.000Z";
const workerURL = new URL(
  "../../sources/varanasi/dhamma-cakka/collector/worker.js",
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
  [
    "3 Day Course",
    "2026-08-28",
    "2026-08-31",
    "https://schedule.vridhamma.org/form/application-form?centre=31&course=67242",
  ],
  [
    "10 Day Course",
    "2026-09-03",
    "2026-09-14",
    "https://schedule.vridhamma.org/form/application-form?centre=31&course=67243",
  ],
  [
    "10 Day Course",
    "2026-09-18",
    "2026-09-29",
    "https://schedule.vridhamma.org/form/application-form?centre=31&course=67244",
  ],
  [
    "10 Day Special Course",
    "2026-10-03",
    "2026-10-14",
    "https://schedule.vridhamma.org/form/long-course-application-form?centre=31&course=65601",
  ],
  [
    "10 Day Course",
    "2026-10-18",
    "2026-10-29",
    "https://schedule.vridhamma.org/form/application-form?centre=31&course=67245",
  ],
  [
    "STP Course",
    "2026-10-30",
    "2026-11-07",
    "https://schedule.vridhamma.org/form/stp-application-form?centre=31&course=67246",
  ],
  [
    "30 Day Course",
    "2026-11-11",
    "2026-12-12",
    "https://schedule.vridhamma.org/form/long-course-application-form?centre=31&course=64329",
  ],
];

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
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? []).map(nodeText).join("");
}

class Selection {
  constructor(nodes) {
    this.nodes = nodes;
  }

  get length() {
    return this.nodes.length;
  }

  attr(name) {
    const attribute = this.nodes[0]?.attrs?.find((item) => item.name === name);
    return attribute?.value;
  }

  children(selector) {
    return new Selection(
      this.nodes.flatMap((node) =>
        (node.childNodes ?? []).filter((child) => child.tagName === selector),
      ),
    );
  }

  each(callback) {
    this.nodes.forEach((node, index) => callback(index, node));
    return this;
  }

  find(selector) {
    return new Selection(descendants(this.nodes, selector));
  }

  first() {
    return new Selection(this.nodes.slice(0, 1));
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

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function classTokens(node) {
  const classes =
    node.attrs?.find((attribute) => attribute.name === "class")?.value ?? "";
  return new Set(cleanText(classes).split(" "));
}

function independentPageShape(markup) {
  const document = parse(markup);
  const tables = descendants([document], "table");
  const centreTables = tables.filter((table) =>
    classTokens(table).has("centre-info"),
  );
  const schedules = [];
  for (const table of tables) {
    const caption = descendants([table], "caption")[0];
    const match = cleanText(caption ? nodeText(caption) : "").match(
      /^Course Year (\d{4})$/,
    );
    if (!match) continue;
    schedules.push({
      year: Number(match[1]),
      rows: descendants([table], "tbody").flatMap((body) =>
        descendants([body], "tr"),
      ).length,
      headers: descendants([table], "thead").flatMap((head) =>
        descendants([head], "th").map((cell) => cleanText(nodeText(cell))),
      ),
    });
  }
  const nextLinks = descendants([document], "a").filter((link) =>
    cleanText(link.attrs?.find((attribute) => attribute.name === "rel")?.value)
      .toLowerCase()
      .split(" ")
      .includes("next"),
  );
  const pagers = ["nav", "ul", "div"].flatMap((tag) =>
    descendants([document], tag).filter((node) => {
      const tokens = classTokens(node);
      return tokens.has("pager") || tokens.has("pagination");
    }),
  );
  return { centreTables, nextLinks, pagers, schedules, tables };
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
  class SandboxDate extends Date {}
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
    Set,
    Number,
    String,
    Object,
    Array,
    Math,
    RegExp,
    structuredClone,
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

test("Dhamma Cakka exposes one complete static centre schedule", async (t) => {
  const live = await liveSource();
  assert.ok(live.bytes.length >= 20_000 && live.bytes.length <= 200_000);
  const shape = independentPageShape(live.markup);
  assert.equal(shape.tables.length, 3);
  assert.equal(shape.centreTables.length, 1);
  assert.deepEqual(shape.schedules, [
    {
      year: 2026,
      rows: 10,
      headers: ["Apply", "Dates", "Course Type", "Status", "Comments"],
    },
    {
      year: 2027,
      rows: 18,
      headers: ["Apply", "Dates", "Course Type", "Status", "Comments"],
    },
  ]);
  assert.equal(shape.nextLinks.length, 0);
  assert.equal(shape.pagers.length, 0);
  t.diagnostic(
    `requests/pages: 1/1; bytes: ${live.bytes.length}; SHA-256: ${live.hash}; schedule rows: 10+18`,
  );
});

test("Dhamma Cakka Code worker emits the exact seven-row horizon", async (t) => {
  const live = await liveSource();
  const result = await executeWorker(live.markup);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [sourceURL]);
  assert.equal(result.parses.length, 1);
  assert.deepEqual(
    result.records.map((record) => [
      record.title,
      record.start_date,
      record.end_date,
      record.registration_url,
    ]),
    expectedRows,
  );
  await validateAuthoritativeSchema(result.records);

  const identities = new Set();
  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, null);
    assert.equal(record.source_url, sourceURL);
    assert.equal(record.source_host, "schedule.vridhamma.org");
    assert.equal(record.city_slug, "varanasi");
    assert.equal(record.category, "community");
    assert.equal(record.starts_at, null);
    assert.equal(record.ends_at, null);
    assert.equal(record.time_precision, "date");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.venue_name, "Dhamma Chakka");
    assert.equal(record.venue_address, "Kharagipur, Uttar Pradesh - 221104");
    assert.equal(record.is_free, null);
    assert.equal(record.price_min_minor, null);
    assert.equal(record.price_max_minor, null);
    assert.equal(record.currency, null);
    assert.equal(record.registration_state, null);
    assert.equal(record.status, "scheduled");
    assert.deepEqual(record.language, []);
    assert.equal(record.age_note, null);
    assert.equal(record.accessibility_note, null);
    assert.equal(record.image_url, null);
    assert.equal(record.observed_at, observedAt);
    const identity = [
      record.title.toLowerCase(),
      record.source_url,
      record.start_date,
      record.venue_name.toLowerCase(),
    ].join("\u001f");
    assert.equal(identities.has(identity), false);
    identities.add(identity);
  }
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(`canonical rows: 7; SHA-256: ${recordHash}`);
});

test("Dhamma Cakka interaction code has one request and no crawler path", async () => {
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

test("Dhamma Cakka structural and identity drift fails atomically", async () => {
  const live = await liveSource();
  const mutations = [
    [
      live.markup.replace(
        /<h2 class="field-content">Dhamma Chakka<\/h2>/,
        '<h2 class="field-content">Changed Centre</h2>',
      ),
      /centre facts drifted/,
    ],
    [live.markup.replace(">Dates</th>", ">When</th>"), /headers drifted/],
    [
      live.markup.replace("28 Aug - 31 Aug", "31 Feb - 31 Feb"),
      /start date is impossible/,
    ],
    [
      live.markup.replace("course=67243", "course=67242"),
      /repeated an application course ID/,
    ],
    [
      live.markup.replace("18 Sep - 29 Sep", "3 Sep - 14 Sep"),
      /fallback occurrence identity/,
    ],
    [
      live.markup.replace(
        /<td([^>]*)>10 Day Special Course\s*<\/td>/,
        "<th$1>10 Day Special Course</th>",
      ),
      /exactly five cells/,
    ],
    [
      live.markup.replace(
        "</body>",
        '<a rel="next" href="?page=2">Next</a></body>',
      ),
      /requires pagination/,
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

test("Dhamma Cakka input, save-probe, response, and horizon gates are exact", async () => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.markup, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, [sourceURL]);
  assert.equal(saveProbe.records.length, 7);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?page=1`,
    "https://schedule.vridhamma.org:443/courses/cakka",
    "https://www.vridhamma.org/courses/cakka",
  ]) {
    const result = await executeWorker(live.markup, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed course URL/,
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

  for (const creationTime of ["invalid", "2027-09-01T00:00:00.000Z"]) {
    const result = await executeWorker(live.markup, { creationTime });
    assert.ok(result.error);
    assert.deepEqual(result.records, []);
  }
});

test("Dhamma Cakka uses the authoritative 27-field Studio schema", async () => {
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
