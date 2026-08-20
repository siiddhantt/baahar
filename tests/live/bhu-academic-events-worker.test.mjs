import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const sourceURL = "https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming";
const apiURL = "https://www.bhu.ac.in/Homepage/GetAcademicEvents";
const apiBody = '{obj:{"Action":4,"UnitId":"2"}}';
const contentType = "application/json; charset=UTF-8";
const observedAt = "2026-08-19T00:00:00.000Z";
const expectedIDs = [
  "6386",
  "6383",
  "6382",
  "6389",
  "6385",
  "6381",
  "6397",
  "6396",
  "6376",
  "6387",
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
  "../../sources/varanasi/bhu-academic-events/collector/worker.js",
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

async function executeWorker(
  responseBody,
  { inputURL = sourceURL, creationTime = observedAt } = {},
) {
  const worker = await workerCode();
  const requests = [];
  const records = [];
  class SandboxDate extends Date {}
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  Object.defineProperty(SandboxDate, "UTC", { value: undefined });
  const context = {
    input: { url: inputURL },
    job: { created: creationTime },
    request(options) {
      assert.equal(arguments.length, 1);
      requests.push(structuredClone(options));
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
    await vm.runInNewContext(`(async () => {${worker}\n})()`, context, {
      filename: workerURL.pathname,
    });
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
  if (!livePromise) {
    livePromise = (async () => {
      const response = await fetch(apiURL, {
        method: "POST",
        headers: { "content-type": contentType },
        body: apiBody,
        signal: AbortSignal.timeout(20_000),
      });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      const text = bytes.toString("utf8");
      return {
        bytes,
        hash: createHash("sha256").update(bytes).digest("hex"),
        payload: JSON.parse(text),
        responseContentType: response.headers.get("content-type"),
        text,
      };
    })();
  }
  return livePromise;
}

test("BHU public API needs one direct POST and no browser session", async (t) => {
  const live = await liveSource();
  assert.equal(live.bytes.length, 1_778_717);
  assert.match(live.responseContentType ?? "", /^text\/html/i);
  assert.deepEqual(Object.keys(live.payload).sort(), ["Table", "Table1"]);
  assert.equal(live.payload.Table1.length, 756);
  assert.equal(
    live.payload.Table1.filter((row) => row.EventType === "Upcoming").length,
    20,
  );
  t.diagnostic(
    `requests: 1; response bytes: ${live.bytes.length}; response SHA-256: ${live.hash}; rows: 756; upcoming: 20`,
  );
});

test("BHU Code worker emits the exact public Varanasi horizon", async (t) => {
  const live = await liveSource();
  const result = await executeWorker(live.text);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [
    {
      url: apiURL,
      method: "POST",
      headers: { "content-type": contentType },
      body: apiBody,
    },
  ]);
  assert.deepEqual(
    result.records.map((record) => record.source_event_id),
    expectedIDs,
  );
  assert.equal(result.records.length, 10);
  await validateAuthoritativeSchema(result.records);

  assert.deepEqual(
    Object.fromEntries(
      result.records.map((record) => [record.source_event_id, record.category]),
    ),
    {
      6376: "workshops",
      6381: "other",
      6382: "workshops",
      6383: "workshops",
      6385: "talks",
      6386: "other",
      6387: "talks",
      6389: "workshops",
      6396: "talks",
      6397: "talks",
    },
  );

  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_host, "www.bhu.ac.in");
    assert.equal(record.city_slug, "varanasi");
    assert.match(record.venue_name, /\bVaranasi\b/i);
    assert.equal(record.time_precision, "timed");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.status, "scheduled");
    assert.equal(record.observed_at, observedAt);
  }
  const registrations = result.records.filter(
    (record) => record.registration_url !== null,
  );
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].source_event_id, "6381");
  assert.equal(
    registrations[0].registration_url,
    "https://forms.gle/VwFdYqPhfFw6HG7MA",
  );
  const recordHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  assert.equal(
    recordHash,
    "ee865a76c4f85e3cccc80e77c67513e7435875d80e39bcb49cf3fdae2a14dcbb",
  );
  t.diagnostic(`emitted: 10; canonical SHA-256: ${recordHash}`);
});

