# The Piano Man Delhi collector

This is a local-only, source-scoped Code worker for the official rolling Delhi
event board. It has no Bright or backend resource.

## Independent gate

1. Use one Code stage with `worker.js` and the shared 27-field staging schema.
2. Supply exactly `https://www.thepianoman.in/event/list` as the single input.
3. Require exactly 13 weekly JSON requests and 13 HTML-fragment parses, with no
   Browser action, login, POST, detail fan-out, retry, healing, or AI transform.
4. Require complete today-through-day-90 coverage, exact seven-day cursors,
   unique decoded numeric IDs, and the two reviewed Delhi venue pairs.
5. Exclude only exact `Private Event` / `Venue Closed` / `NON-TICKETED` rows.
6. Keep seating time as a filter fact only; emit date precision and no inferred
   start/end time.
7. Fail atomically on source, shape, identity, venue, category, price, URL,
   image, horizon, request, duplicate, or schema drift.
8. Stop after local verification. Bright create/preview/save/production, backend
   registration, Delhi enablement, and browser acceptance are separate gates.

Run from `baahar/`:

```text
node --check sources/delhi/the-piano-man/collector/worker.js
node --test tests/live/the-piano-man-worker.test.mjs
go test ./internal/sources
```
