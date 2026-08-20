import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const sourceURL =
  "https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV";
const observedAt = "2026-08-20T00:00:00.000Z";
const workerURL = new URL(
  "../../sources/mumbai/prithvi-theatre/collector/worker.js",
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
const expectedSessionIds = [
  "723",
  "722",
  "709",
  "710",
  "749",
  "711",
  "712",
  "754",
  "724",
  "725",
  "750",
  "753",
  "734",
  "735",
  "736",
  "759",
  "737",
  "738",
  "778",
  "779",
  "771",
  "760",
  "761",
  "762",
  "763",
  "791",
  "769",
  "770",
  "774",
  "775",
  "772",
  "773",
  "764",
  "765",
  "766",
  "767",
  "768",
  "790",
  "786",
  "788",
  "787",
  "776",
  "777",
  "780",
  "781",
  "782",
  "783",
  "784",
  "785",
];

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
  const requests = [];
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
      if (options.responseObjectWithParsedBody) {
        return { body: JSON.parse(responseBody) };
      }
      if (options.parsedResponseObject) {
        return JSON.parse(responseBody);
      }
      return options.responseObject ? { body: responseBody } : responseBody;
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
      headers: {
        accept: "application/json",
        "user-agent": "BaaharResearch/1.0 (+https://baahar.vercel.app)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/json/i,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      bytes,
      hash: createHash("sha256").update(bytes).digest("hex"),
      payload: JSON.parse(bytes.toString("utf8")),
      text: bytes.toString("utf8"),
    };
  })();
  return livePromise;
}

function independentShape(payload) {
  assert.deepEqual(Object.keys(payload), ["BookMyShow"]);
  assert.deepEqual(Object.keys(payload.BookMyShow).sort(), [
    "aEV",
    "aSI",
    "aST",
    "aVN",
  ]);
  const { aEV, aSI, aST, aVN } = payload.BookMyShow;
  assert.ok(Array.isArray(aEV));
  assert.ok(Array.isArray(aSI));
  assert.ok(Array.isArray(aST));
  assert.ok(Array.isArray(aVN));
  const eventCodes = new Set(aEV.map((event) => event.EventCode));
  const venueIds = new Set(aVN.map((venue) => venue.Venue_strID));
  const dayById = new Map(aSI.map((session) => [session.SessionId, session]));
  assert.equal(eventCodes.size, aEV.length);
  assert.equal(venueIds.size, aVN.length);
  assert.equal(dayById.size, aSI.length);
  assert.equal(aSI.length, aST.length);
  const timedIds = new Set();
  const occurrenceKeys = new Set();
  for (const session of aST) {
    assert.equal(timedIds.has(session.SessionId), false);
    timedIds.add(session.SessionId);
    const day = dayById.get(session.SessionId);
    assert.ok(day);
    assert.equal(day.EventCode, session.EventCode);
    assert.equal(day.VenueID, session.VenueID);
    assert.equal(day.ShowDateCode, session.ShowDateCode);
    assert.equal(day.SeatsAvail, session.SeatsAvail);
    assert.equal(eventCodes.has(session.EventCode), true);
    assert.equal(venueIds.has(session.VenueID), true);
    const occurrenceKey = [
      session.EventCode,
      session.ShowDateCode,
      session.ShowTimeNumeric,
      session.VenueID,
    ].join("\u001f");
    assert.equal(occurrenceKeys.has(occurrenceKey), false);
    occurrenceKeys.add(occurrenceKey);
  }
  assert.deepEqual(timedIds, new Set(dayById.keys()));
  return { aEV, aSI, aST, aVN };
}

function mutate(payload, callback) {
  const copy = structuredClone(payload);
  callback(copy.BookMyShow);
  return JSON.stringify(copy);
}

