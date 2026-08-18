# Rudraksh source mapping

## Source boundary

The Rudraksh International Cooperation & Convention Centre is the official
venue source. The first collector reads exactly one public static table:

- Listing: `https://www.rudrakshcentre.com/upcoming-event`
- Canonical host: `www.rudrakshcentre.com`
- City and timezone: Varanasi, `Asia/Kolkata`
- Venue: `Rudraksh International Cooperation & Convention Centre`
- Native occurrence ID: none

The page exposes four cells per visible row: start date, end date, organising
body, and event name. It exposes no detail URL, event ID, time, price, booking,
admission, language, age, accessibility, or event image.

The raw HTML can retain old rows inside HTML comments. Comments are not page
content and must be ignored before row selection. The 18 August 2026 review
found eight visible future rows and two commented-out rows.

## Canonical occurrence

| Canonical field                      | Source mapping                                             |
| ------------------------------------ | ---------------------------------------------------------- |
| `schema_version`                     | Constant `event-occurrence/v1`                             |
| `source_event_id`                    | Null; never construct a source ID from mutable text        |
| `source_url`                         | Exact reviewed listing URL                                 |
| `source_host`                        | `www.rudrakshcentre.com`                                   |
| `city_slug`                          | `varanasi`                                                 |
| `title`                              | Trimmed `Event Name` cell only                             |
| `category`                           | Reviewed rules below                                       |
| `start_date`                         | Strict `DD-MMM-YYYY` parse of `Event Date From`            |
| `end_date`                           | Strict parse of `Event Date to`                            |
| `starts_at`, `ends_at`               | Null                                                       |
| `time_precision`                     | `date`                                                     |
| `timezone`                           | Reviewed source configuration `Asia/Kolkata`               |
| `venue_name`                         | Fixed reviewed official venue name                         |
| `venue_address`                      | Null                                                       |
| free, price, and currency fields     | Null                                                       |
| registration fields                  | Null                                                       |
| `status`                             | `scheduled` only for a visible row under `Upcoming Events` |
| `language`                           | Empty array                                                |
| age, accessibility, and image fields | Null                                                       |
| `observed_at`                        | Collection job creation time                               |

Category is based only on explicit source text, in this order:

1. `Theatre` appears as a word in event name or organiser -> `theatre`.
2. `Satsang` appears as a word in event name -> `community`.
3. Event name is exactly `Conference` or `Conferences` -> `talks`.
4. Otherwise -> `other`.

The organiser is not appended to the title. `Exhibition`, a theatre-sounding
proper name without the word Theatre, or any other ambiguous label remains
`other`.

## Identity and publication

`source_event_id` is null. The backend fallback uses normalized title,
canonical list URL, local occurrence date/time, and normalized venue. Different
titled events on one date remain distinct; an exact duplicate tuple freezes the
whole run. A corrected date or title cannot be reconciled automatically and
uses the reviewed alias/migration path.

Audience is not represented in the current occurrence contract. A venue
schedule is not proof of public admission: the venue's facility rules say that
organisers issue participant identity cards. Varanasi remains a preview until
the browser journey presents this as an official venue schedule without
implying walk-in access, tickets, price, or availability.

## Hard failure gates

- every production input is the exact bare HTTPS host/path with no port, query,
  fragment, or credentials;
- Scraper Studio's separate save probe may omit `input.url`; only `undefined`
  compiles to the same constant reviewed URL, while null, objects, numbers, and
  every supplied wrong string fail before a request;
- the production trigger still supplies the explicit reviewed URL and backend
  transport validation rejects an absent or different `input` envelope;
- the Code worker selects exactly the ISO `in` country route before its one
  request; it has no fallback route, proxy-location call, or request retry;
- one request and one reviewed table header on one page;
- comments do not create nodes or rows;
- 1..50 visible data rows and exactly four non-empty cells per row;
- strict English `DD-MMM-YYYY` dates with an explicit year;
- start date is not before the job's Asia/Kolkata date and end is not before
  start;
- every canonical title and field length satisfies the output contract;
- no repeated `(normalized title, source URL, start date, venue)` tuple;
- every record has the exact canonical key set and reviewed unknowns remain
  null or empty;
- any row failure rejects the complete small run before `collect()` is called.

`robots.txt` returned 404 during the 18 August review and no site-wide web-use
terms were found. This is not a permission signal. Collection stays at one
facts-only page every six hours with source attribution and an open
contact/legal review gate.

The explicit India route was a bounded development-only compatibility test. The
first production crawl received the correct input but Bright Data failed before
page load with a proxy tunnel HTTP 403 and `error_code: proxy_config`. Bright's
official functions reference documents `country(code)` for country routing and
supports it in Code workers, but an explicit preview with that route failed with
the same tunnel error. The diagnostic draft was not saved: production remains
v1 without `country('in')`. Collection is blocked, the source stays preview,
and the affected job belongs in Bright Data's collection-and-delivery support
path.
