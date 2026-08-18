# Rudraksh Scraper Studio worker

This directory contains the latest reviewed Code-worker interaction code for
`c_msyvmnoxwjdg7xe0p`. Production v1 was saved before the tracked diagnostic
`country('in')` line was added. That development-only routing preview failed and
was not saved, so the source is frozen as a blocked preview.

## Proposed collector contract

Input schema:

```json
{
  "url": "https://www.rudrakshcentre.com/upcoming-event"
}
```

Production input must contain only the exact bare URL above. Scraper Studio's
separate save probe omits `input.url`, so `undefined` alone compiles to that
same constant URL. Null, non-string, and every supplied wrong URL fail before
the request. The production trigger still supplies the explicit input, and the
backend rejects a missing or different transport envelope.

The worker makes one request, uses `load_html()` to parse the response with
Cheerio, selects one four-column table, validates all rows before emitting
anything, and collects 1..50 `event-occurrence/v1` records with the exact
27-field shape. Immediately before that request it calls `country('in')` once;
there is no fallback route or in-worker retry.

Run the local gates from `baahar/` before any collector is created:

```text
node --check sources/varanasi/rudraksh/collector/worker.js
node --test tests/live/rudraksh-worker.test.mjs
```

The live harness compares output to the visible official table, proves HTML
comments do not become records, exercises same-date and duplicate identity
behaviour, verifies the input/date/cell fail-closed boundaries, and requires
exactly one India routing call before exactly one canonical request.

No further preview, save, or batch is approved for this source. The immutable
failed production artifact and development routing diagnostic are recorded in
`../evidence/README.md`.
