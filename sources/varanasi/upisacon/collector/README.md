# UPISACON Browser-worker operator checklist

No Bright Data collector has been created for this source. The reviewed local
slice is intentionally limited to one Browser-worker stage:

- `worker.js`: interaction, source boundary, mapping, horizon, schema, and
  atomic collection gates;
- `parser.js`: rendered-DOM extraction for Scraper Studio's parser editor;
- `output-schema.json`: the 27-field Scraper Studio presentation schema;
- authoritative validation: `../../../../contracts/collector-output.schema.json`.

## Exact project contract

Input:

```json
{
  "url": "https://upisaconvaranasi2026.com/workshops"
}
```

Worker settings:

- Browser worker, one stage;
- interaction code from `worker.js`;
- parser code from `parser.js`;
- exactly one `navigate()` using `networkidle0` and a 30-second timeout;
- no `request()`, explicit wait, click, scroll, load-more, traffic capture,
  retry, heal, rerun, or fan-out;
- exact 27-field output schema from `output-schema.json`.

The undefined URL compatibility path exists only for Scraper Studio's save
probe and resolves to the compiled canonical URL. Every explicit production
input must equal the manifest input, and backend transport validation must
reject a missing or different input.

## Local gates

Install the pinned live-test dependencies once from `baahar/tests/live/`. On a
machine without a compatible cached Chromium, install the pinned browser too:

```text
npm install
npm run install:browser
npm run test:upisacon
```

The test suite performs the worker/parser syntax checks. It also honors
`BAAHAR_BROWSER_EXECUTABLE` when a reviewed system Chromium or Edge binary must
be used instead of Playwright's installed browser.

The live harness proves the raw shell cannot satisfy the source, loads the
rendered page once, applies the exact parser and worker, validates all seven
records with the authoritative Go Draft 2020-12 validator, and exercises
structural, semantic, input, identity, and horizon mutations.

## Review boundary before Bright Data

1. Independently review the manifest, mapping, interaction code, parser code,
   schema, and live-test output.
2. Create exactly one custom Browser-worker collector with generation retries
   disabled. Do not create a duplicate or invoke self-healing.
3. Replace generated code and schema with the reviewed artifacts. Keep one
   stage and one canonical input.
4. Run one explicit preview. Require one page load, seven collect calls, seven
   exact 27-field rows, no error, and no interaction or fan-out.
5. Stop without saving on any input, URL, DOM, count, null, schema, request, or
   identity drift.
6. Only after preview and save-probe review may the version be saved to
   production. One explicit async batch is a separate authorization.
