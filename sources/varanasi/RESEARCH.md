# Varanasi source research

Research date: 18 August 2026 (Asia/Kolkata)

This note compares exactly three candidates for Baahar's first Varanasi
vertical slice. It is reconnaissance only. No Bright Data collector was created
or changed.

## Decision

Choose the [Rudraksh International Cooperation & Convention Centre upcoming
events page](https://www.rudrakshcentre.com/upcoming-event) first, with the
bounded date-only mapping below. It is the only candidate that exposes a live,
current inventory today: eight visible rows from 22 August through 4 October 2026.

This is a conditional recommendation, not a claim that every venue booking is
open to the public. Rudraksh supplies current official venue facts, but no
per-event detail, admission, booking, price, time, or audience status. Baahar
must display those facts as unknown and link to the official schedule. It must
not tell a user that they can attend or buy a ticket.

Subah-e-Banaras is the strongest later consumer source if it returns: its posts
name specific performers and often provide a time at New Assi Ghat. It is not a
safe first slice while the origin is unreachable and no current future record
can be verified. The Kashi portal is an aggregation/discovery source, not a
current occurrence source today: it mixes undated rituals with 2024/2025
festival cards and tells visitors to verify its information with the original
source.

## 1. Rudraksh Centre

### Current inventory and page shape

The live page returned HTTP 200 `text/html` in about half a second. Its visible
table has four columns: `Event Date From`, `Event Date to`, `Organizing Body`,
and `Event Name`. There are no row IDs, data attributes, detail links, booking
links, or row-specific images.

| From        | To          | Organiser                                    | Official event name |
| ----------- | ----------- | -------------------------------------------- | ------------------- |
| 22-Aug-2026 | 23-Aug-2026 | AayojanX Events                              | Exhibition          |
| 29-Aug-2026 | 31-Aug-2026 | Amba Educational Foundation                  | Satsang             |
| 01-Sep-2026 | 03-Sep-2026 | Ministy of Comm                              | Conferences         |
| 05-Sep-2026 | 06-Sep-2026 | Luxmice Private Limited                      | ARTH Theatre Fest   |
| 19-Sep-2026 | 19-Sep-2026 | Felicity Theatre                             | Hind Ka Sitara      |
| 20-Sep-2026 | 20-Sep-2026 | Narayan Reiki Satsang Pariwar- Varanasi Unit | Conference          |
| 21-Sep-2026 | 21-Sep-2026 | Numaish                                      | Numaish Exhibition  |
| 03-Oct-2026 | 04-Oct-2026 | Mythic Arc LLP                               | Mere Krishn         |

The raw HTML also contains two fully commented-out table rows. They are not
visible inventory and must never be collected. A DOM/table parser naturally
excludes them; a regular expression over raw markup did not. This is a required
canary for the collector.

The current page differs from a two-week-old search index: `ARTH Theatre Fest`
and `Hind Ka Sitara` are live while the index showed older inventory. Scheduled
collection therefore adds real freshness value even though the HTML is simple.

### Identity and ambiguity

The source exposes no native event ID and every row shares the same listing
URL. `source_event_id` must be null. Baahar's existing fallback uses the exact
normalized title, canonical list URL, local occurrence date/time, and venue
key. Different titled events on the same date therefore remain distinct. An
exact repeated identity tuple fails the run rather than receiving a fabricated
identifier. A later date or title correction requires the existing reviewed
alias/migration path.

All years are explicit and all records are date ranges without times. The
reviewed source timezone is `Asia/Kolkata`; this is source configuration, not a
value scraped from the page. The page does not state language, price, free
entry, registration, age policy, accessibility, or a row-specific address.
The global Google Maps link is not an event address field.

Audience is the main product risk. The venue's [spaces and facilities
page](https://www.rudrakshcentre.com/spaces-facilities) says organisers issue
identity cards and parking passes to participants. Several upcoming names are
generic (`Exhibition`, `Conference`, `Conferences`), so placement on the venue
schedule does not prove walk-in public admission.

### Access and worker choice

`/robots.txt` returned 404, and no site-wide privacy, website-use, or scraping
terms were found. Missing robots/terms is not permission. Limit collection to
one public page at a six-hour cadence, identify Baahar in the request policy,
republish only structured event facts, and retain a contact/legal review gate.

Use a Scraper Studio **Code worker**. One static response and one table are all
that is required. A Browser worker would add cost without exposing a missing
fact. The source is still a defensible Scraper Studio input because managed
scheduling, exact contract output, retries, health monitoring, and reviewed
self-healing protect a page whose current markup and inventory change without
an API or feed.

### Bounded 27-field mapping

| Canonical field                               | Mapping                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version`                              | `event-occurrence/v1`                                                                                                                 |
| `source_event_id`                             | null; never hash or invent a source ID                                                                                                |
| `source_url`                                  | the canonical upcoming-events list URL                                                                                                |
| `source_host`                                 | `www.rudrakshcentre.com`                                                                                                              |
| `city_slug`                                   | `varanasi`                                                                                                                            |
| `title`                                       | trimmed `Event Name`, preserving source spelling                                                                                      |
| `category`                                    | explicit `Theatre` token -> `theatre`; exact `Satsang` -> `community`; exact `Conference`/`Conferences` -> `talks`; otherwise `other` |
| `start_date`                                  | strict `DD-MMM-YYYY` parse of `Event Date From`                                                                                       |
| `end_date`                                    | strict parse of `Event Date to`                                                                                                       |
| `starts_at`, `ends_at`                        | null                                                                                                                                  |
| `time_precision`                              | `date`                                                                                                                                |
| `timezone`                                    | reviewed source configuration `Asia/Kolkata`                                                                                          |
| `venue_name`                                  | `Rudraksh International Cooperation & Convention Centre`                                                                              |
| `venue_address`                               | null                                                                                                                                  |
| `is_free`, price fields, `currency`           | null                                                                                                                                  |
| `registration_url`, `registration_state`      | null                                                                                                                                  |
| `status`                                      | `scheduled`, because the row is visibly under `Upcoming Events`                                                                       |
| `language`                                    | empty array                                                                                                                           |
| `age_note`, `accessibility_note`, `image_url` | null                                                                                                                                  |
| `observed_at`                                 | collection job timestamp                                                                                                              |

This mapping satisfies the existing schema without guessing missing facts. It
does not solve the contract's lack of a public/limited/unknown audience field;
that limitation must remain visible in the checkpoint decision.

### Fail-closed gates

- exact HTTPS host and `/upcoming-event` path; no input parameters;
- HTTP 200 HTML and exactly one visible table with the four reviewed headers;
- comments removed before selecting rows;
- 1..50 visible records, one page, and no empty cell;
- strict English `DD-MMM-YYYY` dates, explicit four-digit year, start not after
  end, and no visible row already past in Asia/Kolkata;
- no duplicate normalized row or fallback `(title, source URL, start date,
venue)` identity tuple;
- title and organiser length bounds; preserve Unicode and source spelling;
- output has the exact canonical field set and all reviewed unknowns remain
  null/empty;
- any selector/header/date/identity failure quarantines the whole small run;
- after three healthy runs, freeze publication on material count drift and keep
  the last verified feed live;
- one missing healthy observation is not cancellation; use the existing
  multi-observation absence policy.

## 2. Subah-e-Banaras

### Current inventory and page shape

The official `/events/` origin was not reachable from the audit environment:
HTTPS failed after about 10.6 seconds and direct TCP connections to the resolved
origin failed on ports 443 and 80. `/robots.txt` and current terms therefore
could not be reviewed live.

The latest search-indexed events page, crawled last month, is a WordPress-style
three-section surface:

- `Prabhati` cards at New Assi Ghat with dates in the title;
- `Ghat Sandhya` cards at New Assi Ghat with dates and performers;
- Trade Facilitation Centre cultural cards, several without a date.

Indexed samples include Prabhati on 25, 26, and 27 June 2026 and Ghat Sandhya
on 27, 28, and 29 June 2026. The newest indexed detail found today is [Tejswi
Shashank, 29 July 2026](https://subahebanaras.net/subah-e-banaras-prabhatidate-29-07-2026-classical-singingtejswi-shashankvaranasi/),
which is already past. Therefore the live-verifiable upcoming count is zero;
this does not prove the unavailable origin currently has zero events.

Cards lead to individual WordPress post URLs. Indexed detail pages can contain
performer, form, venue, date, and exact time. They are materially better for a
consumer than Rudraksh's generic rows. However, at least one indexed detail
whose title says 13 March contains both 5 March and 13 March in its body. A
collector must reject conflicting occurrence dates rather than choose one.

### Identity, booking, and worker choice

The canonical post URL is a viable occurrence identity fallback. A native
WordPress post ID would be preferable if a public REST response can be verified
after the origin returns. Dates and years are usually explicit; exact times are
sometimes present and sometimes blank. `Asia/Kolkata` would be reviewed source
configuration. Undated cards and conflicting details cannot enter the 27-field
contract.

The site has a generic `/booking/` surface with ₹200/₹300 seats, but no verified
event-specific relationship was found. Never attach that price or booking URL
to a performance without an explicit source link. Event price, registration,
age, accessibility, and language remain unknown.

If the source returns, attempt a **Code worker** first: WordPress listing or
REST discovery followed by bounded detail requests. Bright Data's unblocking,
retry, and self-heal path would be strongly justified by the observed
availability problem. A Browser worker cannot repair an offline origin and is
not justified unless a required field is later shown to require JavaScript.

Defer this source until a Bright reachability preview proves a non-empty current
result, robots/terms can be reviewed, and at least one future detail passes the
date/time/identity contract.

## 3. Kashi official portal

### Current inventory and page shape

The official [events surface](https://darshan.kashi.gov.in/listing/events)
returned HTTP 200 and about 111 KB, but the raw response is an Angular
application shell: it contains no event title, date, or event-detail route.
The 1.7 MB main JavaScript bundle references the portal's API gateway, but the
exact event endpoint was not established as a reviewed public contract.

The most recent rendered search copy contains 23 cards:

- four undated recurring descriptions: Sankat Mochan Bhajan Sandhya, Shri Kashi
  Vishwanath Aartis, Ganga Aarti, and Subah-e-Banaras;
- 19 dated festival cards, all in 2024 or 2025.

There is no future-dated occurrence on 18 August 2026. Example stale cards are
Nag Nathaniya on 5 November 2024, Mahashivaratri on 26–27 February 2025, and Dev
Deepawali on 5 November 2025. The page renders August–October 2026 calendar
chrome even though the cards remain historical; the calendar month is not
event evidence.

Rendered cards have an image, Hindi title, optional excerpt, optional single or
range date, and `View Details`. Route shapes are mixed: dated festival details
can use `/event/{slug}`, while general/recurring information can use
`/listing-details/{slug}`. A slug or backend record ID may become a stable
identity only after the actual client response is captured and checked.

### Access, ambiguity, and worker choice

`/robots.txt` returns the same Angular application shell rather than a robots
policy. The portal publishes [terms](https://darshan.kashi.gov.in/content/terms-and-condition),
[privacy](https://darshan.kashi.gov.in/content/privacy-policy), and a
[disclaimer](https://darshan.kashi.gov.in/content/disclaimer). The terms and
privacy text primarily address the Kashi Darshan app. The disclaimer explicitly
does not guarantee accuracy or timeliness and tells visitors to verify
information with the original source. That makes Kashi a corroborating city
portal, not the preferred authority for a Baahar occurrence.

The four undated rituals cannot satisfy the occurrence contract: no current
date, exact recurrence rule, time, timezone, venue occurrence, or registration
state is supplied by the event cards. Materialising a daily occurrence from a
general description would be inference. Historical dated cards could be mapped
structurally but provide no current consumer value.

Start with a **Browser worker spike** only if this source is reconsidered. Its
purpose is to capture the client-side event request and determine whether a
stable public JSON endpoint exists. If so, replace the Browser worker with a
cheaper Code worker. Do not build a Browser DOM collector around stale cards,
and do not publish until the portal supplies current dates and recurring-event
semantics are explicitly modelled.

## Qualification gate

Rudraksh may enter implementation only if the primary maintainer accepts these
three constraints:

1. current venue schedule is useful even when admission is unknown;
2. its no-native-ID fallback and exact-identity collision quarantine are
   acceptable;
3. the UI/source attribution never implies public entry, price, or booking.

If any constraint is rejected, do not substitute Subah or Kashi. Keep
qualification blocked until Subah returns with a future detail or a stronger
Varanasi source is researched.
