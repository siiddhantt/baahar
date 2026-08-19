import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { parse } from "../../apps/web/node_modules/parse5/dist/index.js";

const sourceURL = "https://www.galaxyregistration.com/event/skill-school/";
const observedAt = "2026-08-19T00:00:00.000Z";
const workerURL = new URL(
  "../../sources/varanasi/emindia/collector/worker.js",
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
  const [tagName, ...classNames] = selector.split(".");
  return (
    (!tagName || node.tagName === tagName) &&
    classNames.every((className) => classes(node).includes(className))
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

  contents() {
    return new Selection(this.nodes.flatMap((node) => node.childNodes ?? []));
  }

  each(callback) {
    this.nodes.forEach((node, index) => callback(index, node));
    return this;
  }

  filter(callback) {
    return new Selection(
      this.nodes.filter((node, index) => callback(index, node)),
    );
  }

  find(selector) {
    return new Selection(descendants(this.nodes, selector));
  }

  parent() {
    return new Selection([
      ...new Set(this.nodes.map((node) => node.parentNode).filter(Boolean)),
    ]);
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

function cells($, row, tagName, count, label) {
  const selection = $(row).children(tagName);
  assert.equal(selection.length, count, `${label} count`);
  return selection.nodes.map((node) => $(node));
}

function lines($, selection) {
  const result = [];
  let buffer = "";
  selection.contents().each((_, node) => {
    if ((node.tagName ?? "").toLowerCase() === "br") {
      const line = cleanText(buffer);
      if (line) result.push(line);
      buffer = "";
    } else {
      buffer += ` ${nodeText(node)}`;
    }
  });
  const finalLine = cleanText(buffer);
  if (finalLine) result.push(finalLine);
  return result;
}

const monthNumbers = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

function sourceDate(value) {
  const match = cleanText(value).match(
    /^(\d{1,2})(?:st|nd|rd|th) ([A-Z][a-z]+) (\d{4})$/,
  );
  assert.ok(match, `unsupported source date: ${value}`);
  return `${match[3]}-${monthNumbers[match[2]]}-${match[1].padStart(2, "0")}`;
}

function sessionHeading(value) {
  const match = cleanText(value).match(
    /^(\d{1,2})(?:st|nd|rd|th) ([A-Z][a-z]+) (\d{4}) \([A-Z][a-z]+\) (\d{4})-(\d{4}) Hours$/,
  );
  assert.ok(match, `unsupported source session: ${value}`);
  const date = `${match[3]}-${monthNumbers[match[2]]}-${match[1].padStart(2, "0")}`;
  const instant = (clock) =>
    `${date}T${clock.slice(0, 2)}:${clock.slice(2)}:00+05:30`;
  return { date, startsAt: instant(match[4]), endsAt: instant(match[5]) };
}

function sourceOccurrences(markup) {
  const $ = loadHtml(markup);
  const allTables = $("table");
  assert.equal(allTables.length, 8);
  const conferenceHeading = one(
    $("h2").filter(
      (_, node) => cleanText($(node).text()) === "Conference Details",
    ),
    "Conference Details heading",
  );
  const scheduleSelection = one(
    conferenceHeading.parent().children(".is-acf-field"),
    "Conference Details field",
  )
    .children(".value")
    .children("table");
  assert.equal(scheduleSelection.length, 5);
  const scheduleTables = [];
  scheduleSelection.each((_, node) => {
    const table = $(node);
    const classNames = classes(node);
    if (
      classNames.length === 3 &&
      ["table", "table-bordered", "text-center"].every((name) =>
        classNames.includes(name),
      ) &&
      table.attr("border") === "1" &&
      table.attr("cellspacing") === "0" &&
      table.attr("cellpadding") === "5"
    ) {
      scheduleTables.push(table);
    }
  });
  assert.equal(scheduleTables.length, 5);
  const commercialTables = allTables.nodes.filter((node) => {
    const classNames = classes(node);
    return (
      (classNames.length === 4 && classNames.includes("align-middle")) ||
      (classNames.length === 2 &&
        classNames.includes("table") &&
        classNames.includes("table-bordered"))
    );
  });
  assert.equal(commercialTables.length, 3);
  const detailTables = [];
  const summaries = [];
  for (const table of scheduleTables) {
    const headerRows = one(table.children("thead"), "table head").children(
      "tr",
    );
    if (headerRows.length === 2) detailTables.push(table);
    else {
      assert.equal(headerRows.length, 1);
      summaries.push(table);
    }
  }
  assert.equal(detailTables.length, 3);
  assert.equal(summaries.length, 2);

  const expected = [];
  for (const table of detailTables) {
    const headerRows = table.children("thead").children("tr").nodes;
    const heading = cleanText(
      cells($, headerRows[0], "th", 1, "heading")[0].text(),
    );
    const session = sessionHeading(heading);
    const labelCells = cells($, headerRows[1], "th", 2, "labels");
    const label = cleanText(labelCells[0].text());
    const rowCount = label === "EMINDIA Skills School Course" ? 4 : 1;
    assert.ok(
      ["EMINDIA Skills School Course", "EMINDIA Skills Mela Course"].includes(
        label,
      ),
    );
    assert.equal(cleanText(labelCells[1].text()), "Venue");
    const rows = one(table.children("tbody"), "detail body").children("tr");
    assert.equal(rows.length, rowCount);
    rows.each((_, row) => {
      const values = cells($, row, "td", 2, "course");
      assert.equal(cleanText(values[1].text()), "BHU Varanasi");
      expected.push({
        title: cleanText(values[0].text()),
        date: session.date,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        precision: "timed",
      });
    });
  }

  let restrictedCount = 0;
  for (const table of summaries) {
    const rows = one(table.children("tbody"), "summary body").children("tr");
    assert.equal(rows.length, 3);
    rows.each((_, row) => {
      const values = cells($, row, "td", 3, "summary");
      const activityLines = lines($, values[1]);
      const noteLines = lines($, values[2]);
      if (
        activityLines[0] ===
        "WHO-CCET Emergency Care Network (WECAN) Roundtable"
      ) {
        assert.ok(noteLines.includes("By invitation only."));
        restrictedCount += 1;
        return;
      }
      if (
        activityLines[0] === "Skills Mela" ||
        activityLines[0] === "EMINDIA Skills Schools"
      ) {
        return;
      }
      const date = sourceDate(cleanText(values[0].text()));
      const titles = [];
      for (const line of activityLines) {
        if (line.startsWith("(")) titles[titles.length - 1] += ` ${line}`;
        else titles.push(line);
      }
      for (const title of titles) {
        expected.push({
          title,
          date,
          startsAt: null,
          endsAt: null,
          precision: "date",
        });
      }
    });
  }
  assert.equal(restrictedCount, 1);
  assert.equal(expected.length, 13);
  assert.equal(
    expected.filter((occurrence) => occurrence.precision === "timed").length,
    9,
  );
  assert.equal(
    expected.filter((occurrence) => occurrence.precision === "date").length,
    4,
  );
  return expected;
}

let livePagePromise;
async function livePage() {
  if (!livePagePromise) {
    livePagePromise = (async () => {
      const response = await fetch(sourceURL, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(20_000),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html/i);
      const markup = await response.text();
      return { markup, expected: sourceOccurrences(markup) };
    })();
  }
  return livePagePromise;
}

async function executeWorker(
  markup,
  { inputURL = sourceURL, creationTime = observedAt } = {},
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
      if (url !== sourceURL) throw new Error(`unexpected request: ${url}`);
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
  try {
    vm.runInNewContext(code, context, { filename: workerURL.pathname });
    return { error: null, records, requests };
  } catch (error) {
    return { error, records, requests };
  }
}

test("EMINDIA worker canonicalizes all 13 current public occurrences", async (t) => {
  const live = await livePage();
  const result = await executeWorker(live.markup);
  assert.ifError(result.error);
  assert.deepEqual(result.requests, [sourceURL]);
  assert.equal(result.records.length, 13);
  assert.equal(
    result.records.filter((record) => record.time_precision === "timed").length,
    9,
  );
  assert.equal(
    result.records.filter((record) => record.time_precision === "date").length,
    4,
  );
  assert.equal(
    result.records.some((record) => /WECAN|invitation/i.test(record.title)),
    false,
  );
  t.diagnostic(
    "official pages: 1; public occurrences: 13; excluded restricted rows: 1",
  );

  const expected = new Map(
    live.expected.map((occurrence) => [
      `${occurrence.title}\u001f${occurrence.startsAt ?? occurrence.date}`,
      occurrence,
    ]),
  );
  assert.equal(
    expected.size,
    13,
    "source fallback inputs must be collision-free",
  );
  for (const record of result.records) {
    assert.deepEqual(Object.keys(record).sort(), expectedKeys);
    const occurrence = expected.get(
      `${record.title}\u001f${record.starts_at ?? record.start_date}`,
    );
    assert.ok(
      occurrence,
      "worker emitted a row absent from the official schedule",
    );
    assert.equal(record.schema_version, "event-occurrence/v1");
    assert.equal(record.source_event_id, null);
    assert.equal(record.source_url, sourceURL);
    assert.equal(record.source_host, "www.galaxyregistration.com");
    assert.equal(record.city_slug, "varanasi");
    assert.equal(record.category, "other");
    assert.equal(record.start_date, occurrence.date);
    assert.equal(record.starts_at, occurrence.startsAt);
    assert.equal(record.end_date, occurrence.date);
    assert.equal(record.ends_at, occurrence.endsAt);
    assert.equal(record.time_precision, occurrence.precision);
    assert.equal(record.timezone, "Asia/Kolkata");
    assert.equal(record.venue_name, "BHU Varanasi");
    assert.equal(record.venue_address, null);
    assert.equal(record.is_free, false);
    assert.equal(record.price_min_minor, null);
    assert.equal(record.price_max_minor, null);
    assert.equal(record.currency, null);
    assert.equal(record.registration_url, sourceURL);
    assert.equal(record.registration_state, null);
    assert.equal(record.status, "scheduled");
    assert.deepEqual(record.language, []);
    assert.equal(record.age_note, null);
    assert.equal(record.accessibility_note, null);
    assert.equal(record.image_url, null);
    assert.equal(record.observed_at, observedAt);
  }
});

test("EMINDIA schedule, eligibility, and fee drift fail before collection", async () => {
  const live = await livePage();
  const mutations = [
    ["By invitation only.", "Registration open.", /invitation-only marker/],
    [
      'class="table table-bordered text-center"',
      'class="table text-center"',
      /schedule table signature/,
    ],
    [
      "General registration fees apply for both activities.",
      "Free entry for both activities.",
      /fee evidence/,
    ],
    [
      "10th September 2026 (Thursday) 1400-1900 Hours",
      "10th September 2026 (Thursday) 0800-1300 Hours",
      /disagree or overlap/,
    ],
  ];
  for (const [search, replacement, error] of mutations) {
    assert.ok(
      live.markup.includes(search),
      `live mutation target missing: ${search}`,
    );
    const result = await executeWorker(
      live.markup.replace(search, replacement),
    );
    assert.match(String(result.error), error);
    assert.deepEqual(result.records, []);
  }
});

test("EMINDIA validates the full page before applying the 90-day horizon", async () => {
  const live = await livePage();
  const afterWorkshops = await executeWorker(live.markup, {
    creationTime: "2026-09-10T18:30:00.000Z",
  });
  assert.ifError(afterWorkshops.error);
  assert.equal(afterWorkshops.records.length, 4);
  assert.ok(
    afterWorkshops.records.every((record) => record.time_precision === "date"),
  );

  const brokenPastRow = await executeWorker(
    live.markup.replace(
      "9th September 2026 (Wednesday)",
      "31st February 2026 (Wednesday)",
    ),
    { creationTime: "2026-09-10T18:30:00.000Z" },
  );
  assert.match(String(brokenPastRow.error), /impossible calendar date/);
  assert.deepEqual(brokenPastRow.records, []);

  const expired = await executeWorker(live.markup, {
    creationTime: "2026-12-01T00:00:00.000Z",
  });
  assert.match(String(expired.error), /current occurrence count/);
  assert.deepEqual(expired.records, []);
});

test("EMINDIA input boundary is exact and the save probe is deterministic", async () => {
  const live = await livePage();
  const saveProbe = await executeWorker(live.markup, { inputURL: undefined });
  assert.ifError(saveProbe.error);
  assert.deepEqual(saveProbe.requests, [sourceURL]);

  for (const inputURL of [
    null,
    {},
    42,
    "",
    `${sourceURL}?page=1`,
    "https://www.galaxyregistration.com:443/event/skill-school/",
    "https://galaxyregistration.com/event/skill-school/",
  ]) {
    const result = await executeWorker(live.markup, { inputURL });
    assert.match(
      String(result.error),
      /one URL string|valid URL|bare reviewed registration URL/,
    );
    assert.deepEqual(result.requests, []);
    assert.deepEqual(result.records, []);
  }
});

test("EMINDIA worker avoids Scraper Studio's reserved line identifier", async () => {
  const code = await readFile(workerURL, "utf8");
  assert.doesNotMatch(code, /\bline\b/);
});
