# India Habitat Centre collector

This is the reviewed local one-stage Code worker for the official current-month
IHC programme list. Development collector `c_mt1gyvqb8ftcpex5b` exists, but its
generated template has not been accepted or changed and nothing has been
previewed, saved, promoted, run, registered, or published.

## Pre-Bright gate

1. Use one Code stage with `worker.js` and the shared
   `contracts/scraper-studio-output-schema.json` presentation schema.
2. Supply exactly `https://indiahabitat.org/Events` as the sole `url` input.
3. Require one request, one HTML parse, zero browser navigation/action/fan-out,
   zero pagination, zero detail request, and no retry or AI transform.
4. On the 20 August proof, require the exact 20 official IDs and facts in the
   live test, plus unique identities and the authoritative 27-field schema.
5. Preserve unknown admission, registration, price, free state, language, age,
   and accessibility values as null/empty.
6. Reject source/month/type/venue/URL/image/pagination drift atomically.
7. Stop after the local gate. Generated-template inspection, worker/schema
   replacement, preview, save, production, batch, backend registration, Delhi
   enablement, API and browser work all require separate authorization.

Run from `baahar/`:

```text
node --check sources/delhi/india-habitat-centre/collector/worker.js
node --test tests/live/india-habitat-centre-worker.test.mjs
go test ./internal/sources
```

The current-month surface does not provide complete 90-day inventory. The
worker must never claim otherwise or synthesize unpublished future months.