test("Prithvi exposes one complete first-party JSON schedule", async (t) => {
  const live = await liveSource();
  assert.ok(live.bytes.length >= 5_000 && live.bytes.length <= 500_000);
  const shape = independentShape(live.payload);
  assert.equal(shape.aVN.length, 3);
  assert.equal(shape.aEV.length, 28);
  assert.equal(shape.aSI.length, 49);
  assert.equal(shape.aST.length, 49);
  assert.equal(
    Object.keys(live.payload.BookMyShow).some((key) =>
      /page|next|cursor|pagination/i.test(key),
    ),
    false,
  );
  t.diagnostic(
    `requests/pages: 1/1; bytes: ${live.bytes.length}; SHA-256: ${live.hash}; venues/events/day-sessions/timed-sessions: 3/28/49/49; native timed coverage: 49/49; pagination fields: 0`,
  );
});

test("Prithvi Code worker emits all 49 exact current performances", async (t) => {
  const live = await liveSource();
  const result = await executeWorker(live.text);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [sourceURL]);
  assert.equal(result.records.length, 49);
  assert.deepEqual(
    result.records.map((record) => record.source_event_id),
    expectedSessionIds,
  );
  await validateAuthoritativeSchema(result.records);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(
        Object.groupBy(result.records, (record) => record.category),
      )
        .map(([category, records]) => [category, records.length])
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
    { arts: 2, music: 2, talks: 1, theatre: 44 },
  );
  assert.equal(result.records.filter((record) => record.is_free).length, 4);
  assert.deepEqual(
    result.records
      .filter((record) => ["723", "754"].includes(record.source_event_id))
      .map((record) => [
        record.source_event_id,
        record.is_free,
        record.price_min_minor,
        record.currency,
      ]),
    [
      ["723", false, 50_000, "INR"],
      ["754", true, null, null],
    ],
  );
  assert.equal(
    result.records.every((record) => record.registration_state === "open"),
    true,
  );
  assert.deepEqual(
    result.records
      .slice(0, 2)
      .map((record) => [record.title, record.starts_at, record.ends_at]),
    [
      [
        "B Spot Productions' Lavani Ke rang",
        "2026-08-21T17:00:00+05:30",
        "2026-08-21T18:30:00+05:30",
      ],
      [
        "B Spot Productions LOVE & LAVANI",
        "2026-08-21T20:00:00+05:30",
        "2026-08-21T22:00:00+05:30",
      ],
    ],
  );
  assert.deepEqual(
    result.records
      .slice(-2)
      .map((record) => [record.title, record.starts_at, record.ends_at]),
    [
      [
        "Dramarsis' DAAG",
        "2026-09-29T20:00:00+05:30",
        "2026-09-29T21:00:00+05:30",
      ],
      [
        "Dramarsis' DAAG",
        "2026-09-30T20:00:00+05:30",
        "2026-09-30T21:00:00+05:30",
      ],
    ],
  );
  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_url, "https://prithvitheatre.org/booktickets");
    assert.equal(record.source_host, "prithvitheatre.org");
    assert.equal(record.city_slug, "mumbai");
    assert.equal(record.time_precision, "timed");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(
      record.venue_address,
      "20 Janki Kutir, Juhu Church Road, Mumbai, Maharashtra 400049, India",
    );
    assert.equal(record.price_max_minor, null);
    assert.equal(record.status, "scheduled");
    assert.equal(record.accessibility_note, null);
    assert.equal(record.observed_at, observedAt);
  }
  const rowHash = createHash("sha256")
    .update(JSON.stringify(result.records))
    .digest("hex");
  t.diagnostic(`canonical rows: 49; SHA-256: ${rowHash}`);
});

test("Prithvi worker accepts Studio response objects and drops ended sessions", async () => {
  const live = await liveSource();
  const responseObject = await executeWorker(live.text, {
    responseObject: true,
  });
  assert.ifError(responseObject.error);
  assert.equal(responseObject.records.length, 49);

  const parsedBodyObject = await executeWorker(live.text, {
    responseObjectWithParsedBody: true,
  });
  assert.ifError(parsedBodyObject.error);
  assert.equal(parsedBodyObject.records.length, 49);

  const parsedResponseObject = await executeWorker(live.text, {
    parsedResponseObject: true,
  });
  assert.ifError(parsedResponseObject.error);
  assert.equal(parsedResponseObject.records.length, 49);

  const afterFirstPerformance = await executeWorker(live.text, {
    creationTime: "2026-08-21T13:01:00.000Z",
  });
  assert.ifError(afterFirstPerformance.error);
  assert.equal(afterFirstPerformance.records.length, 48);
  assert.equal(
    afterFirstPerformance.records.some(
      (record) => record.source_event_id === "723",
    ),
    false,
  );
  assert.equal(
    afterFirstPerformance.records.some(
      (record) => record.source_event_id === "722",
    ),
    true,
  );
});

