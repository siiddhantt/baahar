# BHU Academic Events collector

This is a single-stage Code worker. It makes exactly one POST to
`https://www.bhu.ac.in/Homepage/GetAcademicEvents` with the reviewed JSON
content type and byte-exact body, then maps the complete response. It does not
navigate, parse a DOM, use cookies, fan out, or download brochures.

The reviewed worker and authoritative 27-field schema are saved to Production
on collector `c_mszvpbm220j1pld0pe`. Its Workshops taxonomy revision passed a
complete 10-row development run and Production save, then the application
published 10/10 records with zero quarantine. The live source now exposes four
workshops, four talks, and two other events.

Use [`baahar/contracts/scraper-studio-output-schema.json`](../../../../contracts/scraper-studio-output-schema.json)
as the Scraper Studio output schema. It is the authoritative 27-field vendor
schema; this source deliberately does not keep a drifting copy.

## Operator gate

1. Create at most one Code-worker collector for the exact manifest URL.
2. Replace generated interaction code with `worker.js`; keep one Code stage,
   an empty parser, and one canonical input.
3. Verify one POST with the exact URL, content type, and body; no navigation or
   fan-out; and a complete all-or-zero result.
4. Require 3..20 canonical rows, unique native IDs, strict `OpenTo=All`,
   source-explicit Varanasi, and the current 90-day window.
5. Reject wrapper fields, missing nulls, or any key set other than the exact
   authoritative 27 fields. Preview is not publication.
6. Only after reviewed preview and production save may one explicit async
   batch be authorized. Preserve trigger and dataset bytes before validation.

An undefined input URL is accepted only for Scraper Studio's internal save
probe and compiles to the same exact manifest URL. Every present value must
equal the canonical URL byte-for-byte.
