import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { parse } from "../../apps/web/node_modules/parse5/dist/index.js";

const endpoint = "https://www.rudrakshcentre.com/upcoming-event";
const observedAt = "2026-08-18T16:00:00.000Z";
const workerUrl = new URL(
  "../../sources/varanasi/rudraksh/collector/worker.js",
  import.meta.url,
);
const expectedHeaders = [
  "Event Date From",
  "Event Date to",
  "Organizing Body",
  "Event Name",
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
    const nodes = this.nodes.flatMap((node) =>
      (node.childNodes ?? []).filter((child) => child.tagName === selector),
    );
    return new Selection(nodes);
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

function cells($, row, selector) {
  const values = [];
  $(row)
    .children(selector)
    .each((_, cell) => values.push(cleanText($(cell).text())));
  return values;
}

function sourceRows(markup) {
  const $ = loadHtml(markup);
  let reviewedTable;
  $("table").each((_, table) => {
    const headers = cells($, $(table).find("tr").first().nodes[0], "th");
    if (
      headers.length === 4 &&
      headers.every((value, i) => value === expectedHeaders[i])
    ) {
      reviewedTable = table;
    }
  });
  assert.ok(reviewedTable, "live page must expose the reviewed event table");

  const rows = [];
  $(reviewedTable)
    .find("tr")
    .each((index, row) => {
      if (index === 0) return;
      const element = $(row);
      const style = cleanText(element.attr("style"))
        .toLowerCase()
        .replace(/\s/g, "");
      if (
        element.attr("hidden") !== undefined ||
        element.attr("aria-hidden") === "true" ||
        style.includes("display:none") ||
        style.includes("visibility:hidden")
      ) {
        return;
      }
      rows.push(cells($, row, "td"));
    });
  return rows;
}

function htmlPage(rows, extra = "") {
  const header = expectedHeaders.map((value) => `<th>${value}</th>`).join("");
  const body = rows
    .map(
      (row) => `<tr>${row.map((value) => `<td>${value}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<html><body><table><tr>${header}</tr>${body}${extra}</table></body></html>`;
}

function sourceDate(value) {
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const [, day, month, year] = value.match(/^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/);
  return `${year}-${months[month]}-${day}`;
}

async function runWorker(markup, options = {}) {
  const inputUrl = Object.hasOwn(options, "inputUrl")
    ? options.inputUrl
    : endpoint;
  const creationTime = Object.hasOwn(options, "creationTime")
    ? options.creationTime
    : observedAt;
  const code = await readFile(workerUrl, "utf8");
  const records = [];
  const requests = [];
  const routes = [];
  const operations = [];
  class SandboxDate extends Date {}
  Object.defineProperty(SandboxDate, "parse", { value: undefined });
  Object.defineProperty(SandboxDate, "UTC", { value: undefined });
  const context = {
    input: { url: inputUrl },
    job: { created: creationTime },
    country(code) {
      routes.push(code);
      operations.push(`country:${code}`);
    },
    request(url) {
      requests.push(url);
      operations.push(`request:${url}`);
      return markup;
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
  vm.runInNewContext(code, context, { filename: workerUrl.pathname });
  assert.deepEqual(routes, ["in"], "worker must select only the India route");
  assert.deepEqual(
    operations,
    [`country:in`, `request:${endpoint}`],
    "worker must set one India route before one canonical request",
  );
  return { records, requests, routes };
}

test("Rudraksh Code worker canonicalizes the complete visible live table", async (t) => {
  const response = await fetch(endpoint, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/i);
  const markup = await response.text();
  const rows = sourceRows(markup);
  assert.ok(rows.length >= 1 && rows.length <= 50);
  assert.ok(rows.every((row) => row.length === 4 && row.every(Boolean)));

  const { records, requests, routes } = await runWorker(markup);
  assert.deepEqual(requests, [endpoint]);
  assert.deepEqual(routes, ["in"]);
  assert.equal(records.length, rows.length);
  t.diagnostic(`visible official rows: ${records.length}`);

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const row = rows[index];
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, null);
    assert.equal(record.source_url, endpoint);
    assert.equal(record.source_host, "www.rudrakshcentre.com");
    assert.equal(record.city_slug, "varanasi");
    assert.equal(record.title, row[3]);
    assert.equal(record.start_date, sourceDate(row[0]));
    assert.equal(record.end_date, sourceDate(row[1]));
    assert.equal(record.starts_at, null);
    assert.equal(record.ends_at, null);
    assert.equal(record.time_precision, "date");
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(
      record.venue_name,
      "Rudraksh International Cooperation & Convention Centre",
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
    assert.equal(record.image_url, null);
    assert.equal(record.observed_at, observedAt);
  }

  const categoryByTitle = new Map(
    records.map((record) => [record.title, record.category]),
  );
  assert.equal(categoryByTitle.get("ARTH Theatre Fest"), "theatre");
  assert.equal(categoryByTitle.get("Hind Ka Sitara"), "theatre");
  assert.equal(categoryByTitle.get("Satsang"), "community");
  assert.equal(categoryByTitle.get("Conferences"), "talks");
  assert.equal(categoryByTitle.get("Exhibition"), "other");
});

test("comments and hidden rows never become Rudraksh occurrences", async () => {
  const visible = [
    ["22-Aug-2026", "23-Aug-2026", "AayojanX Events", "Exhibition"],
  ];
  const extra = [
    "<!-- <tr><td>25-Nov-2026</td><td>27-Nov-2026</td><td>Private</td><td>Training</td></tr> -->",
    "<tr hidden><td>26-Nov-2026</td><td>26-Nov-2026</td><td>Private</td><td>Hidden Event</td></tr>",
  ].join("");
  const { records } = await runWorker(htmlPage(visible, extra));
  assert.deepEqual(
    records.map((record) => record.title),
    ["Exhibition"],
  );
});

test("Rudraksh bounds fail closed before collection", async () => {
  const sameDate = [
    ["22-Aug-2026", "22-Aug-2026", "First Organiser", "First Event"],
    ["22-Aug-2026", "22-Aug-2026", "Second Organiser", "Second Event"],
  ];
  const { records } = await runWorker(htmlPage(sameDate));
  assert.equal(
    records.length,
    2,
    "different titles on one date must remain distinct",
  );

  await assert.rejects(
    runWorker(htmlPage([sameDate[0], sameDate[0]])),
    /repeated a derived occurrence identity/,
  );
  await assert.rejects(
    runWorker(
      htmlPage([["17-Aug-2026", "17-Aug-2026", "Organiser", "Past Event"]]),
    ),
    /past visible row/,
  );
  await assert.rejects(
    runWorker(
      htmlPage([["23-Aug-2026", "22-Aug-2026", "Organiser", "Reversed Event"]]),
    ),
    /ends before it starts/,
  );
  await assert.rejects(
    runWorker(
      "<table><tr><th>Event Date From</th><th>Event Date to</th><th>Organizing Body</th><th>Event Name</th></tr><tr><td>22-Aug-2026</td><td>22-Aug-2026</td><td>Only three</td></tr></table>",
    ),
    /exactly four non-empty cells/,
  );

  const leapDay = await runWorker(
    htmlPage([["29-Feb-2028", "29-Feb-2028", "Organiser", "Leap Day Event"]]),
  );
  assert.equal(leapDay.records[0].start_date, "2028-02-29");

  for (const impossibleDate of ["29-Feb-2027", "31-Apr-2027", "00-Jan-2027"]) {
    await assert.rejects(
      runWorker(
        htmlPage([
          [impossibleDate, impossibleDate, "Organiser", "Impossible Event"],
        ]),
      ),
      /impossible calendar date/,
    );
  }

  const saveProbe = await runWorker(htmlPage(sameDate), {
    inputUrl: undefined,
  });
  assert.deepEqual(
    saveProbe.requests,
    [endpoint],
    "the platform save probe must compile only to the reviewed URL",
  );

  for (const inputUrl of [null, {}, 42]) {
    await assert.rejects(
      runWorker(htmlPage(sameDate), { inputUrl }),
      /must contain one URL string/,
    );
  }

  for (const inputUrl of [
    "",
    `${endpoint}?page=1`,
    "https://www.rudrakshcentre.com:443/upcoming-event",
    "https://rudrakshcentre.com/upcoming-event",
  ]) {
    await assert.rejects(
      runWorker(htmlPage(sameDate), { inputUrl }),
      /valid URL|bare reviewed upcoming-events URL/,
    );
  }
});
