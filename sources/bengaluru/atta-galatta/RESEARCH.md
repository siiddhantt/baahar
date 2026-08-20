# Atta Galatta source research

Reviewed live on 20 August 2026.

## Why this source

Atta Galatta is an independent Bengaluru bookstore and events space with a dense
official calendar spanning books, workshops, film, poetry, discussion, art, and
community gatherings. It adds breadth and volume without copying a ticketing
marketplace or asking users to inspect the venue's social feed.

The public `events.php` endpoint is the calendar's first-party JSON transport.
One response contains the full historical and upcoming array. No browser,
pagination, cursor, detail fan-out, PDF, generic crawler, OCR, or runtime LLM is
needed for the facts used by Baahar.

## Current transport and horizon

A fresh request returned HTTP 200, `application/json`, and 1,270,008 bytes. The
top-level object contained `resp: true` and a `value` array of 2,123 rows. Every
row had the same 15 source keys, a sequential `Sno`, an `EVT` identifier, an
official detail URL, and an official image URL. There was no total-pages field,
next link, cursor, or separate page request: the one array is the complete
transport boundary.

The 90-local-calendar-day horizon from 20 August through 18 November contained
42 future starts. The source added three 29 August entries (`EVT2094`,
`EVT2095`, and `EVT2096`) after the 19 August qualification; this demonstrates
why the collector derives the set rather than hardcoding a count. The current
range runs from 21 August through 4 October. All 42 native IDs,
detail URLs, and normalized title/date/time tuples were unique.

The archive is not clean enough to validate as current inventory. It includes
one malformed historical year `0026`, and 50 native IDs repeat somewhere in the
full 2,120-row array. Four IDs repeat within earlier 2026 data because one
parent event was listed at several dates or times. Current horizon IDs do not
repeat. The worker ignores irrelevant historical calendar corruption but fails
the full run if one eligible native ID represents multiple current occurrences.
Array position is never identity.

## Facts kept and facts withheld

Current rows provide exact event ID, title, date, start time, detail link, and
image. The `subtitle` and `host` fields are present but empty for all 39 current
rows; they are therefore validated, not invented or squeezed into another
field. Three newly published current rows also have empty subtitle and host
fields. The source description is a truncated promotional excerpt, commonly 225
characters, and is deliberately not copied.

The JSON provides no end time, per-event venue, registration target, price,
free/paid signal, availability, audience, language, or accessibility fact. Those
canonical fields remain null or empty. The calendar belongs to a Bengaluru
venue, so it supports the city boundary, but Baahar does not claim that every
listing occurs at the footer address; venue name and address stay null.

The source currently leaves subtype empty, so category remains `other` rather
than using title keyword guesses. A future non-empty subtype or host requires a
reviewed mapping change instead of silently changing product semantics.

## Access and policy

`https://attagalatta.com/robots.txt` returned 404, so no robots directives were
published. The official privacy policy at `/privacy_policy.php` describes normal
visitor logging, cookies, and personal-information handling; it contains no
reviewed automated-access prohibition. No general terms page was found at the
reviewed conventional paths. A missing robots or terms file is not affirmative
permission.

The collector is facts-only, stores no visitor data, does not copy descriptions,
uses one public response every four hours, and links cards to the official event
detail. Bright Data reachability remains unproven until separately authorized
preview and immutable batch gates pass.
