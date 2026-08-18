# Jagriti Theatre Scraper Studio worker

This directory contains the reviewed Code worker for Bright Data collector
`c_msywx7up19xi1xi8v`. Its exact code, one canonical input, empty parser, and
27-field vendor schema were saved to Production only after the 7-page,
11-record preview and save probe passed.

## Proposed contract

Input:

```json
{
  "url": "https://www.jagrititheatre.com/jagriti-events-collections"
}
```

The worker requests the exact official list, validates 1..25 bounded internal
detail links, then requests each detail once in visible order. It cross-checks
the list and detail metadata and builds all 1..50 timed occurrences before
collecting the exact 27-field `event-occurrence/v1` records. It has no browser
interaction, alternate route, arbitrary crawl, fallback source, or request
retry.

`example-output.json` is a reviewed real 27-field row. `output-schema.json`
records the manually reviewed vendor presentation schema, including explicit
nullable defaults that Scraper Studio cannot infer from null examples. The
authoritative validation contract remains `contracts/collector-output.schema.json`.

Local review gates from `baahar/`:

```text
node --check sources/bengaluru/jagriti/collector/worker.js
node --test tests/live/jagriti-worker.test.mjs
```

The explicit production batch, backend publication, and replay proof are
recorded in `../evidence/README.md`. The source is active after the separate
publication and mixed-source browser gates passed.
