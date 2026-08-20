import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const sourceURL = "https://attagalatta.com/events.php";
const observedAt = "2026-08-20T00:00:00.000Z";
const expectedIDs = [
  "EVT2080",
  "EVT2059",
  "EVT2083",
  "EVT2042",
  "EVT2071",
  "EVT2046",
  "EVT2057",
  "EVT2070",
  "EVT2069",
  "EVT2087",
  "EVT2062",
  "EVT2004",
  "EVT2089",
  "EVT2074",
  "EVT1999",
  "EVT2088",
  "EVT2048",
  "EVT2085",
  "EVT2047",
  "EVT2064",
  "EVT2096",
  "EVT2094",
  "EVT2095",
  "EVT2065",
  "EVT2045",
  "EVT2081",
  "EVT2090",
  "EVT2035",
  "EVT2082",
  "EVT2060",
  "EVT2066",
  "EVT2061",
  "EVT2068",
  "EVT2073",
  "EVT2092",
  "EVT2079",
  "EVT2084",
  "EVT2020",
  "EVT2091",
  "EVT2078",
  "EVT2093",
  "EVT2086",
];
const sourceKeys = [
  "Sno",
  "day",
  "description",
  "eventday",
  "eventid",
  "eventstarttime",
  "host",
  "image",
  "link",
  "month",
  "monthname",
  "resp",
  "subtitle",
  "title",
  "year",
].sort();
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
  "../../sources/bengaluru/atta-galatta/collector/worker.js",
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

let workerPromise;
function workerCode() {
  workerPromise ??= readFile(workerURL, "utf8");
  return workerPromise;
}

async function executeWorker(responseBody, options = {}) {
  const inputURL = Object.hasOwn(options, "inputURL")
    ? options.inputURL
    : sourceURL;
  const creationTime = Object.hasOwn(options, "creationTime")
    ? options.creationTime
    : observedAt;
  const worker = await workerCode();
  const records = [];
  const requests = [];
  class SandboxDate extends Date {}
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  Object.defineProperty(SandboxDate, "UTC", { value: undefined });
  const context = {
    input: { url: inputURL },
    job: { created: creationTime },
    request(url) {
      assert.equal(arguments.length, 1);
      requests.push(url);
      return responseBody;
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
    JSON,
    structuredClone,
  };
  try {
    vm.runInNewContext(worker, context, { filename: workerURL.pathname });
    return { error: null, records, requests };
  } catch (error) {
    return { error, records, requests };
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
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/json/i,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString("utf8");
    return {
      bytes,
      hash: createHash("sha256").update(bytes).digest("hex"),
      payload: JSON.parse(text),
      text,
    };
  })();
  return livePromise;
}

function independentlyEligibleRows(payload) {
  const horizonEnd = "2026-11-18";
  return payload.value.filter((row) => {
    const start = `${row.year}-${String(Number(row.month)).padStart(2, "0")}-${String(Number(row.day)).padStart(2, "0")}`;
    return start >= "2026-08-20" && start <= horizonEnd;
  });
}

test("Atta Galatta exposes one complete official JSON archive", async (t) => {
  const live = await liveSource();
  assert.ok(live.bytes.length >= 500_000 && live.bytes.length <= 3_000_000);
  assert.deepEqual(Object.keys(live.payload).sort(), ["resp", "value"]);
  assert.equal(live.payload.resp, true);
  assert.ok(
    live.payload.value.length >= 1_000 && live.payload.value.length <= 5_000,
  );
  for (const [index, row] of live.payload.value.entries()) {
    assert.deepEqual(Object.keys(row).sort(), sourceKeys);
    assert.equal(row.resp, true);
    assert.equal(row.Sno, index);
  }

  const counts = new Map();
  for (const row of live.payload.value) {
    counts.set(row.eventid, (counts.get(row.eventid) ?? 0) + 1);
  }
  const duplicateArchiveIDs = [...counts.values()].filter((count) => count > 1);
  const eligible = independentlyEligibleRows(live.payload);
  assert.equal(eligible.length, 42);
  assert.deepEqual(
    eligible.map((row) => row.eventid),
    expectedIDs,
  );
  assert.equal(
    new Set(eligible.map((row) => row.eventid)).size,
    eligible.length,
  );
  assert.equal(duplicateArchiveIDs.length, 50);
  assert.equal(
    live.payload.value.filter((row) => row.year === "0026").length,
    1,
  );
  assert.equal("page" in live.payload, false);
  assert.equal("cursor" in live.payload, false);
  assert.equal("total_pages" in live.payload, false);
  t.diagnostic(
    `requests/pages: 1/1; bytes: ${live.bytes.length}; SHA-256: ${live.hash}; archive/current/duplicate IDs: ${live.payload.value.length}/42/50`,
  );
});

