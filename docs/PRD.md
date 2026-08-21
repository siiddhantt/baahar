# Baahar product requirements

Status: build-ready for the first public release
Working title: Baahar  
Production cities: Bengaluru, Delhi, Mumbai, and Varanasi
Target release: 23 August 2026

## 1. Product statement

Baahar answers one question immediately:

> What is actually worth going out for in my city today?

It collects public events from the individual websites people rarely remember
to check: theatres, museums, bookshops, cultural centres, universities,
government cultural portals, and community institutions. It presents the
result as a fast, visual feed with the original source attached to every event.

Baahar is not another event-listing marketplace. Organisers do not need to
list an event with us for it to become discoverable. It is also not a general
web-search wrapper: its value is the continuously maintained data pipeline,
common event model, deterministic change detection, and useful time-based feed.

## 2. User problem

City events are fragmented across structurally unrelated sites. Major ticketing
apps are good at commercially distributed inventory, but they do not reliably
cover the free talk at a museum, a theatre's own calendar, a university public
lecture, a government cultural programme, or a recurring ghat performance.

The practical failure is not a lack of web pages. It is that a person must know
which pages exist, revisit them, interpret inconsistent dates and registration
states, and notice when something changed. Search engines and one-off AI chats
can summarize a page that the user already found; they do not maintain a
current, normalized, change-aware city feed across those sources.

## 3. Target users and jobs

### Primary user

A resident or visitor who has a free evening or weekend and wants an interesting
plan without checking many unrelated websites.

Jobs:

- show me what is coming up, today, tomorrow, or this weekend;
- let me narrow the list by a few meaningful categories and explicit free entry;
- tell me when registration closed, the time moved, or the event was cancelled;
- take me to the official page to verify or register;
- let me save the plan or add it to my calendar in one action.

### Secondary user

A culture-forward resident who wants to discover smaller institutions and
events that do not appear in mainstream promoted feeds.

### Operator

The maintainer who adds sources, checks collection health, reviews a proposed
self-heal, and confirms that a repaired collector still satisfies the same data
contract.

The operator experience is protected and never appears in the public navigation.

## 4. Product principles

1. **The feed is the explanation.** A first-time visitor sees real nearby plans,
   not architecture copy or a product tour.
2. **Facts over guesses.** Missing price is `unknown`, not `free`. An absent event
   is not called cancelled without enough evidence.
3. **The source stays visible.** Every public event links to the official page and
   shows when Baahar last checked it.
4. **No scrape per visitor.** Collection is a scheduled shared pipeline. User
   traffic reads cached normalized data.
5. **No runtime AI.** Event identity, dates, filters, diffs, and feed ranking are
   deterministic. Bright Data's AI is confined to scraper creation and healing.
6. **Fewer complete features beat many demos.** A feature enters the MVP only if
   its live-data path, errors, accessibility, and browser journey are finished.
7. **India is present without becoming a costume.** Multilingual text is
   preserved, local sources are first-class, and the visual language avoids
   tourist clichés.

## 5. MVP scope

### P0: must ship end to end

- Bengaluru, Delhi, Mumbai, and Varanasi city selection.
- A current feed that defaults to Upcoming, with Today, Tomorrow, and This
  weekend shortcuts.
- Category filters: Arts, Talks, Workshops, Theatre, Music, Books, Community, and Other.
- An `Explicitly free` filter. Unknown price remains visible when the filter is
  off and is never relabelled.
- Event cards and detail views with title, time, venue, city, source, price or
  registration state when explicitly available, and a direct official link.
- Save/unsave without an account, stored on the device.
- Download a standards-compliant `.ics` calendar entry.
- Visible New, Updated, Cancelled, Postponed, Sold out, and Registration closed
  states when supported by source evidence.
- Seven production collectors across four cities. The UI discloses the live
  source count per city; only Bengaluru currently meets the broader three-source
  coverage floor, so no city claims exhaustive inventory.
