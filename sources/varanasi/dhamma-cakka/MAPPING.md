# Dhamma Chakka mapping

## Source boundary

The collector accepts exactly:

`https://schedule.vridhamma.org/courses/cakka`

It makes one Code-worker `request()` and parses the returned HTML once. It does
not navigate, paginate, fan out, submit a form, follow an application link, or
select a proxy country. Any explicit port, query, fragment, alternate host, or
path is rejected before the request. Scraper Studio's undefined-input save probe
may compile only to the same constant URL.

The worker requires one reviewed centre table, one or more uniquely labelled
`Course Year YYYY` tables, exact five-column schedule headers, and no pagination
marker. It parses every visible schedule row before filtering so structural
drift cannot produce a partial result.

## Eligibility

A row is emitted only when its start date is from the observed Asia/Kolkata
calendar date through 90 calendar days later, inclusive. A course that already
started is excluded even when its end date is still future. At least 3 and at
most 20 rows must remain.

Rows do not need an active application form. If a reviewed `Apply` link exists,
it is preserved; otherwise registration stays unknown and the schedule URL is
still the official action. Empty course type, date, or status text fails the
run. Hidden rows and HTML comments never become occurrences.

## Canonical mapping

| Canonical field           | Official fact                | Rule                                                                                             |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `source_event_id`         | conditional application link | Always null; a link that appears only when applications open is not stable identity              |
| `source_url`              | centre schedule URL          | Exact canonical page for every occurrence                                                        |
| `source_host`             | schedule host                | `schedule.vridhamma.org`                                                                         |
| `city_slug`               | centre location              | `varanasi` only after exact centre/location canaries pass                                        |
| `title`                   | Course Type cell             | Exact source text with whitespace collapsed                                                      |
| `category`                | course calendar              | `community` for these centre-run meditation courses                                              |
| `start_date` / `end_date` | Dates cell + table year      | Strict calendar parsing, including a year rollover when the end month crosses January            |
| `starts_at` / `ends_at`   | unavailable                  | Null; the general explanatory timetable is not applied to every course type                      |
| `time_precision`          | date-only row                | `date`                                                                                           |
| `timezone`                | reviewed city contract       | `Asia/Kolkata`                                                                                   |
| `venue_name`              | centre heading               | Exact `Dhamma Chakka`                                                                            |
| `venue_address`           | centre address               | Exact `Kharagipur, Uttar Pradesh - 221104`                                                       |
| `registration_url`        | optional Apply link          | Absolute official URL with an allowlisted form path, `centre=31`, and one numeric `course` value |
| `registration_state`      | role-specific status matrix  | Null; mixed eligibility/availability is not collapsed                                            |
| `status`                  | dated course row             | `scheduled`; registration availability is not occurrence cancellation                            |
| `observed_at`             | `job.created`                | Valid RFC 3339 instant normalized to UTC                                                         |

Price, currency, free/paid state, language, age, accessibility, and image remain
null or empty because the reviewed occurrence rows do not support them safely.

## Identity and atomicity

Identity uses normalized title + canonical source URL + local start date +
normalized venue key. Array position and the conditional application `course`
parameter are forbidden. An exact duplicate tuple fails the entire run.

The worker validates centre canaries, table coverage, all visible row shapes,
calendar dates/order, application URL boundaries, the 90-day set, exact 27-field
records, and duplicate identities before the first `collect()` call. Any error
emits zero records.
