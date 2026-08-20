# The Piano Man Delhi evidence

The read-only proof on 20 August 2026 recorded only public diagnostics:

- official entry: `https://www.thepianoman.in/event/list`;
- transport: 13 public `GET /event/list/{boundary}` JSON requests;
- inclusive horizon: 20 August through 18 November 2026;
- observed cross-venue/Delhi/public-ticketed cards: `106/69/67`;
- excluded Delhi closures: `2` exact private `Venue Closed` rows;
- Delhi venue IDs: `1` Safdarjung and `2` Eldeco Centre, Saket;
- outside-city venue ID: `3` Gurugram, validated and filtered;
- current published range: 20 August through 29 September;
- browser actions, authentication, detail fan-out, retries: `0`.

The fixed `2026-08-20T00:00:00.000Z` canonical preview contained 67 rows with
SHA-256 `6833931e733cbb184dadc2022bc93417a8e5bfcac3da517e30f1f29cee2d3268`.

The focused live harness records each response byte length and SHA-256 at test
time because the event board is mutable. Raw HTML/JSON, cookies, tokens, and
account data are not tracked. No Bright collector has been created, edited,
previewed, saved, promoted, or run for this source.