- Immutable raw collection snapshots, schema validation, normalization,
  deterministic identity, versioning, and diff generation.
- Collection health checks and a protected operator view.
- One real Scraper Studio self-healing demonstration that keeps the same
  Collector ID and passes the unchanged downstream contract after review.
- Responsive light and dark themes, keyboard support, reduced-motion handling,
  and measured performance budgets.
- A public repository, setup instructions, an example Bright Data output,
  architecture notes, live Collector ID evidence, and a short demo video.

### P1: only after every P0 release gate passes

- A Telegram weekend digest using saved city and categories.
- PWA installability and notification opt-in.
- A map/nearby view and distance ordering.
- Cross-device saved-event sync.
- More cities and source templates.
- Public JSON or iCalendar city feeds.

### Explicitly not in the first release

- Ticket sales or payments.
- User-generated event listings and organiser accounts.
- Social matching, chat, reviews, or attendance counts.
- Opaque personalization, embeddings, vector search, or LLM recommendations.
- Location tracking, background GPS, or precise-location storage.
- A claim that Baahar lists every event in a city.
- Subjective filters such as `good for going alone` unless a source explicitly
  supplies the fact.
- Native desktop applications. The responsive web app is the product; a PWA can
  be added after the feed is reliable.

## 6. First-run experience

1. The homepage reads the saved city, if one exists, otherwise asks the visitor
   to choose one of the four supported cities.
2. The hero immediately shows a compact live preview: three real event cards and
   the number of sources checked. It never displays made-up sample events.
3. The primary action is `See what is on`; the secondary action is a city switch.
4. The feed opens on Upcoming, a bounded 90-local-calendar-day view. Today,
   Tomorrow, and This weekend remain quick filters. The selected window is
   encoded in the URL when it is not the default.
5. Filters update the URL and results without a full page reload. A polite live
   region announces the result count.
6. Selecting a card opens its detail route with a shared-element transition.
   Back returns to the same scroll position and filters.
7. `Official page`, `Save`, `Add to calendar`, and `Share` are the only primary
   event actions.

No public screen explains collectors, schemas, versions, or self-healing unless
the visitor deliberately opens a contextual `About this source` disclosure.

## 7. Functional requirements

### FR-1 City and time window

- A user can select one supported city and switch it at any time.
- Time windows are calculated in the city's IANA timezone; all four production
  cities use `Asia/Kolkata`.
- `Upcoming` begins at the first page's request-time anchor and ends at local
  midnight 90 calendar days later.
- `Today` includes occurrences that overlap the current local day.
- `Tomorrow` includes occurrences that overlap the following local day.
- `This weekend` is the next Saturday and Sunday, including the current weekend
  when today is Saturday or Sunday.
- Multi-day events appear in every relevant window but only once per query.
- Every public window excludes an occurrence whose effective end is at or before
  the first page's request-time anchor. Ongoing timed events and the current day
  of all-day events remain visible.

### FR-2 Feed

- The feed is source-ordered semantic HTML before it is visually enhanced.
- Default ordering is effective start time, then stable occurrence ID. This puts
  ongoing occurrences before the nearest future starts and gives equal starts a
  deterministic tie-break.
  There is no engagement-ranking or hidden source-quality score in P0.
- Cancelled occurrences remain visible when directly reached or saved, but are
  excluded from the default discovery feed.
- Pagination uses an opaque signed cursor, never offset pagination. It binds the
  normalized filters and preserves the first page's request-time anchor across
  replicas and subsequent pages.
- Empty states identify which filter caused the empty result and offer one clear
  reset action.

### FR-3 Filters and guided discovery

- Date window, category, explicit-free, venue, and city are shareable URL parameters.
- Unknown price does not satisfy the explicit-free filter.
- Categories are mapped by a reviewed source manifest or explicit source label;
  no runtime classifier invents them.
