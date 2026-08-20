# UPISACON 2026 workshop mapping

## Source boundary

The collector reads one exact official public page:

- `https://upisaconvaranasi2026.com/workshops`
- host: `upisaconvaranasi2026.com`
- registration host: `registration.upisaconvaranasi2026.com`
- city and timezone: Varanasi, `Asia/Kolkata`
- native occurrence ID: none

The input must be that bare HTTPS URL. Ports, credentials, query parameters,
fragments, alternate hosts, and redirects supplied as input are rejected before
navigation. Scraper Studio's undefined save probe may resolve only to the same
compiled constant URL.

The raw response is an empty React shell. The one-stage Browser worker performs
one `navigate()` with `networkidle0`, parses the rendered DOM, and performs no
request, click, wait, scroll, traffic capture, retry, or fan-out.

## Public occurrence boundary

The rendered workshop section exposes seven independently selectable
pre-conference workshops on 2 October 2026:

1. POCUS
2. Regional Anesthesia
3. Mechanical Ventilation
4. Airway Management
5. ECMO
6. Advance Trauma Nursing Course
7. Basic Trauma Nursing Course

The exact visible venue is `Skill Center, Trauma Center, IMS BHU, Varanasi`.
The page says there are 30 seats per workshop, one delegate may choose one
workshop, and selection happens during conference registration. It does not
publish current availability per workshop on this page.

## Canonical occurrence

| Canonical field          | Source mapping                                                |
| ------------------------ | ------------------------------------------------------------- |
| `schema_version`         | Constant `event-occurrence/v1`                                |
| `source_event_id`        | Null; the page supplies no stable per-workshop ID             |
| `source_url`             | Exact canonical workshop page                                 |
| `source_host`            | `upisaconvaranasi2026.com`                                    |
| `city_slug`              | `varanasi`                                                    |
| `title`                  | Exact rendered workshop `h4`, whitespace-normalized           |
| `category`               | `workshops`; the page explicitly labels every card a workshop |
| `start_date`, `end_date` | Exact visible single date, `2026-10-02`                       |
| `starts_at`, `ends_at`   | Null; the page publishes no workshop times                    |
| `time_precision`         | `date`                                                        |
| `timezone`               | Reviewed city configuration `Asia/Kolkata`                    |
| `venue_name`             | Exact rendered venue text                                     |
| `venue_address`          | Null; the page publishes no more specific address             |
| free and price fields    | Null; the one-page runtime does not scrape the fee table      |
| `registration_url`       | Exact source-provided delegate-login URL                      |
| `registration_state`     | Null; a link and seat limit do not prove availability         |
| `status`                 | `scheduled` for a current rendered workshop                   |
| `language`               | Empty array                                                   |
| age/accessibility/image  | Null; unsupported or deliberately not republished             |
| `observed_at`            | Normalized Scraper Studio job creation time                   |

The separate official registration route currently shows paid, role-dependent
fees. The bounded collector does not navigate there, so it deliberately keeps
`is_free`, price, and currency null rather than turning a research observation
into an unchecked runtime fact.

## Identity

`source_event_id` remains null. The reviewed fallback combines normalized exact
title, canonical source URL, the exact local date, and normalized venue. The
seven titles are distinct. Array position is never identity, and a repeated
fallback tuple rejects the complete run.

## Freshness and hard failure gates

- derive an inclusive 90-local-calendar-day horizon from `job.created` in
  `Asia/Kolkata` and reject if 2 October is outside it;
- one exact input, one Browser `navigate()` with `networkidle0`, one page, and
  no interaction, direct request, retry, or fan-out;
- require HTTP 200 and the exact final canonical URL;
- require one exact `Pre-Conference Workshops` heading and its reviewed
  four-part DOM topology;
- require one exact date/venue subtitle, an ordered A-G grid with exactly seven
  unique titles, and the three exact registration rules;
- require the two source-provided external registration links to resolve to the
  same allowlisted delegate-login URL;
- require exactly seven records, the exact 27 canonical keys, supported facts
  only, and seven unique fallback identities;
- validate the entire rendered page and all records before the first
  `collect()` call;
- any input, navigation, selector, count, date, link, schema, or identity drift
  rejects the complete run.

The source remains preview-only until an independently reviewed Scraper Studio
Browser preview, output schema, production batch, backend publication, and
public-browser acceptance all pass.
