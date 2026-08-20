# Baahar checkpoint status

Last updated: 21 August 2026

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

Checkpoint 4 — the second-city source loop is active. BIC and Jagriti pass
Bright Data -> MinIO -> PostgreSQL -> API -> browser independently. The one-off
UPISACON slice is closed as optional evidence rather than a coverage pillar.
BHU Academic Events now passes Bright Data -> MinIO -> PostgreSQL -> API: its
activation published 10/10 records with zero quarantine and enabled Varanasi.
Its two-city browser journey and responsive public UI also pass. Atta Galatta's
one-stage Code worker now passes local review, a 42-row Production preview, and
one immutable 42-row production batch. Its protected Baahar activation then
published 42/42 records with zero quarantine; immutable replay and public
feed/detail/ICS/source-summary checks pass. Its public browser acceptance is the
last completed gate: image cards, detail, save, Back, and responsive journeys
all pass. BIEC's one-stage collector, immutable application publication/replay,
public API, and browser gates now pass with 9/9 accepted and zero quarantine.
Bengaluru has four healthy official sources. Delhi and Mumbai now complete the
same end-to-end path: The Piano Man published 64/64/0 and Prithvi Theatre
published 49/49/0, both immutable objects were independently rehashed and
replayed without a Bright call, and the public API plus deployed four-city UI
pass. Production now exposes 205 visible occurrences across seven active
official sources and four cities. The active P0 product gap is source breadth
in Varanasi, Delhi, and Mumbai, not city plumbing.

India Habitat Centre remains a reviewed Delhi candidate only. Its local
one-request contract passes with 20 unique rows, but its generated Studio
collector still contains an unreviewed second stage and is not a production or
backend source.

## Release sequence and scope guard

The next work is sequenced by release risk, not by the number of possible pages
or features discovered.

### P0 — finish before widening

- [x] Complete BIEC through one reviewed Studio preview, one production artifact,
      immutable publication/replay, API, and browser acceptance.
- [ ] Raise Varanasi from BHU's one healthy source to the three-source launch
      floor through two independently useful official sources, one complete
      vertical slice at a time. If that cannot be done safely, narrow the public
      release claim instead of padding it with aggregators or one-off events.
- [x] Complete and record a successful same-Collector-ID, human-reviewed
      self-heal proof. BIEC failed atomically under a controlled Development
      selector drift, retained its last-known-good public feed, restored the
      exact reviewed worker as Production Version 4, published 9/9/0 through
      one fenced application run, and replayed the same immutable object with
      no second Bright call.
- [x] Re-run the production browser journeys for native share/clipboard fallback,
      real ICS download, device-local saves, detail/Back/filter state, loading,
      empty and error states, keyboard, reduced motion, and target viewports.
- [x] Deploy the Vercel frontend and reboot-safe Raspberry Pi API, worker,
      PostgreSQL, MinIO, and Tailscale Funnel; apply guarded migrations and
      verify immutable activation/replay on the production stack.
- [ ] Finish the release evidence, security, performance, and demo gates before
      feature freeze.

### P1 — only after the P0 gates

- Tighten the existing source-backed visual story and change-awareness states as
  the release wow factor, without adding a new data or identity system.
- Qualify one additional source slice at a time from the reviewed research queue.
- Consider public feeds, PWA/digest, or other bounded enhancements only when the
  active cities remain healthy.

### P2 — not first-release work

- Cross-device saves/accounts, Clerk or another identity provider,
  maps/geocoding/distance ordering, precise location, Redis, search
  infrastructure, or a generic crawler platform.

### Supported-city release floor

| City      | Healthy official sources | Release floor | Current decision                                       |
| --------- | -----------------------: | ------------: | ------------------------------------------------------ |
| Bengaluru |                        4 |             3 | Floor met with BIEC as the active fourth source.       |
| Varanasi  |                        1 |             3 | Enabled; broader coverage floor is not met.            |
| Delhi     |                        1 |             3 | Enabled with verified Piano Man sample coverage.       |
| Mumbai    |                        1 |             3 | Enabled with verified Prithvi Theatre sample coverage. |

Search, forums, AllEvents, BookMyShow, and social pages may produce leads. They
do not replace first-party authority or the full source-onboarding gate. A
collector handles pagination only when the reviewed official surface proves it;
pagination is not pre-built into a generic scraping abstraction.

## BIEC post-local acceptance gate

### Studio development preview

