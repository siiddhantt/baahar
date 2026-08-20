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
account data are not tracked. At that local gate, no Bright collector action
had occurred; the separately authorized development-create result follows.

## Bright Data development-create gate

On 20 August 2026, exactly one authenticated development collector create used
official `@brightdata/cli` 0.3.5 with `--no-retry`, the exact manifest input,
and the tracked 494-character prompt. The existing token was mapped to
`BRIGHTDATA_API_KEY` for that process only and was neither printed nor persisted
by the command.

- collector ID: `c_mt1rkddl1dmh5iiok6`;
- name: `baahar-the-piano-man`;
- terminal status: `done` after 194 polls;
- created: `2026-08-20T16:57:44.121Z`;
- completed generation steps: `9`;
- view: `https://brightdata.com/cp/scrapers/c_mt1rkddl1dmh5iiok6`;
- private immutable create envelope: `387` bytes;
- envelope SHA-256:
  `265bf714ca829a8fff261aa4dfd49be52abf5bb535e437fad612133f3acaef86`;
- create-envelope error: absent.

The private envelope is ignored at `../private/create-envelope.json`. The
generated template remains uninspected and untrusted. No second create, retry,
heal, generated-template edit, explicit preview, save, run, production
promotion, backend registration, Delhi enablement, or frontend change occurred.
The collector is frozen for a separate install-and-preview authorization gate.
