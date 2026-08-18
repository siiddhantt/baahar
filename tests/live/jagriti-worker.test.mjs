import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { parse } from "../../apps/web/node_modules/parse5/dist/index.js";

const listURL = "https://www.jagrititheatre.com/jagriti-events-collections";
const observedAt = "2026-08-18T16:00:00.000Z";
const workerURL = new URL(
  "../../sources/bengaluru/jagriti/collector/worker.js",
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
  if (selector.startsWith("."))
    return classes(node).includes(selector.slice(1));
  const [tagName, className] = selector.split(".");
  return (
    node.tagName === tagName &&
    (!className || classes(node).includes(className))
  );
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
    return new Selection(
      this.nodes.flatMap((node) =>
        (node.childNodes ?? []).filter((child) => matches(child, selector)),
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

function one(selection, label) {
  assert.equal(selection.length, 1, `${label} must be unique`);
  return selection;
}

function localInstant(value) {
  const match = cleanText(value).match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (AM|PM)$/,
  );
  assert.ok(match, `invalid live timestamp: ${value}`);
  const hour = (Number(match[4]) % 12) + (match[6] === "PM" ? 12 : 0);
  return `${match[1]}-${match[2]}-${match[3]}T${String(hour).padStart(2, "0")}:${match[5]}:00+05:30`;
}

function sourceOccurrences($, root) {
  const occurrences = [];
  root.find(".addthisevent").each((_, node) => {
    const block = $(node);
    const start = localInstant(one(block.find(".start"), "start").text());
    const end = localInstant(one(block.find(".end"), "end").text());
    occurrences.push({
      start,
      end,
      timezone: cleanText(one(block.find(".timezone"), "timezone").text()),
      title: cleanText(one(block.find(".title"), "title").text()),
    });
  });
  return occurrences;
}

function sourceList(markup) {
  const $ = loadHtml(markup);
  const rows = $(".evtabrow");
  assert.ok(rows.length >= 1 && rows.length <= 25);
  const events = [];
  rows.each((_, node) => {
    const row = $(node);
    const titleLink = one(row.find(".tevtit").find("a"), "title link");
    const thumbnail = one(row.find(".evtabplimg").find("img"), "thumbnail");
    const booking = one(row.find(".bmslink").find("a"), "booking link");
    const price = cleanText(one(row.find(".tevtpri"), "price").text());
    const priceMatch = price.match(/^Ticket Price:\s*₹\s*(\d+)$/);
    assert.ok(priceMatch, `unexpected live price: ${price}`);
    events.push({
      title: cleanText(titleLink.text()),
      detailURL: titleLink.attr("href"),
      imageURL: thumbnail.attr("src"),
      priceMinor: Number(priceMatch[1]) * 100,
      genre: cleanText(one(row.find(".evtabgenr"), "genre").text()),
      registrationURL: booking.attr("href"),
      occurrences: sourceOccurrences($, row),
    });
  });
  return events;
}

function sourceDetail(markup) {
  const $ = loadHtml(markup);
  const metadata = new Map();
  one($(".evedettab"), "metadata table")
    .find("tr")
    .each((_, node) => {
      const values = [];
      $(node)
        .children("td")
        .each((__, cell) => values.push(cleanText($(cell).text())));
      assert.equal(values.length, 2);
      metadata.set(values[0].replace(/:\s*$/, ""), values[1]);
    });
  return {
    title: cleanText(one($("h1"), "detail h1").text()),
    metadata,
    registrationURL: one(
      one($(".bmslink"), "detail booking block").find("a"),
      "detail booking link",
    ).attr("href"),
    occurrences: sourceOccurrences($, $("body")),
  };
}

let liveSitePromise;
function liveSite() {
  if (!liveSitePromise) {
    liveSitePromise = (async () => {
      const listResponse = await fetch(listURL, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(15_000),
      });
      assert.equal(listResponse.status, 200);
      assert.match(
        listResponse.headers.get("content-type") ?? "",
        /^text\/html/i,
      );
      const listMarkup = await listResponse.text();
      const events = sourceList(listMarkup);
      const details = await Promise.all(
        events.map(async (event) => {
          const response = await fetch(event.detailURL, {
            headers: { accept: "text/html" },
            signal: AbortSignal.timeout(15_000),
          });
          assert.equal(response.status, 200);
          assert.match(
            response.headers.get("content-type") ?? "",
            /^text\/html/i,
          );
          return [event.detailURL, await response.text()];
        }),
      );
      return {
        listMarkup,
        events,
        responses: new Map([[listURL, listMarkup], ...details]),
      };
    })();
  }
  return liveSitePromise;
}

async function executeWorker(
  responses,
  { inputURL = listURL, creationTime = observedAt } = {},
) {
  const code = await readFile(workerURL, "utf8");
  const records = [];
  const requests = [];
  class SandboxDate extends Date {}
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  Object.defineProperty(SandboxDate, "UTC", { value: undefined });
  const context = {
    input: { url: inputURL },
    job: { created: creationTime },
    request(url) {
      requests.push(url);
      if (!responses.has(url)) throw new Error(`unexpected request: ${url}`);
      return responses.get(url);
    },
    load_html: loadHtml,
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
    vm.runInNewContext(code, context, { filename: workerURL.pathname });
    return { error: null, records, requests };
  } catch (error) {
    return { error, records, requests };
  }
}

function categoryFor(genre) {
  if (/\b(?:music|concert|jazz|vocal)\b/i.test(genre)) return "music";
  if (/\b(?:theatre|drama|comedy|psychological|tragedy)\b/i.test(genre)) {
    return "theatre";
  }
  if (/\b(?:dance|bharatanatyam|visual art)\b/i.test(genre)) return "arts";
  if (/\b(?:talk|lecture)\b/i.test(genre)) return "talks";
  return "other";
}

test("Jagriti worker canonicalizes every live list/detail performance", async (t) => {
  const live = await liveSite();
  const result = await executeWorker(live.responses);
  assert.ifError(result.error);

  const expectedRequests = [
    listURL,
    ...live.events.map((event) => event.detailURL),
  ];
  assert.deepEqual(result.requests, expectedRequests);
  const expectedCount = live.events.reduce(
    (total, event) => total + event.occurrences.length,
    0,
  );
  assert.equal(result.records.length, expectedCount);
  assert.ok(expectedCount >= 1 && expectedCount <= 50);
  t.diagnostic(
    `official productions: ${live.events.length}; timed performances: ${expectedCount}; pages: ${expectedRequests.length}`,
  );

  const expectedByIdentity = new Map();
  for (const event of live.events) {
    const detail = sourceDetail(live.responses.get(event.detailURL));
    assert.equal(detail.title, event.title);
    assert.deepEqual(detail.occurrences, event.occurrences);
    assert.equal(detail.registrationURL, event.registrationURL);
    for (const occurrence of event.occurrences) {
      expectedByIdentity.set(`${event.detailURL}\u001f${occurrence.start}`, {
        event,
        detail,
        occurrence,
      });
    }
  }

  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    const expected = expectedByIdentity.get(
      `${record.source_url}\u001f${record.starts_at}`,
    );
    assert.ok(
      expected,
      "worker emitted an occurrence absent from the official pages",
    );
    const { event, detail, occurrence } = expected;
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, null);
    assert.equal(record.source_host, "www.jagrititheatre.com");
    assert.equal(record.city_slug, "bengaluru");
    assert.equal(record.title, event.title);
    assert.equal(record.category, categoryFor(event.genre));
    assert.equal(record.start_date, occurrence.start.slice(0, 10));
    assert.equal(record.ends_at, occurrence.end);
    assert.equal(record.end_date, occurrence.end.slice(0, 10));
    assert.equal(record.time_precision, "timed");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.venue_name, "Jagriti Theatre");
    assert.equal(
      record.venue_address,
      "Jagriti, Ramagondanahalli, Varthur Road, Whitefield, Bengaluru 560066, India",
    );
    assert.equal(record.is_free, false);
    assert.equal(record.price_min_minor, event.priceMinor);
    assert.equal(record.price_max_minor, event.priceMinor);
    assert.equal(record.currency, "INR");
    assert.equal(record.registration_url, event.registrationURL);
    assert.equal(record.registration_state, null);
    assert.equal(record.status, "scheduled");
    assert.deepEqual(
      record.language,
      detail.metadata.get("Language").split(","),
    );
    assert.equal(record.age_note, detail.metadata.get("Age"));
    assert.equal(record.accessibility_note, null);
    assert.equal(record.image_url, event.imageURL);
    assert.equal(record.observed_at, observedAt);
  }

  assert.equal(
    result.records.filter((record) => record.title === "12 Angry Men").length,
    4,
    "the shared parent event must produce four performance occurrences",
  );
});