- [x] The same collector `c_mt199f5m1k5i18ud1i` has exactly one Code stage, the
      tracked worker, an empty parser, screenshots off, and only the exact
      `https://www.biec.in/events` input.
- [x] One preview performs one physical request/page with no navigation,
      pagination, detail fan-out, retry, failed crawl, or partial output.
- [x] The complete downloaded output contains the exact 27 canonical fields and
      nine ordered, unique records at the 20 August observation boundary; all
      nine pass the authoritative Go schema and source semantic gates. The
      canonical record SHA-256 is
      `a86c9104fd86bc42e45edafe84b8510227d6ea7b642b01b597dc5d7cdb2285f2`.
- [x] Preview ID, timestamps, request/page/row counts, errors, and exact output
      evidence are recorded before production save.

### Production artifact

- [x] Save the reviewed development version to production once without changing
      Collector ID, worker, input, stage shape, or output schema.
- [x] Trigger one explicit asynchronous production collection and require a
      successful terminal state, nine records, zero failed crawls, and the same
      semantic output as the accepted preview.
- [x] Preserve the exact returned bytes before transformation and record their
      byte count, SHA-256, collection ID, template/version, and timestamps. A
      save-preview or manually copied dashboard result is not the artifact.

### Backend and public acceptance

- [x] Register BIEC from the reviewed manifest with exact city, collector, hosts,
      input, cadence, freshness, page/record budgets, identity, and health policy.
- [x] Publish the immutable artifact as 9/9 accepted and zero quarantined; replay
      the same artifact without another Bright call and create no duplicate
      occurrence, version, change, or raw object.
- [x] Prove an empty, malformed, duplicate, wrong-host, or out-of-order candidate
      cannot move BIEC's last verified public version or healthy timestamp.
- [x] At one shared 20 August `as_of`, Bengaluru exposes BIEC's nine chronological
      `Other` occurrences, four source summaries, correct details/images/official
      links, unique cursor pages, and valid ICS; after an occurrence ends, the
      time-window rule removes it naturally rather than changing its status.
- [x] Browser acceptance passes image and missing-image cards, equal card rhythm,
      detail, Save/Saved, Share, Add to calendar, Back, filter/cursor state, both
      themes, keyboard/reduced-motion, and 320/390/1440/2560 widths.

## Work lanes

| Lane                  | Ownership          | Scope                                                               |
| --------------------- | ------------------ | ------------------------------------------------------------------- |
| Integration/contracts | primary maintainer | repository policy, OpenAPI/JSON Schema, cross-lane review and gates |
| Backend/domain        | backend lane       | Go domain, PostgreSQL/MinIO, jobs, HTTP implementation              |
| Experience/web        | frontend lane      | React/Vite design system and mixed-source public journey            |
| Bright Data/source    | source lane        | source manifests, custom collectors, real run evidence and mapping  |

Each lane has exclusive file ownership during parallel work. Contract changes are
announced to every consumer before implementation continues.

## Frozen decisions

- Working brand: Baahar.
- Production cities: Bengaluru, Delhi, Mumbai, and Varanasi.
- Active sources: BIC, Jagriti Theatre, Atta Galatta, and BIEC in Bengaluru;
  The Piano Man in Delhi; Prithvi Theatre in Mumbai; and BHU Academic Events in
  Varanasi.
- Consumer categories: Arts, Talks, Workshops, Theatre, Music, Books,
  Community, and Other. Source-specific mappings require explicit source facts.
  Migration 7 and the current API accept the Workshops filter. Two incomplete
  same-ID BHU Self-Healing proposals were rejected; the exact tracked
  classifier then passed a full 10-row development proof and Production save.
  The protected application run published `4 workshops / 4 talks / 2 other`
  with zero quarantine, and the live Workshops feed/detail journey passes.
  BIC's revised Workshops mapping still requires its separate full Studio
  preview and Production save before that source is republished.
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
- [x] Web format/lint/typecheck/test/build pass; 33 focused tests and the
      89.28 KB gzip initial JavaScript bundle were independently verified.
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
- [x] The live first-time chooser, Upcoming/today/tomorrow/weekend feeds, every
      category, multi-select, free/empty/reset, explicit Load more,
      detail/source, save/Saved, share, ICS link, unavailable Varanasi, and
      missing-event recovery journeys pass in-browser.
- [x] Light/dark, keyboard focus, reduced-motion, and 320/390/1440/2560
      responsive checks pass without horizontal overflow.