test("Prithvi join, field, and identity drift fail atomically", async () => {
  const live = await liveSource();
  const mutations = [
    [
      mutate(live.payload, (book) => {
        book.aEV.shift();
      }),
      /event identity or genre drifted|day session inventory drifted/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aST[1].SessionId = book.aST[0].SessionId;
      }),
      /timed session inventory drifted/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aSI[0].Region = "DELHI";
      }),
      /day session inventory drifted/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aEV[0].Genre = "Unreviewed";
      }),
      /event identity or genre drifted/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aEV[0].MinPrice = "500";
      }),
      /minimum price format drifted/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aEV[0].Event_strUrlMapping =
          "https://example.com/plays/not-prithvi/ET00345402";
      }),
      /registration URL left the reviewed boundary/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aST[0].ShowTimeNumeric = "2500";
      }),
      /start time is impossible/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aST.at(-1).EndShowTimeDisplay = "25:00 PM";
      }),
      /displayed end time is impossible/,
    ],
    [
      mutate(live.payload, (book) => {
        book.aST.pop();
      }),
      /coverage disagree/,
    ],
    [
      mutate(live.payload, (book) => {
        book.next = "opaque-cursor";
      }),
      /requires pagination review/,
    ],
  ];
  for (const [body, expectedError] of mutations) {
    const result = await executeWorker(body);
    assert.match(String(result.error), expectedError);
    assert.deepEqual(result.records, []);
    assert.deepEqual(result.requests, [sourceURL]);
  }
});

test("Prithvi input, response, and clock gates are exact", async () => {
  const live = await liveSource();
  const saveProbe = await executeWorker(live.text, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.equal(saveProbe.records.length, 49);
  assert.deepEqual(saveProbe.requests, [sourceURL]);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    "https://prithvitheatre.org/api/getPrithviData?cc=PTHV&cmd=DEGETTHEATERS",
    `${sourceURL}&page=1`,
    "https://prithvitheatre.org:443/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV",
    "https://www.prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV",
  ]) {
    const result = await executeWorker(live.text, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|exact reviewed schedule endpoint/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }

  for (const body of ["<html></html>", "{", "null".repeat(2000)]) {
    const result = await executeWorker(body);
    assert.match(
      String(result.error),
      /JSON response left the reviewed boundary|not valid JSON|payload must be an object/,
    );
    assert.deepEqual(result.records, []);
  }

  for (const creationTime of ["invalid", 42, {}]) {
    const result = await executeWorker(live.text, { creationTime });
    assert.match(String(result.error), /job creation time/);
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }
});

test("Prithvi worker is one request with no crawler or parser path", async () => {
  const worker = await workerCode();
  assert.equal((worker.match(/\brequest\s*\(/g) ?? []).length, 1);
  assert.equal((worker.match(/\bload_html\s*\(/g) ?? []).length, 0);
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

test("Prithvi uses the authoritative 27-field staging schema", async () => {
  const [contract, outputSchema] = await Promise.all([
    readFile(contractURL, "utf8").then(JSON.parse),
    readFile(outputSchemaURL, "utf8").then(JSON.parse),
  ]);
  assert.equal(contract.additionalProperties, false);
  assert.deepEqual([...contract.required].sort(), expectedKeys);
  assert.deepEqual(contract.properties.city_slug.enum, [
    "bengaluru",
    "delhi",
    "mumbai",
    "varanasi",
  ]);
  assert.deepEqual(Object.keys(outputSchema.fields).sort(), expectedKeys);
  for (const field of Object.values(outputSchema.fields)) {
    assert.equal(field.active, true);
    assert.equal(field.default_value, "null");
  }
});