test("Jagriti list/detail drift fails before collection", async () => {
  const live = await liveSite();
  const target = live.events.find((event) => event.title === "12 Angry Men");
  assert.ok(target);

  const mutations = [
    [/Asia\/Kolkata/, "UTC", /structured performance metadata drifted/],
    [
      /2026-08-22 03:30 PM/,
      "2026-08-22 04:30 PM",
      /performances disagree|interval disagrees/,
    ],
    [/&#x20B9; 500/, "&#x20B9; 600", /commercial metadata disagree/],
    [
      /https:\/\/in\.bookmyshow\.com\/plays\/12-angry-men\/ET00503483/g,
      "https://example.com/12-angry-men",
      /booking boundary/,
    ],
    [
      /2026-08-22 03:30 PM/,
      "2026-02-30 03:30 PM",
      /impossible local timestamp/,
    ],
  ];

  for (const [pattern, replacement, expectedError] of mutations) {
    const responses = new Map(live.responses);
    responses.set(
      target.detailURL,
      responses.get(target.detailURL).replace(pattern, replacement),
    );
    const result = await executeWorker(responses);
    assert.match(String(result.error), expectedError);
    assert.equal(result.records.length, 0);
  }
});

test("Jagriti validates stale rows, then emits only future performances", async () => {
  const live = await liveSite();
  const afterFirstMatinee = "2026-08-22T12:00:00.000Z";
  const filtered = await executeWorker(live.responses, {
    creationTime: afterFirstMatinee,
  });
  assert.ifError(filtered.error);
  assert.equal(
    filtered.records.filter((record) => record.title === "12 Angry Men").length,
    3,
    "the finished matinee must not hide the same production's later shows",
  );
  assert.equal(
    filtered.records.some(
      (record) => record.title === "Confessions from Mental Asylum",
    ),
    false,
    "a production may contribute zero future performances",
  );
  assert.ok(
    filtered.records.every(
      (record) => record.starts_at >= "2026-08-22T17:30:00+05:30",
    ),
  );

  const target = live.events.find((event) => event.title === "12 Angry Men");
  assert.ok(target);
  const brokenPastOccurrence = new Map(live.responses);
  brokenPastOccurrence.set(
    target.detailURL,
    brokenPastOccurrence.get(target.detailURL).replace(/Asia\/Kolkata/, "UTC"),
  );
  const structuralDrift = await executeWorker(brokenPastOccurrence, {
    creationTime: afterFirstMatinee,
  });
  assert.match(
    String(structuralDrift.error),
    /structured performance metadata drifted/,
  );
  assert.equal(
    structuralDrift.records.length,
    0,
    "even a completed occurrence must be structurally validated before filtering",
  );

  const noFutureRows = await executeWorker(live.responses, {
    creationTime: "2026-11-02T00:00:00.000Z",
  });
  assert.match(String(noFutureRows.error), /total performance count/);
  assert.equal(noFutureRows.records.length, 0);
});

test("Jagriti input boundary is exact and the save probe is deterministic", async () => {
  const live = await liveSite();
  const saveProbe = await executeWorker(live.responses, {
    inputURL: undefined,
  });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, [
    listURL,
    ...live.events.map((event) => event.detailURL),
  ]);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${listURL}?page=1`,
    "https://www.jagrititheatre.com:443/jagriti-events-collections",
    "https://jagrititheatre.com/jagriti-events-collections",
  ]) {
    const result = await executeWorker(live.responses, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed What's On URL/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }
});
