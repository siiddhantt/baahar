# The Piano Man Delhi collector

This is the reviewed source-scoped Code worker for the official rolling Delhi
event board. Collector `c_mt1rkddl1dmh5iiok6` now runs this exact one-stage
worker and shared schema in Production. Its backend source is active and Delhi
is exposed by Baahar's production API and city selector.

## Independent gate

1. Use one Code stage with `worker.js` and the shared 27-field staging schema.
2. Supply exactly `https://www.thepianoman.in/event/list` as the single input.
3. Require exactly 13 weekly JSON requests and parse only non-empty official
   HTML fragments; empty future windows remain cursor-validated zero-card
   responses. Allow no Browser action, login, POST, detail fan-out, retry,
   healing, or model transform.
4. Require complete today-through-day-90 coverage, exact seven-day cursors,
   unique decoded numeric IDs, and the two reviewed Delhi venue pairs.
5. Exclude only exact `Private Event` / `Venue Closed` / `NON-TICKETED` rows.
6. Keep seating time as a filter fact only; emit date precision and no inferred
   start/end time.
7. Fail atomically on source, shape, identity, venue, category, price, URL,
   image, horizon, request, duplicate, or schema drift.
8. Keep the verified Studio revision byte-equal to `worker.js`. The guarded
   production activation, immutable replay, Delhi API, and browser acceptance
   are recorded in `../evidence/README.md`.

Run from `baahar/`:

```text
node --check sources/delhi/the-piano-man/collector/worker.js
node --test tests/live/the-piano-man-worker.test.mjs
go test ./internal/sources
```
