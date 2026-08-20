# Dhamma Chakka source research

Reviewed live on 19 August 2026.

## Why this source

The Vipassana Research Institute schedule publishes Dhamma Chakka's residential
course calendar at one official, centre-specific URL. It adds a practical
Varanasi option that does not normally appear in entertainment marketplaces:
people can see future course dates and follow the source's own application path.

The page is server-rendered HTML. All centre facts, annual course tables, status
text, and application links are present in the raw response. A one-request Code
worker is sufficient; a browser, detail fan-out, PDF, OCR, generic crawler, and
runtime classification would add no supported fact.

## Current inventory and page shape

A fresh direct fetch returned HTTP 200, `text/html`, and 48,687 UTF-8 bytes. The
page contained exactly three tables:

- one centre-information table for Dhamma Chakka in Varanasi;
- one 2026 schedule table with 10 rows;
- one 2027 schedule table with 18 rows.

From the observed Asia/Kolkata date through 90 local calendar days later, seven
future starts were visible: 28 August, 3 September, 18 September, 3 October,
18 October, 30 October, and 11 November 2026. Their exact course types were one
3 Day Course, three 10 Day Courses, one 10 Day Special Course, one STP Course,
and one 30 Day Course. The last course ends on 12 December; it remains eligible
because its start is inside the reviewed Upcoming horizon.

The earlier 3–24 August row was `In Progress`, had no application link, and was
not emitted because a residential course cannot be joined after its start. No
pagination, next link, cursor, load-more control, or archive request was present.
Both annual tables are complete in the same response, so page cost is one.

## Audience, availability, and price honesty

The source publishes availability by participant category: old/new student,
male/female, and server. A row may simultaneously contain `Open`, `Closed`,
`Course Full`, and `N/A`. Baahar must not collapse that matrix into a universal
open or sold-out claim. `registration_state` therefore remains null and the
official page remains the authority for eligibility.

The schedule page also describes prerequisite rules for short, special, and
long courses. The event contract has no general audience field, so those rules
are not squeezed into `age_note` or `accessibility_note`. Current rows do not
publish a price in the reviewed table. `is_free`, price, and currency remain
unknown even though Vipassana courses are commonly donation-supported.

Application links carry a numeric `course` parameter, but the link exists only
after the source enables applications. Using that conditional parameter as
identity would change an occurrence's identity when registration opens. The
reviewed identity is therefore the standard fallback tuple: exact course title,
canonical schedule URL, local start date, and Dhamma Chakka venue key.

## Access and policy

`https://schedule.vridhamma.org/robots.txt` returned HTTP 200. Its `User-agent:
*` rules disallow administrative, account, search, core, and profile paths but
do not disallow `/courses/`; the reviewed page is public and needs no login.
The schedule host returned 404 for `/terms` and `/privacy`. VRI publishes a
related Terms of Use page at `https://www.vridhamma.org/terms-and-conditions`;
it warns that information may not be current but contains no reviewed ban on
automated access. That separate-host text is recorded as context, not treated
as explicit permission for the schedule host.

The collector is facts-only, follows no application form, stores no personal
data, uses one page per six-hour run, and links users back to the source. Bright
Data reachability and production behaviour remain unproven until a separately
authorized preview and immutable batch pass.
