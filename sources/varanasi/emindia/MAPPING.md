# EMINDIA 2026 source mapping

## Source boundary

The collector reads one exact public registration page:

- `https://www.galaxyregistration.com/event/skill-school/`
- host: `www.galaxyregistration.com`
- city and timezone: Varanasi, `Asia/Kolkata`
- venue: `BHU Varanasi`
- native occurrence ID: none

The input must be that bare HTTPS URL. Ports, credentials, query parameters,
fragments, alternate hosts, and redirects supplied as input are rejected before
the request. Scraper Studio's undefined save probe may resolve only to the same
compiled constant URL.

## Public occurrence boundary

The reviewed page currently exposes 13 public occurrences:

- one timed Skills Mela on 9 September;
- four Skills School courses in an 08:00-13:00 session and the same four in a
  14:00-19:00 session on 10 September;
- four date-only conference activities from 11-13 September.

The WHO-CCET Emergency Care Network roundtable is never emitted. Its source row
explicitly says `By invitation only.` The worker requires that exclusion marker
and rejects structural drift instead of silently treating a restricted session
as public.

## Canonical occurrence

| Canonical field             | Source mapping                                                          |
| --------------------------- | ----------------------------------------------------------------------- |
| `schema_version`            | Constant `event-occurrence/v1`                                          |
| `source_event_id`           | Null; the page supplies no stable per-occurrence ID                     |
| `source_url`                | Exact canonical registration page                                       |
| `source_host`               | `www.galaxyregistration.com`                                            |
| `city_slug`                 | `varanasi`                                                              |
| `title`                     | Exact visible activity or course title, whitespace-normalized           |
| `category`                  | `other`; the source does not publish Baahar taxonomy labels             |
| date/time fields            | Strict visible schedule date and, where present, exact 24-hour interval |
| `time_precision`            | `timed` for the nine workshop rows; `date` for four conference rows     |
| `timezone`                  | Reviewed source configuration `Asia/Kolkata`                            |
| `venue_name`                | Exact visible `BHU Varanasi`                                            |
| `venue_address`             | Null; no more specific event address is published                       |
| `is_free`                   | False; each included row is covered by an explicit fee note             |
| price fields and `currency` | Null; price varies by role, date, and selected sessions                 |
| `registration_url`          | Exact canonical page containing the registration workflow               |
| `registration_state`        | Null; a rendered form does not prove current availability               |
| `status`                    | `scheduled` for a current row on the official registration page         |
| `language`                  | Empty array                                                             |
| age/accessibility/image     | Null; unsupported or deliberately not republished                       |
| `observed_at`               | Scraper Studio job creation time                                        |

Conference activity lines beginning with a parenthesis continue the preceding
line; other line breaks delimit distinct activities. This preserves the two
11 September activities while keeping `EMINDIA 2026 Presentation Sessions
(Podium & Poster) at BHU Varanasi` as one source title.

## Identity

`source_event_id` remains null. The reviewed fallback combines normalized exact
title, canonical source URL, exact local occurrence date/time, and normalized
venue. The repeated Skills School course names remain distinct because their
morning and afternoon start times differ. Array position is never identity, and
an exact repeated tuple rejects the full run.

## Freshness and hard failure gates

- derive an inclusive 90-local-calendar-day horizon from `job.created` in
  `Asia/Kolkata` and emit only occurrences inside it;
- one exact input, one Code-worker request, one page, and no fan-out;
- exactly five reviewed schedule tables: two three-column summaries and three
  two-column detailed schedules;
- exactly one invitation-only WECAN row, two public pre-conference summary rows,
  three conference summary rows, two four-course Skills School schedules, and
  one one-course Skills Mela schedule;
- summary dates, venue, fee statements, session labels, and detailed schedules
  cross-check before any record is collected;
- strict English calendar parsing, weekday validation, valid 24-hour times,
  end after start, and an exact total of 13 public source occurrences;
- 1..20 occurrences may remain inside the current horizon; zero rejects the run;
- every record has the exact 27-key contract and a unique fallback identity;
- any input, selector, row, date, eligibility, count, or identity drift rejects
  the entire run before `collect()`.

## Access and content policy

`robots.txt` allows the public page and disallows only `/wp-admin/`, while
allowing `admin-ajax.php`. The published terms do not state a scraping ban, but
reserve event content and media. Baahar therefore republishes only schedule and
registration facts, makes one request per run, and does not copy descriptions
or images.