- Ask Baahar may translate one short request into those same filters. A strict,
  stateless model output is validated against current venues and taxonomy before
  the ordinary feed query runs. It cannot create facts, arbitrary URLs, SQL, or
  hidden ranking.

### FR-4 Event details

- Show only facts supported by the current verified version.
- Preserve the original title and scripts, including Hindi, Kannada, and
  diacritics. Do not machine-translate at runtime.
- Where a source supplies accessibility, age, language, or registration facts,
  render them as optional labelled fields.
- Collection age stays on the operator surface. Public details identify the official
  source and only show a freshness warning when the source is stale.
- External links open with safe `noopener` behaviour and a visible source host.

### FR-5 Saved events and calendar export

- Saved IDs use version-independent occurrence identifiers.
- Local saves survive refresh and theme/city changes.
- If a saved event changes, the saved view shows the current status and the
  relevant changed fields.
- ICS output escapes text correctly, uses UTC timestamps where exact times are
  known, and represents all-day events without fabricating times.
- Google and Outlook compose links are offered only when the known time range is
  sufficient; incomplete timed events keep the calendar-file fallback rather
  than receiving an invented duration.

### FR-6 Source collection

- Every source has a manifest containing authority, city, canonical host,
  Collector ID, expected output schema version, cadence, page budget, and
  publication policy.
- Scraper Studio collectors emit one record per event occurrence, not a single
  unstructured page dump.
- Listing/detail sources use a multi-stage collector: discover detail URLs, then
  fan out to extract the complete record.
- Only public pages are collected. No login, paywall, personal data, or access
  control is bypassed.
- Collection is never driven by an arbitrary user URL.

### FR-7 Ingestion and publication

- The exact Bright Data response is stored privately before normalization.
- A collection is idempotent by Bright Data collection/snapshot ID.
- Records must pass the versioned JSON Schema and source-specific semantic gates.
- One malformed record is quarantined without discarding otherwise valid records;
  a catastrophically unhealthy run publishes nothing.
- Publication writes the event version, derived changes, and outbox event in one
  database transaction.
- The last verified version remains public when a new run fails.

### FR-8 Change detection

- Compare normalized fields, not HTML or unordered raw JSON.
- Material fields are start/end, venue, booking URL, price/free state,
  registration state, and event status.
- Cosmetic description or whitespace changes do not produce a public update.
- A directly stated cancellation or postponement updates status immediately.
- Disappearance from one successful listing snapshot is not cancellation. A
  source-specific threshold of consecutive complete observations is required.
- Past occurrences expire naturally and are never labelled cancelled merely
  because they disappeared.

### FR-9 Health and self-healing

- Detect transport/trigger failures, schema violations, missing required fields,
  parse failures, abnormal row counts, duplicate spikes, stale/future date
  distributions, and canary-record failures.
- A failed health gate freezes publication for that source and creates a concise
  incident; it does not corrupt the public feed.
- The repair flow uses `bdata scraper heal`, reviews the generated diff/preview,
  runs the source canaries, approves deliberately, and reruns the same Collector
  ID. Production auto-approval is prohibited.
- The demo must show a controlled public fixture whose DOM changes while its
  meaning stays constant, then prove the downstream output contract is unchanged.

### FR-10 Operator view

- Show each source's last healthy run, next due time, row count, quarantined
  count, freshness, budget use, schema version, and incident state.
- Allow a protected manual trigger and acknowledge/replay action.
- Never expose Bright Data credentials, raw private artifacts, or repair controls
  on a public route.

## 8. Data contract

The canonical record represents a single occurrence. Optional means unknown or
not supplied; it never implies a default.

