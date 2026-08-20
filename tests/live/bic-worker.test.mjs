import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const SOURCE_HOST = "bangaloreinternationalcentre.org";
const endpoint = `https://${SOURCE_HOST}/wp-json/tribe/events/v1/events`;
const observedAt = "2026-08-18T15:00:00.000Z";
const workerUrl = new URL(
  "../../sources/bengaluru/bic/collector/worker.js",
  import.meta.url,
);
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

function expectedPageUrl(page) {
  const url = new URL(endpoint);
  url.searchParams.set("start_date", "2026-08-18 00:00:00");
  url.searchParams.set("end_date", "2026-09-18 23:59:59");
  url.searchParams.set("per_page", "50");
  url.searchParams.set("page", String(page));
  return url.toString();
}

async function runWorker(payloads) {
  const code = await readFile(workerUrl, "utf8");
  const records = [];
  const requests = [];
  class SandboxDate extends Date {}
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  const context = {
    input: { url: endpoint },
    job: { created: observedAt },
    request(url) {
      requests.push(url);
      assert.ok(payloads.has(url), `unexpected BIC request: ${url}`);
      return JSON.stringify(payloads.get(url));
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
  vm.runInNewContext(code, context, { filename: workerUrl.pathname });
  return { records, requests };
}

function moveOneMinute(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + 1);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

test("BIC Code worker canonicalizes the complete live event array", async () => {
  const firstUrl = expectedPageUrl(1);
  const response = await fetch(firstUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200);
  const firstPayload = await response.json();
  assert.ok(Array.isArray(firstPayload.events));
  assert.ok(Number.isInteger(firstPayload.total_pages));
  assert.ok(firstPayload.total_pages >= 1 && firstPayload.total_pages <= 2);

  const payloads = new Map([[firstUrl, firstPayload]]);
  for (let page = 2; page <= firstPayload.total_pages; page += 1) {
    const url = expectedPageUrl(page);
    const pageResponse = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(pageResponse.status, 200);
    payloads.set(url, await pageResponse.json());
  }
  const sourceEvents = [...payloads.values()].flatMap(
    (payload) => payload.events,
  );
  assert.ok(sourceEvents.length >= 1 && sourceEvents.length <= 100);
  assert.equal(Number(firstPayload.total), sourceEvents.length);

  const { records, requests } = await runWorker(payloads);
  assert.deepEqual(
    requests,
    Array.from({ length: firstPayload.total_pages }, (_, index) =>
      expectedPageUrl(index + 1),
    ),
  );
  assert.equal(records.length, sourceEvents.length);
  assert.equal(
    new Set(records.map((record) => record.source_event_id)).size,
    records.length,
  );

  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_host, "bangaloreinternationalcentre.org");
    assert.equal(new URL(record.source_url).hostname, record.source_host);
    assert.equal(record.city_slug, "bengaluru");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.time_precision, "timed");
    assert.equal(record.status, "scheduled");
    assert.equal(record.is_free, null);
    assert.equal(record.price_min_minor, null);
    assert.equal(record.price_max_minor, null);
    assert.equal(record.currency, null);
    assert.equal(record.registration_url, null);
    assert.equal(record.registration_state, null);
    assert.deepEqual(record.language, []);
    assert.equal(record.age_note, null);
    assert.equal(record.accessibility_note, null);
    assert.ok(Date.parse(record.starts_at) <= Date.parse(record.ends_at));
  }

  const businessEvent = sourceEvents.find((event) =>
    event.categories?.some((category) => category.name === "Business"),
  );
  assert.ok(businessEvent);
  assert.equal(
    records.find(
      (record) => record.source_event_id === String(businessEvent.id),
    ).category,
    "talks",
  );

  const workshopEvent = structuredClone(sourceEvents[0]);
  workshopEvent.categories = [{ name: "Workshops" }, { name: "Science" }];
  const { records: workshopRecords } = await runWorker(
    new Map([
      [firstUrl, { events: [workshopEvent], total: 1, total_pages: 1 }],
    ]),
  );
  assert.equal(workshopRecords[0].category, "workshops");

  const danceEvent = structuredClone(sourceEvents[0]);
  danceEvent.categories = [{ name: "Performing Arts" }, { name: "Dance" }];
  const { records: danceRecords } = await runWorker(
    new Map([[firstUrl, { events: [danceEvent], total: 1, total_pages: 1 }]]),
  );
  assert.equal(danceRecords[0].category, "arts");

  const imageEvent = sourceEvents.find(
    (event) => event.image?.sizes?.["8-col-4-3-hard"]?.url,
  );
  assert.ok(imageEvent);
  assert.equal(
    records.find((record) => record.source_event_id === String(imageEvent.id))
      .image_url,
    imageEvent.image.sizes["8-col-4-3-hard"].url,
  );

  const movedEvent = structuredClone(sourceEvents[0]);
  movedEvent.start_date = moveOneMinute(movedEvent.start_date);
  movedEvent.utc_start_date = moveOneMinute(movedEvent.utc_start_date);
  const movedPayloads = new Map([
    [firstUrl, { events: [movedEvent], total: 1, total_pages: 1 }],
  ]);
  const { records: movedRecords, requests: movedRequests } =
    await runWorker(movedPayloads);
  assert.deepEqual(movedRequests, [firstUrl]);
  assert.equal(movedRecords[0].source_event_id, String(sourceEvents[0].id));

  const portEvent = structuredClone(sourceEvents[0]);
  portEvent.url = portEvent.url.replace(SOURCE_HOST, `${SOURCE_HOST}:443`);
  await assert.rejects(
    runWorker(
      new Map([[firstUrl, { events: [portEvent], total: 1, total_pages: 1 }]]),
    ),
    /canonical host/,
  );

  const portImageEvent = structuredClone(imageEvent);
  portImageEvent.image.sizes["8-col-4-3-hard"].url = portImageEvent.image.sizes[
    "8-col-4-3-hard"
  ].url.replace(SOURCE_HOST, `${SOURCE_HOST}:443`);
  await assert.rejects(
    runWorker(
      new Map([
        [firstUrl, { events: [portImageEvent], total: 1, total_pages: 1 }],
      ]),
    ),
    /image URL contains a port/,
  );

  await assert.rejects(
    runWorker(
      new Map([
        [firstUrl, { events: [sourceEvents[0]], total: 2, total_pages: 1 }],
      ]),
    ),
    /does not match source total/,
  );

  await assert.rejects(
    runWorker(
      new Map([
        [firstUrl, { events: [sourceEvents[0]], total: 2, total_pages: 2 }],
        [
          expectedPageUrl(2),
          { events: [sourceEvents[1]], total: 3, total_pages: 2 },
        ],
      ]),
    ),
    /pagination changed during collection/,
  );
});
