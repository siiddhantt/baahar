# Baahar checkpoint status

Last updated: 18 August 2026

## Completed baseline

Complete one real BIC vertical slice:

```text
custom Scraper Studio collector
  -> immutable exact output
  -> contract validation
  -> deterministic normalization/publication
  -> PostgreSQL API
  -> responsive Bengaluru feed/detail/save/ICS journey
```

## Active checkpoint

Checkpoint 3 — choose one Varanasi source and repeat the proven vertical slice.
The BIC baseline is frozen: Bright Data -> MinIO -> PostgreSQL -> API -> browser
has passed, so expansion is unlocked for one source only.

## Work lanes

| Lane | Ownership | Scope |
| --- | --- | --- |
| Integration/contracts | primary maintainer | repository policy, OpenAPI/JSON Schema, cross-lane review and gates |
| Backend/domain | backend lane | Go domain, PostgreSQL/MinIO, jobs, HTTP implementation |
| Experience/web | frontend lane | React/Vite design system and public BIC journey |
| Bright Data/source | source lane | BIC manifest, custom collector, real run evidence and mapping |

Each lane has exclusive file ownership during parallel work. Contract changes are
announced to every consumer before implementation continues.

## Frozen decisions

- Working brand: Baahar.
- P0 cities: Bengaluru and Varanasi.
- Current source: BIC only. No second collector until this slice passes.
- React/Vite frontend; Go modular monolith; PostgreSQL; S3-compatible artifacts.
- Scheduled shared collection; no visitor-triggered scraping.
- No runtime LLM, accounts, maps, notifications, native app, Redis or services.
- OpenAPI 3.1 and Draft 2020-12 schemas are authoritative.
- Missing facts remain unknown; unhealthy runs cannot replace verified data.
- Self-heal remains human-reviewed and preserves the Collector ID.

## Foundation gate

- [x] Product, architecture, experience, source and execution plans reviewed.
- [x] Collector and normalized-event schemas validate.
- [x] OpenAPI 3.1 validates.
- [x] Clean file boundaries, ignore rules and contribution policy exist.
- [x] Fresh local PostgreSQL/MinIO starts; exact-byte storage and migrations
  pass up/down/up against the real services.
- [x] Go format/vet/test pass, including focused worker state-machine tests.
- [x] Web format/lint/typecheck/test/build pass; nine focused test files,
  18 tests and the 88.91 KB gzip initial JavaScript bundle were independently
  verified.
- [x] Generated API types match the frozen OpenAPI.
- [x] Secret/binary scan is clean; private raw source evidence remains ignored.

## BIC vertical-slice gate

- [x] Real custom Scraper Studio Collector ID `c_msyr5ts21rq3nfjxrz` verified;
  its empty first run and two contract-breaking heal previews were rejected.
  The reviewed same-ID Code worker and canonical output schema are now saved to
  production; its 17-row production-save preview matched the official source.
- [x] Exact live output stored privately: batch `j_msyu2o7z68pe5hlgs`, 17
  rows, 20,687 bytes, SHA-256
  `7e65fd62acf239bf146762cae5883be764f3b92fd14eae456f92dcd9199cb566`.
  Bright's per-row `input` transport metadata is quarantined at the raw
  contract boundary; all 27 collector fields are present.
- [x] The worker stores the immutable raw object, verifies Bright's `input`
  envelope against the reviewed collection input, and validates the derived
  27-field view without committing a private live-data fixture.
- [x] The live worker published 17/17 rows with zero quarantine; idempotent
  replay reused the exact artifact without a second Bright call or additional
  versions. Rejected, stale, and out-of-order candidates cannot publish.
- [x] City, feed, detail, change, source-summary, and ICS endpoints return the
  OpenAPI shapes against the real PostgreSQL data.
- [x] The live first-time chooser, today/tomorrow/weekend feeds, every category,
  multi-select, free/empty/reset, detail/source, save/Saved, share, ICS link,
  unavailable Varanasi, and missing-event recovery journeys pass in-browser.
- [x] Light/dark, keyboard focus, reduced-motion, and 320/390/1440/2560
  responsive checks pass without horizontal overflow.
- [x] Production build passes; initial JavaScript is 88.91 KB gzip and the
  production npm dependency audit reports zero vulnerabilities.

## Expansion lock

Only one Varanasi source may enter implementation next. A second source remains
blocked until that source passes the same artifact, publication, API, browser,
and failure-isolation gates. Scope changes require updating the PRD/plan and
recording why the current slice cannot satisfy the product objective.

## Known P0 release blocker outside the current slice

The protected operator web view is not implemented. Its API contract and backend
work do not make the operator journey complete; it remains a P0 release blocker,
intentionally excluded from the current public BIC frontend remediation.