test("Atta Galatta Code worker emits the exact 42-event horizon", async (t) => {
  const live = await liveSource();
  const result = await executeWorker(live.text);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [sourceURL]);
  assert.deepEqual(
    result.records.map((record) => record.source_event_id),
    expectedIDs,
  );
  assert.equal(result.records.length, 42);
  await validateAuthoritativeSchema(result.records);

  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_host, "attagalatta.com");
    assert.equal(record.city_slug, "bengaluru");
    assert.equal(record.category, "other");
    assert.equal(record.end_date, null);
    assert.equal(record.ends_at, null);
    assert.equal(record.time_precision, "timed");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.venue_name, null);
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
    assert.match(
      record.source_url,
      /^https:\/\/attagalatta\.com\/event_page\.php\?eventid=EVT[0-9]+$/,
    );
    assert.match(
      record.image_url,
      /^https:\/\/attagalatta\.com\/admin\/uploads\/events\/[0-9]+\.(?:jpe?g|png)$/i,
    );
    assert.equal(record.observed_at, observedAt);
  }
  assert.deepEqual(
    [
      result.records[0].source_event_id,
      result.records[0].start_date,
      result.records[0].starts_at,
      result.records[0].title,
    ],
    [
      "EVT2080",
      "2026-08-21",
      "2026-08-21T17:00:00+05:30",
      "Shaping Masculinity: The Silent Crisis of the Indian Man",
    ],
  );
  assert.deepEqual(
    [
      result.records.at(-1).source_event_id,
      result.records.at(-1).start_date,
      result.records.at(-1).starts_at,
      result.records.at(-1).title,
    ],
    [
      "EVT2086",
      "2026-10-04",
      "2026-10-04T16:00:00+05:30",
      "We Matched, Unfortunately",
    ],
  );
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(`canonical rows: 42; SHA-256: ${recordHash}`);
});

test("Atta Galatta interaction code has one request and no crawler path", async () => {
  const worker = await workerCode();
  assert.equal((worker.match(/\brequest\s*\(/g) ?? []).length, 1);
  for (const forbidden of [
    /\bcountry\s*\(/,
    /\bnavigate\s*\(/,
    /\btag_response\s*\(/,
    /\bload_html\s*\(/,
    /\bclick\s*\(/,
    /\bscroll_\w+\s*\(/,
    /\bnext_stage\s*\(/,
    /\brerun_stage\s*\(/,
  ]) {
    assert.doesNotMatch(worker, forbidden);
  }
});

test("Atta Galatta source, date, host, and identity drift fail atomically", async () => {
  const live = await liveSource();
  const mutations = [];

  const responseFailure = structuredClone(live.payload);
  responseFailure.resp = false;
  mutations.push([responseFailure, /not successful event data/]);

  const extraKey = structuredClone(live.payload);
  extraKey.value[0].unexpected = true;
  mutations.push([extraKey, /source row shape drifted/]);

  const missingSequence = structuredClone(live.payload);
  missingSequence.value[0].Sno = 1;
  mutations.push([
    missingSequence,
    /source sequence is incomplete or reordered/,
  ]);

  const duplicateCurrentID = structuredClone(live.payload);
  const repeated = duplicateCurrentID.value.find(
    (row) => row.eventid === "EVT2059",
  );
  repeated.eventid = "EVT2080";
  repeated.link = "https://attagalatta.com/event_page.php?eventid=EVT2080";
  mutations.push([duplicateCurrentID, /repeated an eligible native event ID/]);

  const dateMismatch = structuredClone(live.payload);
  dateMismatch.value.find((row) => row.eventid === "EVT2080").eventday =
    "22 Aug 2026";
  mutations.push([dateMismatch, /redundant date fields disagree/]);

  const invalidTime = structuredClone(live.payload);
  invalidTime.value.find((row) => row.eventid === "EVT2080").eventstarttime =
    "17:00";
  mutations.push([invalidTime, /start time format drifted/]);

  const offHostDetail = structuredClone(live.payload);
  offHostDetail.value.find((row) => row.eventid === "EVT2080").link =
    "https://example.com/event_page.php?eventid=EVT2080";
  mutations.push([offHostDetail, /detail URL left the reviewed boundary/]);

  const offHostImage = structuredClone(live.payload);
  offHostImage.value.find((row) => row.eventid === "EVT2080").image =
    "https://example.com/admin/uploads/events/1.jpg";
  mutations.push([offHostImage, /image URL left the reviewed boundary/]);

  const mappingChange = structuredClone(live.payload);
  mappingChange.value.find((row) => row.eventid === "EVT2080").subtitle =
    "Talk";
  mutations.push([mappingChange, /subtype or host needs mapping review/]);

  for (const [payload, expectedError] of mutations) {
    const result = await executeWorker(JSON.stringify(payload));
    assert.match(String(result.error), expectedError);
    assert.deepEqual(result.records, []);
    assert.equal(result.requests.length, 1);
  }
});

test("Atta Galatta input, save-probe, response, and horizon gates are exact", async () => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.text, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, [sourceURL]);
  assert.equal(saveProbe.records.length, 42);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?page=1`,
    "https://attagalatta.com:443/events.php",
    "https://www.attagalatta.com/events.php",
  ]) {
    const result = await executeWorker(live.text, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed JSON URL/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }

  const truncated = await executeWorker("{}");
  assert.match(
    String(truncated.error),
    /JSON response size left the reviewed boundary/,
  );
  assert.deepEqual(truncated.records, []);

  for (const creationTime of ["invalid", "2026-10-05T00:00:00.000Z"]) {
    const result = await executeWorker(live.text, { creationTime });
    assert.ok(result.error);
    assert.deepEqual(result.records, []);
  }
});

test("Atta Galatta uses the authoritative 27-field Scraper Studio schema", async () => {
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
