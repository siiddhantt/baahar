# India Habitat Centre source research

Observed on 20 August 2026 in `Asia/Kolkata`.

## Decision

The official India Habitat Centre programme calendar is locally safe for one
bounded Code-worker slice. One separately authorized Bright development
collector now exists, but its generated template has not been inspected,
edited, previewed, saved, promoted, or run. Delhi remains unregistered and
disabled.

The source adds a compact, current mix of music, dance, theatre, film, talks,
and an online programme. It is a stronger first Delhi source than a government
university because it is an official non-government venue calendar, has
source-owned occurrence IDs, and exposes the complete current list in one
server-rendered response.

## Raw source proof

`https://indiahabitat.org/Events` returned `200 text/html; charset=UTF-8` in one
request. The response was 65,538 UTF-8 bytes with SHA-256
`845747196d2ddcf7dc328a669ca38078d9572bd9ce3cb1e640457b2af2d35fa2`.

The unique `#all-events` calendar identified itself as `August 2026` and
contained exactly 20 `day-content` cards, all dated 21–31 August. Each card
exposed:

- one exact local start time;
- one source type and one source venue separated by `|`;
- one title;
- one first-party `/Events_details/{numeric_id}` detail action;
- one first-party `/uploads/{source_file}` image.

All 20 numeric IDs and detail paths were unique. The IDs were 1353–1359, 1375,
and 1361–1372; their non-contiguous source order is preserved by date/time and
never treated as an array identity.

The page had no `rel=next`, pager, pagination, load-more control, source API,
RSS, or alternate month URL. Category tabs duplicate calendar records and are
not a second data surface. The worker reads only `#all-events`.

## Inventory proof

| Date   | Time    | Source type   | Venue                | Native ID | Title                                                                 |
| ------ | ------- | ------------- | -------------------- | --------- | --------------------------------------------------------------------- |
| 21 Aug | 7:00 PM | Music         | The Theatre          | 1353      | 21st Pandit Siyaram Tiwari Music Festival                             |
| 21 Aug | 7:00 PM | Dance         | The Stein Auditorium | 1354      | Rashtra Yajna: Every Step in Service, Every Beat for the Nation       |
| 22 Aug | 6:00 PM | Film & Talk   | Online               | 1355      | Baul Singers of Bengal                                                |
| 22 Aug | 7:00 PM | Talk          | Gulmohar             | 1356      | Bharat Bodh: A National Seminar on India’s Knowledge Traditions       |
| 22 Aug | 7:00 PM | Music         | The Theatre          | 1357      | चहुँमुखी… A Musical Efflorescence of Dhrupad, Khayal, Thumri & Bhajan |
| 22 Aug | 7:00 PM | Theatre       | The Stein Auditorium | 1358      | Dalla Ayaara                                                          |
| 23 Aug | 7:00 PM | Theatre       | The Stein Auditorium | 1359      | Dastan - e - Raahi                                                    |
| 24 Aug | 6:00 PM | Talk          | Gulmohar             | 1375      | Hindutva and Hind Swaraj: History’s Unforgotten Ideas                 |
| 24 Aug | 7:00 PM | Talk          | Casuarina            | 1361      | A Short History of PPP in India & The Way Forward                     |
| 24 Aug | 7:00 PM | Music         | The Stein Auditorium | 1362      | Cultural Kaarava’n Virasat 2026                                       |
| 26 Aug | 7:00 PM | Music         | The Theatre          | 1363      | Aarambh                                                               |
| 26 Aug | 7:00 PM | Music & Dance | The Stein Auditorium | 1364      | National Dance & Music Festival 2026                                  |
| 26 Aug | 7:00 PM | Talk          | Gulmohar             | 1365      | Conversations on Public Policy                                        |
| 27 Aug | 7:00 PM | Music         | The Theatre          | 1366      | Concert of classic melodies                                           |
| 27 Aug | 7:00 PM | Talk          | Gulmohar             | 1367      | Indian Poetics on Trees / Natural World                               |
| 28 Aug | 7:00 PM | Dance         | The Stein Auditorium | 1368      | Parijatham                                                            |
| 29 Aug | 7:30 PM | Dance         | The Stein Auditorium | 1369      | Parabola of Dance - Performance & Process 2026                        |
| 30 Aug | 7:00 PM | Music         | The Theatre          | 1370      | VANDE MATARAM: BHARAT VANDAN                                          |
| 30 Aug | 7:30 PM | Dance         | The Stein Auditorium | 1371      | Hansika: An Adaptation of Swan Lake                                   |
| 31 Aug | 7:00 PM | Dance         | The Stein Auditorium | 1372      | A Celebration of Bharat Vibhav                                        |

This is an exact dated observation, not a permanent 20-record gate.

## Delhi and attendance proof

The official `https://indiahabitat.org/Location_Layout` page states `India
Habitat Centre, Lodhi Road New Delhi - 110003`. The current physical venue
labels are internal IHC rooms: The Theatre, The Stein Auditorium, Gulmohar, and
Casuarina. `Online` is retained as the source venue with no physical address.
Any new venue label fails closed for review rather than inheriting the IHC
address without proof.

A one-time research audit loaded all 20 official detail URLs: all returned 200,
and none stated member-only, invite-only, cancelled, postponed, or sold out.
IDs 1358, 1369, and 1371 exposed public BookMyShow ticket actions; ID 1355
exposed a public Zoom join action. The other 16 detail pages exposed public
programme descriptions but no explicit admission or price qualifier.

The list-only worker therefore stores the official detail page as `source_url`
but does not claim that an event is free, registration-free, or guaranteed
admission. Registration, price, free state, age, accessibility, and language
remain unknown. Detail enrichment is intentionally deferred.

## Access and terms

`https://indiahabitat.org/robots.txt` returned 404. Conventional `/terms`,
`/Terms`, `/privacy`, and `/Privacy_Policy` paths also returned 404, and no terms
or privacy link was present in the calendar footer. A missing robots or terms
document is not permission.

The reviewed boundary is one low-cadence request to a public official calendar,
short factual fields only, first-party attribution and click-through, no
description copying, no personal data, no authentication, no PDF extraction,
and no model training. Recheck access if the site publishes a policy.

## Completeness and stop conditions

The page publishes only the current named month and currently excludes elapsed
rows from its primary calendar. It cannot establish full 90-day completeness:
on 20 August, dates after 31 August were not available on this surface. The
90-day bound is a filter and safety ceiling, not a promise of 90 days of source
inventory. Daily collection discovers later months only when the official page
rolls forward.

Stop with zero output when the current-month label, page identity, one-list
shape, pagination boundary, source type, venue allowlist, native ID, detail
host/path, image host/path, date/time, duplicate identity, page size, or record
limit drifts. A local pass is not Bright or publication proof.
