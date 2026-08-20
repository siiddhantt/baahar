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
At `2026-08-20T15:01:00.000Z`, after the three remaining same-day rows crossed
their seating-time boundary, the exact 64-row canonical SHA-256 was
`11549d234c0486aec8c92ee921cf500c9a54547fff98860e2bc4a24a4572b04d`.

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

The private envelope is ignored at `../private/create-envelope.json`. No second
collector create, create retry, or heal occurred.

## Studio install and Development proof

The generated template was inspected only after the create gate. It contained
an unnecessary Browser list stage followed by a single-event Code detail stage;
that topology was rejected. The Browser stage was deleted, leaving exactly one
Code stage, an empty parser, one canonical input, the tracked worker, and the
shared 27-field schema.

- final tracked/Studio worker SHA-256:
  `1ac504b03ad55a825d00cbb75650e6264cc358bf6d78efc7a2fdbe1373a308f9`;
- shared Studio schema SHA-256:
  `4a9c2a71d510806fcd2495c2120d6ee523375ce974d74df2a8fb88027c7ea71d`;
- first explicit preview: `preview_mt1tb0yxc1kh0ou1u`, atomically zero
  output after an official future window returned `html: ""` and Studio
  rejected `load_html("")`;
- correction: preserve every JSON size, key, cursor, count, and record gate,
  while treating an empty official HTML fragment as a cursor-validated
  zero-card window without calling `load_html`;
- accepted explicit preview: `preview_mt1tess1h6wc5ga2t`, 64 rows, 13 bounded
  weekly requests, one input, and no errors;
- Development save preview: 64 rows and no errors; Studio did not expose a
  separate save-preview ID after redirect.

The sponsor-native Development CLI run returned response
`d2t1787248590201rrhomm0aiu8o`. Its ignored dataset at
`../private/development-20260820/cli-dev-run.json` is 67,351 bytes with SHA-256
`3cf7025612a31297344bc852167f328f8b96ec5433bb29e80ad9e9aa63896c81`.
It contains 64 uniform 28-key transport rows: the exact 27 canonical fields
plus Bright's exact one-member `input` envelope. All 64 native IDs are unique,
all rows share `observed_at: 2026-08-20T17:56:30.193Z`, and the category split
is music 48, other 13, arts 2, theatre 1. Removing only `input` passes the real
Go contract, and normalizing only `observed_at` produces field-for-field equality
with the independently executed late-day worker when compared by native ID.

## Production proof

The exact saved Development revision was promoted once after another 64-row,
zero-error save preview. The one Production CLI run returned response
`d2t1787248990622rsb44hdhct0g`; no retry was issued. Its ignored dataset at
`../private/production-20260820/dataset.json` is 67,351 bytes with SHA-256
`a088ff940d1e806002b64eee79ca65ed586c11aeda825fea6bc9337eb10a5b4a`.
It contains the same 64 unique native IDs and category split, exact canonical
input envelopes, and uniform `observed_at: 2026-08-20T18:03:10.616Z`. Removing
only `input` passes the authoritative Go schema and the field-for-field native-ID
comparison. Bright's dataset transport order is not treated as identity or
chronology.

No backend source, immutable Baahar replay, public Delhi city, frontend route,
or browser acceptance is claimed. Those remain separate activation gates.
