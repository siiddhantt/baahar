# Atta Galatta collector

This reviewed collector is one single-stage Code worker. It requests the
official JSON once, validates the complete archive transport, and emits only the
current 90-day occurrence set through the shared 27-field contract.

Use [`baahar/contracts/scraper-studio-output-schema.json`](../../../../contracts/scraper-studio-output-schema.json)
as the Scraper Studio presentation schema. This source keeps no copy. Collector
`c_mt006uf51wdkssg1lh` has one reviewed Production Code stage. Its single
production batch `j_mt16pm6j4ksns94ig` passed the exact transport, schema,
identity, and semantic gates with 42 rows. The manifest expresses the reviewed
active configuration. The protected Baahar activation and immutable replay
published the same 42 reviewed occurrences with zero quarantine.

## Operator gate

1. Reuse only `c_mt006uf51wdkssg1lh`; never create or heal a replacement.
2. Install `worker.js`; keep one Code stage, empty parser, one canonical input,
   one request, and no navigation, pagination, fan-out, or retry.
3. Require the full bounded source array and exact current 3..100 horizon before
   collection; reject any eligible duplicate EVT ID.
4. Preview must retain exact 27 keys and explicit nulls, official detail/images,
   and zero descriptions or inferred venue/price/free/registration facts.
5. Source subtitle/host must remain under review rather than silently changing
   categories or organizer semantics.
6. Preview and a valid raw batch are not application publication. Backend
   registration and ingest require a separate authorization and gate.

An undefined input URL is accepted only for Scraper Studio's internal save probe
and compiles to the exact constant. Every present input must match byte-for-byte.