- [x] Production build passes; initial JavaScript is 89.27 KB gzip and the
      production npm dependency audit reports zero vulnerabilities.

## Jagriti vertical-slice gate

- [x] Reviewed Code worker follows one bounded listing plus six official detail
      pages and preserves four distinct showtimes for the same production.
- [x] Real worker collection `j_msyy3wx41ejhhxe9v5` stored 13,875 immutable
      bytes with SHA-256
      `3606173cea40b8f1d77ea315b98b6040e8e05b3c154791202f1d6ac10c85c0ba`.
- [x] The worker published 11/11 records with zero quarantine, 11 occurrences,
      11 versions, and zero invented changes.
- [x] Idempotent replay reused the exact object and created no Bright Data
      collection, occurrence, version, or change.
- [x] Live cards and details preserve exact ₹500 pricing, Hindi, 8+ guidance,
      official images, BookMyShow links, source disclosure, and distinct ICS UIDs.
- [x] The mixed weekend feed returns eight plans from two fresh official
      calendars; all four Jagriti showtimes have distinct IDs and start times.

## Upcoming discovery gate

- [x] Omitting `window` selects a server-owned 90-local-calendar-day Upcoming
      horizon; every public window excludes occurrences already ended at the
      signed first-page `as_of` anchor while preserving ongoing and all-day rows.
- [x] Cursor v2 binds normalized filters, effective-start/occurrence boundary,
      and `as_of`; real PostgreSQL and API tests prove stable equal-start ties and
      gapless pages without duplicate IDs.
- [x] The post-expansion production API returned 78 Bengaluru, 64 Delhi, 49
      Mumbai, and 10 Varanasi upcoming occurrences. Delhi's `60 + 4` cursor and
      the frontend's `24 -> 48 -> 64` traversal preserved one `as_of` and no
      duplicate IDs.
- [x] City selection and feed routing are API-driven; valid unlaunched city slugs
      fail safely without a Bengaluru/Varanasi branch in the public read path.

## Operations gate

- [x] The protected, unlinked `/operator` workspace is lazy-loaded and keeps
      its bearer token in component memory only.
- [x] It exposes source health, schema, recent run counts and incidents, with
      idempotent collection/replay actions and incident acknowledgement.
- [x] Collector IDs, external collection IDs, raw artifacts and credentials are
      not rendered in the browser.

## Expansion lock

Only one source may enter implementation next. It must pass the same artifact,
publication, API, browser, and failure-isolation gates before another begins.
Rudraksh remains disabled after its production request failed inside Bright
Data's proxy tunnel. EMINDIA then produced a reviewed 13-row dashboard preview,
but its sole production batch `j_mszq7kea7160itkzt` hit Bright Data
`proxy_config`/tunnel 403 before loading the page and terminated as exact `[]`;
Bright Data ticket `#723252` confirmed that the target is not allowlisted for
the account and requires registered-business Full Access KYC. The batch is
quarantined and no migration was created. The current bounded replacement is
BHU Academic Events: its official public JSON endpoint is handled by one
Code-worker request. Its verified activation published ten current, public,
Varanasi-scoped records and the public cities, feed, detail, ICS, and source
summary and browser checks passed. A reviewed Dhamma Cakka source contract also
passed locally, but its Studio request hit the same account-level proxy/allowlist
boundary before a schema-aligned page load; it remains blocked and unpublished.
Atta Galatta's source proof, backend activation, immutable replay, and public API
and browser checks are complete. BIEC's source, immutable backend, replay, public
API, and browser gates are also complete. Kashi Sansad Events is the next
Varanasi qualification target, but only its 2026 hub facts may be considered and
origin/robots plus stale-detail conflicts must fail closed. Rudraksh remains the
second viable coverage source once Bright account access is cleared. AllEvents
and ticketing sites remain discovery-only. Preview data is never used as a
public fallback.

Delhi and Mumbai are enabled with one verified private first-party source each.
The Piano Man's same-ID one-stage collector publishes 64 current Delhi rows;
Prithvi Theatre publishes 49 timed Mumbai performances. Both passed exact
schema/semantic gates, guarded production collection, immutable MinIO rehash,
no-Bright replay, public API, ICS, cursor, artwork, and browser journeys. India
Habitat Centre remains a Delhi candidate rather than a second source, while JNU
and other government sites are product-later. NCPA still requires written
permission. Research or Studio proof alone never enables another source: every
future source must pass immutable backend publication, API, and browser
acceptance first.