| Field                               | Type          | Rule                                                                     |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------ |
| `schema_version`                    | string        | exact supported contract version                                         |
| `source_event_id`                   | string/null   | source's stable ID when present                                          |
| `source_url`                        | URI           | canonical public event/detail URL                                        |
| `source_host`                       | string        | must match the source manifest allowlist                                 |
| `city_slug`                         | enum          | `bengaluru` or `varanasi` in MVP                                         |
| `title`                             | string        | Unicode, trimmed, non-empty                                              |
| `category`                          | enum          | reviewed deterministic mapping                                           |
| `start_date`                        | ISO date      | required local occurrence date                                           |
| `starts_at`                         | RFC 3339/null | required for a timed event; null for date-only                           |
| `end_date`                          | ISO date/null | required for multi-day/date-only end                                     |
| `ends_at`                           | RFC 3339/null | timed end; cannot precede start                                          |
| `time_precision`                    | enum          | `timed` or `date`; TBA-without-date is quarantined                       |
| `timezone`                          | IANA name     | `Asia/Kolkata` for launch cities                                         |
| `venue_name`                        | string/null   | preserve official spelling                                               |
| `venue_address`                     | string/null   | no inferred geocode in P0                                                |
| `is_free`                           | boolean/null  | null when price is absent/unclear                                        |
| `price_min_minor`/`price_max_minor` | integer/null  | paise for INR; no floating point                                         |
| `currency`                          | string/null   | `INR` only when price is present                                         |
| `registration_url`                  | URI/null      | official registration/booking URL                                        |
| `registration_state`                | enum/null     | open/sold_out/closed/not_required when evidenced                         |
| `status`                            | enum          | scheduled/cancelled/postponed; upcoming-list presence supports scheduled |
| `language`                          | string[]      | source-supplied only                                                     |
| `age_note`                          | string/null   | source-supplied display fact                                             |
| `accessibility_note`                | string/null   | source-supplied display fact                                             |
| `image_url`                         | URI/null      | subject to source image policy                                           |
| `observed_at`                       | RFC 3339      | collection observation time                                              |

Long descriptions are not required for the public product. Copyrighted source
copy is not republished wholesale; Baahar presents structured facts and sends
the user to the official page.

## 9. Identity and duplicates

Identity is deterministic and explainable:

1. Use `(source_id, source_event_id)` when the source identifier is guaranteed to
   represent one stable occurrence. A corrected start time must not create a new
   identity.
2. If a source ID represents an event with several performances, the collector
   must supply a genuinely stable performance identifier or omit the ID and use
   the fallback; it must not pretend the parent event ID identifies every show.
3. Otherwise use the normalized canonical source URL, normalized exact title,
   local occurrence date/time, and normalized venue key. Title is one part of
   this source-scoped fallback; similarity is never used.
4. Preserve a source alias table for deliberate URL/time migrations that cannot
   be reconciled through a stable source identifier.
5. Cross-source fuzzy matching is not in P0. If the same event appears on two
   sources, a reviewed alias can join them while both provenances remain.

Title similarity or performance-array position alone must never merge events.

## 10. Non-functional requirements

### Reliability

- Public feed availability target: 99.9% during the demo/release window.
- A source shows a visible freshness state when it exceeds its manifest TTL.
- All collection and callback operations are retryable and idempotent.
- Database writes use bounded transactions and explicit timeouts.
- Shutdown drains in-flight HTTP and worker jobs.

### Performance

- At the 75th percentile on mobile and desktop: LCP <= 2.5 s, INP <= 200 ms,
  CLS <= 0.1.
- Feed API target: p95 <= 300 ms uncached and <= 100 ms at the edge for public
  repeated queries under the release load profile.
- Initial route JavaScript budget: 180 KB gzip; route chunks: 70 KB gzip.
- Event images require intrinsic dimensions, responsive sources, modern formats,
  and lazy loading below the first viewport.
- No autoplay video, WebGL background, or scroll-jacking.

### Accessibility

- WCAG 2.2 AA for the golden journeys.
- Complete keyboard operation, visible focus, logical heading/order, useful
  accessible names, and 44px minimum interactive targets.
