# The Piano Man Delhi source research

Observed on 20 August 2026 in `Asia/Kolkata`.

## Decision

The official The Piano Man event board is the strongest currently implementable
second Delhi source. It is a private venue/operator, sells public tickets on its
own first-party detail pages, and exposes its rolling inventory through a
bounded weekly JSON endpoint. Its same-ID Bright collector is verified through
Development and Production, and its guarded Baahar activation now publishes
the verified source through the Delhi API and city route.

India International Centre has broader cultural coverage and only two list
requests, but it is not safe to implement without permission. Its Terms PDF
prohibits entering site information into a database and displaying or
redistributing it, while its Website Policy separately permits accurate
reproduction with attribution. Baahar does not resolve that conflict by
assumption.

## Raw transport and completeness

The reviewed entry is `https://www.thepianoman.in/event/list`. The server's own
page JavaScript calls `GET /event/list/{boundary}` to append the next seven
dates. A request whose boundary is 19 August returned events dated 20-26
August and `addSevenDate: 2026-08-26`. Every subsequent response advances the
boundary by exactly seven days.

For an inclusive today-through-90-day horizon, the worker starts at the local
date minus one day and makes exactly 13 requests. Those non-overlapping
inclusive weekly segments cover local dates day 0 through day 90 once each. Each response is a
two-key JSON object (`html`, `addSevenDate`); `html` is a server-rendered card
fragment and may be empty. No CSRF token, cookie, login, browser action,
pagination cursor, load-more click, detail request, retry, or model transform is
required.

The 20 August proof returned the following weekly response sizes/card counts
when starting at 19 August: the first six segments held all current inventory;
later segments were valid 39-byte empty JSON responses. The largest observed
response was about 81 KB. The source currently publishes through 29 September,
so 90-day completeness means all 13 official windows were checked, not that the
operator has announced 90 days of events.

## Inventory and Delhi boundary

Across the 13 windows, the source exposed 106 unique cards across its three
venues. Exactly 69 belonged to the two official Delhi venue IDs:

| Detail venue ID | Exact source venue                  | Official address                                                                       | Current rows |
| --------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| `1`             | The Piano Man Jazz Club, Safdarjung | Commercial Complex B 6/7-22 Opp Deer Park, Safdarjung Enclave, New Delhi, Delhi 110029 | 42           |
| `2`             | The Piano Man Eldeco Centre, Saket  | Eldeco Centre, Hauz Rani, Malviya Nagar, New Delhi, Delhi 110017                       | 27           |

Venue ID `3`, The Piano Man Gurugram, 32nd Avenue, is outside Delhi and is
validated but never emitted. Of the 69 Delhi cards, 67 had an exact `Rs. N`
ticket price and a public first-party detail action. Two rows were exactly
`Private Event` / `Venue Closed` / `NON-TICKETED`; they are excluded rather
than presented as events people can attend.

The 67 public rows span 20 August through 29 September. Current source labels
are predominantly jazz, pop, rock, Bollywood, Indian music, and lunch-session
performances, plus two film screenings and one theatre event. The source has no
current workshop, book, talk, or community inventory, so it complements rather
than replaces a broad cultural board.

## Time, price, action, and identity facts

Cards publish a date and `Seating Time`, not an event start time. The worker
must not relabel seating as `starts_at`: it emits date precision with a null
timestamp. The exact seating minute is used only as a conservative same-day
eligibility bound. A row remains eligible at that minute and drops one minute
later because no end time is published.

The card's exact `Rs. N` value is stored as `price_min_minor`; it is not claimed
as a maximum because a detail page may offer several ticket tiers. The official
detail page is both source and registration URL, but registration state remains
unknown because the list does not prove open versus sold-out inventory.

Every detail path has `/event/detail/{venue_id}/{slug}`. The longest canonical
English-number suffix encodes a stable numeric event ID. For example,
`...four-thousand-six-hundred-ninety-three` is confirmed by the official detail
page's hidden `event_id=4693`. The worker requires at least one canonical
numeric suffix, selects the longest, and rejects malformed slugs; array position
is never an identity. A current title ending in a number (`Level Six`) proves
why the complete longest canonical suffix, rather than an assumed nonnumeric
boundary, is the durable source contract.

## Access and policy proof

`https://www.thepianoman.in/robots.txt` returned 200 and explicitly states
`User-Agent: *` and `allow: /`. Its sitemap lists the public privacy policy but
no terms, scraping, API, or reuse page. Conventional `/terms` and
`/terms-and-conditions` returned 404. The privacy policy discusses visitor data
and refers to unspecified terms of use, but exposes no content-reuse
restriction.

This is not a permanent permission claim. The reviewed boundary is low-rate,
public, factual event metadata with first-party attribution and click-through;
it stores no descriptions, artist biographies, personal data, videos, or user
information. Stop if a contrary policy appears.

## Stop conditions

Fail atomically on input, JSON keys, response size, seven-day cursor, card
shape, date/weekday/seating time, detail identity, venue ID/name, genre mapping,
price/actionability, image path, duplicate identity, request count, horizon, or
record-count drift. Empty future segments are valid. A local pass is neither a
Bright preview nor publication approval; the separate Studio proof below that
gate is recorded in `evidence/README.md`.