test("BHU interaction code contains one exact request and no alternate path", async () => {
  const worker = await workerCode();
  assert.equal((worker.match(/\brequest\s*\(/g) ?? []).length, 1);
  for (const forbidden of [
    /\bnavigate\s*\(/,
    /\btag_response\s*\(/,
    /\bparse\s*\(\s*\)/,
    /\bload_html\s*\(/,
    /\bclick\s*\(/,
    /\bscroll_\w+\s*\(/,
    /\bnext_stage\s*\(/,
    /\brerun_stage\s*\(/,
  ]) {
    assert.doesNotMatch(worker, forbidden);
  }
  assert.match(worker, /method:\s*"POST"/);
  assert.match(worker, /"content-type":\s*"application\/json; charset=UTF-8"/);
});

test("BHU plural workshop formats remain participatory", async () => {
  const live = await liveSource();
  for (const title of [
    "Pre Conference Workshops MDSICON 2025",
    "Summer Schools in Crop Improvement",
  ]) {
    const payload = structuredClone(live.payload);
    payload.Table1.find((row) => row.AcademicEventsId === 6386).EventName =
      title;
    const result = await executeWorker(JSON.stringify(payload));
    assert.ifError(result.error);
    assert.equal(
      result.records.find((record) => record.source_event_id === "6386")
        .category,
      "workshops",
    );
  }
});

test("BHU malformed source facts fail before collection", async () => {
  const live = await liveSource();
  const mutations = [];

  const duplicateID = structuredClone(live.payload);
  duplicateID.Table1.find(
    (row) => row.EventType === "Upcoming",
  ).AcademicEventsId = duplicateID.Table1.filter(
    (row) => row.EventType === "Upcoming",
  )[1].AcademicEventsId;
  mutations.push([duplicateID, /repeated an upcoming native event ID/]);

  const brokenDate = structuredClone(live.payload);
  brokenDate.Table1.find((row) => row.AcademicEventsId === 6386).EventFromDate =
    "31-Feb-2026";
  mutations.push([brokenDate, /start date is impossible/]);

  const partialTime = structuredClone(live.payload);
  partialTime.Table1.find((row) => row.AcademicEventsId === 6386).EventEndTime =
    null;
  mutations.push([partialTime, /only one time boundary/]);

  for (const malformedTime of [123, { hour: 10 }]) {
    const badTypes = structuredClone(live.payload);
    const row = badTypes.Table1.find((item) => item.AcademicEventsId === 6386);
    row.EventStartTime = structuredClone(malformedTime);
    row.EventEndTime = structuredClone(malformedTime);
    mutations.push([badTypes, /start time has an unsupported type/]);
  }

  const ambiguousRegistration = structuredClone(live.payload);
  ambiguousRegistration.Table1.find(
    (row) => row.AcademicEventsId === 6381,
  ).AcademicEventsDetails += " https://forms.gle/SecondForm";
  mutations.push([ambiguousRegistration, /registration/]);

  const tooFew = structuredClone(live.payload);
  for (const row of tooFew.Table1) {
    if (expectedIDs.includes(String(row.AcademicEventsId)))
      row.OpenTo = "Faculty";
  }
  mutations.push([tooFew, /eligible record count/]);

  const incompleteView = structuredClone(live.payload);
  for (const row of incompleteView.Table1) row.AcademicEventsDetails = null;
  mutations.push([incompleteView, /API response size/]);

  for (const [payload, expectedError] of mutations) {
    const result = await executeWorker(JSON.stringify(payload));
    assert.match(String(result.error), expectedError);
    assert.deepEqual(result.records, []);
    assert.equal(result.requests.length, 1);
  }

  for (const body of ["{}", "not-json", { body: "{}" }]) {
    const result = await executeWorker(body);
    assert.ok(result.error);
    assert.deepEqual(result.records, []);
  }
});

test("BHU audience, city, input, and horizon gates are exact", async () => {
  const live = await liveSource();
  const excluded = structuredClone(live.payload);
  excluded.Table1.find((row) => row.AcademicEventsId === 6386).OpenTo =
    "Faculty";
  excluded.Table1.find((row) => row.AcademicEventsId === 6383).Location =
    "New Delhi";
  const filtered = await executeWorker(JSON.stringify(excluded));
  assert.ifError(filtered.error);
  assert.equal(filtered.records.length, 8);

  const saveProbe = await executeWorker(live.text, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.equal(saveProbe.records.length, 10);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}&page=2`,
    "https://www.bhu.ac.in:443/Site/EventsList/1_2_16_Main?Upcoming",
  ]) {
    const result = await executeWorker(live.text, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|reviewed upcoming-events URL/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }

  for (const creationTime of ["invalid", "2027-02-01T00:00:00.000Z"]) {
    const result = await executeWorker(live.text, { creationTime });
    assert.ok(result.error);
    assert.deepEqual(result.records, []);
  }
});

test("BHU uses the authoritative 27-field Scraper Studio schema", async () => {
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
