# BIEC collector

This local-only collector is one single-stage Code worker. It requests the
official calendar once, maps only the year tabs intersecting the current 90-day
horizon, and emits exact ongoing or upcoming occurrences.

Use [`baahar/contracts/scraper-studio-output-schema.json`](../../../../contracts/scraper-studio-output-schema.json)
as the Scraper Studio presentation schema. This source keeps no copy.

## Pre-Bright gate

1. Use exactly one Code stage with `worker.js`, an empty parser, screenshots off,
   and one canonical input.
2. Require one request, one HTML parse, zero navigation, interaction, pagination,
   fan-out, detail request, retry, or LLM call.
3. Parse exact date/time for every card in each intersecting-year container.
   Fully validate only ongoing/in-horizon rows and reject an overlapping public-
   DOM card that escapes those containers.
4. Require exactly nine rows in the 20 August live proof, retain Franchise India
   during its first day, drop it after its exact end, and require unique official
   detail paths/fallback identities plus the shared exact 27-field schema.
5. Preserve unknown registration, price, free, audience, and accessibility facts
   as null/empty; do not copy descriptions or infer categories.
6. Keep collector creation, preview, production proof, and backend registration
   as separate authorization gates. Production proof and backend registration
   are complete and recorded independently.

An undefined input URL is accepted only for Scraper Studio's internal save probe
and compiles to the exact constant. Every present input must match byte-for-byte.

## Reviewed production proof

Collector `c_mt199f5m1k5i18ud1i` uses the exact tracked one-stage Code worker and
shared 27-field schema in Production. Its single authorized asynchronous batch,
`j_mt1d7c531xivuenyfs`, returned nine exact records in 9,282 immutable bytes
(SHA-256 `c464b808bf76458f0691b76e775bb5435fe276becb40808afb53653dcded9d0d`).
The transport input envelope, global schema, source hosts, event facts, ordering,
and fallback identities all passed. The manifest is now `active` / `verified`:
the independent application activation published 9/9 with zero quarantine,
then replayed the same immutable object without another Bright call or any
occurrence, version, change, or raw-object duplication.

The controlled repair ledger in `../evidence/README.md` records both a rejected
broader proposal and the completed same-ID Version 4 repair, protected 9/9/0
application run, and immutable no-Bright replay. Never approve a repair merely
because it reaches the approval gate: require the exact tracked selector,
complete output, schema, semantic, request-budget, Production, application, and
replay gates first.
