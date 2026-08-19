import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { parse } from "parse5";
import { chromium } from "playwright";

const sourceURL = "https://upisaconvaranasi2026.com/workshops";
const registrationURL =
  "https://registration.upisaconvaranasi2026.com/user/login";
const observedAt = "2026-08-19T00:00:00.000Z";
const expectedTitles = [
  "POCUS",
  "Regional Anesthesia",
  "Mechanical Ventilation",
  "Airway Management",
  "ECMO",
  "Advance Trauma Nursing Course",
  "Basic Trauma Nursing Course",
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
const workerURL = new URL(
  "../../sources/varanasi/upisacon/collector/worker.js",
  import.meta.url,
);
const parserURL = new URL(
  "../../sources/varanasi/upisacon/collector/parser.js",
  import.meta.url,
);
const schemaURL = new URL(
  "../../contracts/collector-output.schema.json",
  import.meta.url,
);
const outputSchemaURL = new URL(
  "../../sources/varanasi/upisacon/collector/output-schema.json",
  import.meta.url,
);
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function classes(node) {
  return (
    node.attrs
      ?.find((attribute) => attribute.name === "class")
      ?.value.split(/\s+/)
      .filter(Boolean) ?? []
  );
}

function matches(node, selector) {
  if (!node.tagName) return false;
  if (selector.startsWith(".")) {
    return classes(node).includes(selector.slice(1));
  }
  return node.tagName === selector.toLowerCase();
}

function descendants(nodes, selector) {
  const found = [];
  for (const node of nodes) {
    for (const child of node.childNodes ?? []) {
      if (matches(child, selector)) found.push(child);
      found.push(...descendants([child], selector));
    }
  }
  return found;
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
    return this.nodes[0]?.attrs?.find((item) => item.name === name)?.value;
  }

  children(selector) {
    const nodes = this.nodes
      .flatMap((node) => node.childNodes ?? [])
      .filter((node) => node.tagName);
    return new Selection(
      selector ? nodes.filter((node) => matches(node, selector)) : nodes,
    );
  }

  parent() {
    return new Selection([
      ...new Set(this.nodes.map((node) => node.parentNode).filter(Boolean)),
    ]);
  }

  text() {
    return this.nodes.map(nodeText).join("");
  }

  toArray() {
    return [...this.nodes];
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

let codePromise;
function sourceCode() {
  if (!codePromise) {
    codePromise = Promise.all([
      readFile(workerURL, "utf8"),
      readFile(parserURL, "utf8"),
    ]).then(([worker, parserCode]) => ({ worker, parserCode }));
  }
  return codePromise;
}

async function executeParser(markup) {
  const { parserCode } = await sourceCode();
  return vm.runInNewContext(`(function () {${parserCode}\n})()`, {
    $: loadHtml(markup),
  });
}

async function executeWorker(
  markup,
  {
    inputURL = sourceURL,
    creationTime = observedAt,
    finalURL = sourceURL,
    status = 200,
    parsedOverride,
  } = {},
) {
  const { worker } = await sourceCode();
  const records = [];
  const navigations = [];
  let parserResult;
  let parserError;
  try {
    parserResult =
      parsedOverride === undefined
        ? await executeParser(markup)
        : structuredClone(parsedOverride);
  } catch (error) {
    parserError = error;
  }
  class SandboxDate extends Date {}
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  Object.defineProperty(SandboxDate, "UTC", { value: undefined });
  const context = {
    input: { url: inputURL },
    job: { created: creationTime },
    navigate(url, options) {
      navigations.push({ url, options: structuredClone(options) });
    },
    status_code() {
      return status;
    },
    location: { href: finalURL },
    parse() {
      if (parserError) throw parserError;
      return structuredClone(parserResult);
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
    structuredClone,
  };
  try {
    await vm.runInNewContext(`(async () => {${worker}\n})()`, context, {
      filename: workerURL.pathname,
    });
    return { error: null, navigations, records };
  } catch (error) {
    return { error, navigations, records };
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

function browserExecutable() {
  if (process.env.BAAHAR_BROWSER_EXECUTABLE) {
    return process.env.BAAHAR_BROWSER_EXECUTABLE;
  }
  if (process.platform === "win32") {
    return "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  }
  return chromium.executablePath();
}

let livePromise;
function liveSource() {
  if (!livePromise) {
    livePromise = (async () => {
      const response = await fetch(sourceURL, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(20_000),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html/i);
      const rawBytes = Buffer.from(await response.arrayBuffer());
      const rawMarkup = rawBytes.toString("utf8");

      const executablePath = browserExecutable();
      await access(executablePath);
      const browser = await chromium.launch({ headless: true, executablePath });
      try {
        const page = await browser.newPage();
        let documentNavigations = 0;
        let totalRequests = 0;
        page.on("request", (request) => {
          totalRequests += 1;
          if (
            request.isNavigationRequest() &&
            request.resourceType() === "document"
          ) {
            documentNavigations += 1;
          }
        });
        const browserResponse = await page.goto(sourceURL, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        assert.equal(browserResponse?.status(), 200);
        const renderedMarkup = await page.content();
        return {
          rawBytes,
          rawMarkup,
          rawHash: createHash("sha256").update(rawBytes).digest("hex"),
          renderedMarkup,
          finalURL: page.url(),
          documentNavigations,
          totalRequests,
        };
      } finally {
        await browser.close();
      }
    })();
  }
  return livePromise;
}

test("UPISACON raw HTTP is an ineligible React shell", async (t) => {
  const live = await liveSource();
  assert.ok(live.rawBytes.length >= 500 && live.rawBytes.length <= 10_000);
  assert.match(live.rawMarkup, /<div id="root"><\/div>/);
  assert.equal(
    (live.rawMarkup.match(/<script\b[^>]*type="module"/g) ?? []).length,
    1,
  );
  for (const marker of [
    "Pre-Conference Workshops",
    "2nd October, 2026",
    ...expectedTitles,
  ]) {
    assert.equal(live.rawMarkup.includes(marker), false, marker);
  }
  await assert.rejects(executeParser(live.rawMarkup), /workshop heading/);
  t.diagnostic(
    `raw bytes: ${live.rawBytes.length}; raw SHA-256: ${live.rawHash}; fact markers: 0`,
  );
});

test("UPISACON Browser worker emits seven exact canonical rows", async (t) => {
  const live = await liveSource();
  assert.equal(live.finalURL, sourceURL);
  assert.equal(live.documentNavigations, 1);
  assert.ok(live.totalRequests <= 12);

  const parsedPage = await executeParser(live.renderedMarkup);
  assert.deepEqual(
    parsedPage.cards.map((card) => card.title),
    expectedTitles,
  );
  const result = await executeWorker(live.renderedMarkup);
  assert.ifError(result.error);
  assert.deepEqual(result.navigations, [
    {
      url: sourceURL,
      options: { wait_until: "networkidle0", timeout: 30000 },
    },
  ]);
  assert.equal(result.records.length, 7);
  await validateAuthoritativeSchema(result.records);

  const identities = new Set();
  for (const [index, record] of result.records.entries()) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.title, expectedTitles[index]);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, null);
    assert.equal(record.source_url, sourceURL);
    assert.equal(record.source_host, "upisaconvaranasi2026.com");
    assert.equal(record.city_slug, "varanasi");
    assert.equal(record.category, "other");
    assert.equal(record.start_date, "2026-10-02");
    assert.equal(record.starts_at, null);
    assert.equal(record.end_date, "2026-10-02");
    assert.equal(record.ends_at, null);
    assert.equal(record.time_precision, "date");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(
      record.venue_name,
      "Skill Center, Trauma Center, IMS BHU, Varanasi",
    );
    assert.equal(record.venue_address, null);
    assert.equal(record.is_free, null);
    assert.equal(record.price_min_minor, null);
    assert.equal(record.price_max_minor, null);
    assert.equal(record.currency, null);
    assert.equal(record.registration_url, registrationURL);
    assert.equal(record.registration_state, null);
    assert.equal(record.status, "scheduled");
    assert.deepEqual(record.language, []);
    assert.equal(record.age_note, null);
    assert.equal(record.accessibility_note, null);
    assert.equal(record.image_url, null);
    assert.equal(record.observed_at, observedAt);
    identities.add(
      [
        record.title.toLowerCase(),
        sourceURL,
        record.start_date,
        record.venue_name.toLowerCase(),
      ].join("\u001f"),
    );
  }
  assert.equal(identities.size, 7);
  const semanticHash = createHash("sha256")
    .update(JSON.stringify(parsedPage))
    .digest("hex");
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(
    `document navigations: ${live.documentNavigations}; browser actions: 0; fan-out: 0; physical requests: ${live.totalRequests}; rows: 7; semantic SHA-256: ${semanticHash}; record SHA-256: ${recordHash}`,
  );
});

test("UPISACON interaction code has one navigation and no alternate path", async () => {
  const { worker } = await sourceCode();
  assert.equal((worker.match(/\bnavigate\s*\(/g) ?? []).length, 1);
  for (const forbidden of [
    /\brequest\s*\(/,
    /\bwait(?:_\w+)?\s*\(/,
    /\bclick\s*\(/,
    /\btype\s*\(/,
    /\bscroll_\w+\s*\(/,
    /\bload_more\s*\(/,
    /\bnext_stage\s*\(/,
    /\brerun_stage\s*\(/,
    /\btag_\w+\s*\(/,
  ]) {
    assert.doesNotMatch(worker, forbidden);
  }
  assert.match(worker, /wait_until:\s*"networkidle0"/);
  assert.match(worker, /timeout:\s*30000/);
});

test("UPISACON DOM and semantic drift fail before collection", async () => {
  const live = await liveSource();
  const mutations = [
    ["WORKSHOP A", "WORKSHOP Z", /workshop order or title/],
    [">Regional Anesthesia<", ">POCUS<", /workshop order or title/],
    ["2nd October, 2026", "3rd October, 2026", /date, or venue/],
    ["IMS BHU, Varanasi", "IMS BHU, Delhi", /date, or venue/],
    [
      "One delegate may register for only one workshop",
      "Two workshops allowed",
      /registration rules/,
    ],
    [registrationURL, `${sourceURL}/register`, /registration link boundary/],
  ];
  for (const [search, replacement, expectedError] of mutations) {
    assert.ok(
      live.renderedMarkup.includes(search),
      `missing mutation: ${search}`,
    );
    const result = await executeWorker(
      live.renderedMarkup.replaceAll(search, replacement),
    );
    assert.match(String(result.error), expectedError);
    assert.equal(result.navigations.length, 1);
    assert.deepEqual(result.records, []);
  }

  const parsedPage = await executeParser(live.renderedMarkup);
  const extraCard = structuredClone(parsedPage);
  extraCard.cards.push({ label: "WORKSHOP H", title: "Extra" });
  const extra = await executeWorker(live.renderedMarkup, {
    parsedOverride: extraCard,
  });
  assert.match(String(extra.error), /card count/);
  assert.deepEqual(extra.records, []);

  const reordered = structuredClone(parsedPage);
  [reordered.cards[0], reordered.cards[1]] = [
    reordered.cards[1],
    reordered.cards[0],
  ];
  const wrongOrder = await executeWorker(live.renderedMarkup, {
    parsedOverride: reordered,
  });
  assert.match(String(wrongOrder.error), /workshop order or title/);
  assert.deepEqual(wrongOrder.records, []);
});

test("UPISACON input, navigation, and horizon boundaries fail closed", async () => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.renderedMarkup, {
    inputURL: undefined,
  });
  assert.ifError(saveProbe.error);
  assert.equal(saveProbe.records.length, 7);
  assert.equal(saveProbe.navigations[0].url, sourceURL);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?page=1`,
    "https://upisaconvaranasi2026.com:443/workshops",
    "https://www.upisaconvaranasi2026.com/workshops",
  ]) {
    const result = await executeWorker(live.renderedMarkup, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed workshop URL/,
    );
    assert.deepEqual(result.navigations, []);
    assert.deepEqual(result.records, []);
  }

  for (const options of [
    { status: 503 },
    { finalURL: `${sourceURL}/` },
    { creationTime: "2026-06-01T00:00:00.000Z" },
    { creationTime: "2026-10-03T00:00:00.000Z" },
    { creationTime: "invalid" },
  ]) {
    const result = await executeWorker(live.renderedMarkup, options);
    assert.ok(result.error);
    assert.deepEqual(result.records, []);
  }
});

test("UPISACON vendor schema stays aligned with the authoritative contract", async () => {
  const [schema, outputSchema] = await Promise.all([
    readFile(schemaURL, "utf8").then(JSON.parse),
    readFile(outputSchemaURL, "utf8").then(JSON.parse),
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), expectedKeys);
  assert.deepEqual(Object.keys(outputSchema.fields).sort(), expectedKeys);
  for (const field of Object.values(outputSchema.fields)) {
    assert.equal(field.active, true);
    assert.equal(field.default_value, "null");
  }
});