- No information available only on hover, colour, or animation.
- Reduced motion removes spatial/page transforms while preserving necessary state
  changes through instant swaps or short opacity changes.

### Privacy and security

- No account, analytics fingerprint, or precise location is needed for P0.
- Ask requests are bounded, rate-limited, sent with response storage disabled,
  and are not retained as conversation memory by Baahar.
- Bright Data and object-store credentials remain server-side and are redacted
  from structured logs.
- Only manifest-allowlisted source URLs can enter the collector pipeline.
- Raw snapshots are private, encrypted at rest by the storage provider, and
  accessed only by operators.
- Operator routes use a separate authenticated surface and strict rate limits.
- Apply CSP, secure headers, dependency scanning, request/body bounds, and log
  sanitation before deployment.

### Cost

- Each source declares a maximum pages-per-run and runs-per-day.
- The scheduler refuses work beyond the daily safety budget and reports the skip.
- Detail pages are revisited according to event proximity and source behaviour,
  not on every user request.
- Store each raw output in our object store because Bright Data snapshots have
  finite retention and reproducible audits require the exact input.

## 11. Success measures

Release success is not vanity traffic. It is demonstrated correctness:

- at least six live, healthy long-tail collectors across both cities, with eight
  as the target;
- at least 90% of valid upcoming source records accepted without manual edits;
- zero invented free/price/cancellation facts in the release audit;
- a real time/registration/status source change reaches the feed as a material
  diff without creating a duplicate;
- same Collector ID before and after the self-heal demonstration;
- all four public browser journeys and operator-heal journey pass;
- performance and accessibility budgets pass on the production build;
- a first-time tester can choose a city, find a real plan, and reach its official
  page without an explanation from the presenter.

Long-term product measures:

- official-link click-through per feed session;
- save/calendar rate;
- returning weekly users;
- source freshness and incident recovery time;
- events discovered outside mainstream ticketing feeds, measured by a reviewed
  sample rather than a marketing claim.

## 12. Product quality principles

- **Useful coverage:** one obvious city-discovery job, including non-metro and
  public cultural sources.
- **Source integrity:** a living city feed built from pages people do not
  routinely monitor, with the official source attached to every event.
- **Technical quality:** versioned contracts, idempotent ingestion, provenance,
  deterministic diffs, quarantine, and recovery.
- **Collection discipline:** reviewed source-specific collectors with stable
  IDs, bounded page budgets, and API-triggered scheduled flows.
- **Reliability:** health gates, frozen publication, reviewed same-ID repair, and
  canary replay.
- **Experience:** real city data, immediate visual feed, visible source changes,
  and polished light/dark behaviour.

## 13. Acceptance journeys

1. **New Bengaluru visitor:** choose Bengaluru, open This weekend, filter to
   Explicitly free, open a real source-backed event, save it, and download ICS.
2. **New Varanasi visitor:** choose Varanasi, distinguish a recurring public
   ritual from a dated one-off programme, and reach the official source.
3. **Changed plan:** open a saved event whose time or registration state changed;
   see the new state and material change without a duplicate card.
4. **Accessible use:** complete journey 1 with keyboard only, 200% zoom, dark
   mode, and reduced motion.
5. **Broken source:** observe a controlled DOM break fail its health contract,
   keep the last verified feed live, heal/review the same Collector ID, replay
   canaries, and publish the valid rerun.

## 14. Go/no-go boundaries

- Do not add a ninth source while any launch source has unresolved identity,
  timezone, publication, or health behaviour.
- Do not add notifications until saved events and change states are correct.
- Do not add maps until venue coordinates have a verified source and privacy plan.
- Do not claim a Bright Data Bengaluru office. Bright Data publicly states an
  India presence and offers Bengaluru-targeted proxy infrastructure, but its
  public careers material does not establish a Bengaluru office.
- If fewer than three sources in either city are healthy at release freeze, ship
  the healthy city as the polished demo and label the other as preview rather
  than filling the feed with hardcoded data.
