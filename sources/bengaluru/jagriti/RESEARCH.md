# Jagriti Theatre source review

Reviewed live on 18 August 2026 against Jagriti Theatre's official site.

## Current consumer value

The official [What's On page](https://www.jagrititheatre.com/jagriti-events-collections)
currently exposes six upcoming productions and eleven distinct timed
performances:

| Production                          | Performances                     |
| ----------------------------------- | -------------------------------- |
| Confessions from Mental Asylum      | 21 Aug at 19:30                  |
| 12 Angry Men                        | 22 and 23 Aug at 15:30 and 19:30 |
| Undercurrents- Indo Jazz Concert    | 28 Aug at 19:30                  |
| Patna Ka Superhero                  | 4 Sep at 19:30                   |
| Baranday Shobder Bhir               | 20 Sep at 15:30 and 19:30        |
| Farewell : An Entropy of Separation | 1 Nov at 15:30 and 19:30         |

The list supplies an official detail URL, card thumbnail, price, genre,
BookMyShow link, and structured `.addthisevent` start/end/timezone/title spans.
Each internal detail page repeats those structured performance spans and adds
language, duration, and age guidance. The eleven current performances have
exact end times and their declared durations agree with those intervals.

This is materially more actionable than an announcement feed: a user can see
the exact showtime, language, age guidance, price, and official booking route.
It also adds a different Bengaluru discovery surface from BIC's talks and arts
programme.

## Source shape

- List: one static `evtabbody` containing 6 `evtabrow` entries.
- Detail: one static page per production, currently 6 pages and 33-40 KB each.
- Occurrence: one `detpageaddtocal` block per performance with structured
  `start`, `end`, `timezone`, and `title` spans.
- Metadata: one five-row `evedettab` for ticket price, genre, language,
  duration, and age.
- Registration: one unique official page link to `in.bookmyshow.com`; link
  presence does not prove ticket availability.
- Native identity: no stable per-performance ID, JSON-LD, or ICS identifier.

The BookMyShow ID is shared by every performance of a production and therefore
cannot be used as `source_event_id`. The stable occurrence fallback is the
official detail URL plus exact local performance timestamp and reviewed venue.

## Access review

`robots.txt` returned HTTP 200 and allows `/`; its disallowed paths do not cover
the list or detail pages. The site's published privacy page covers donations
and does not state a web-data reuse rule. This is not permission beyond public
access. The bounded plan reads one list and its 1..25 linked official detail
pages no more than every six hours, attributes Jagriti, and sends users back to
the official detail/booking route.

## Worker choice

A Code worker is the minimum correct worker: all required facts are in static
HTML and no JavaScript, click, scroll, login, or browser traffic capture is
needed. The first slice cross-checks the list and detail copies before emitting
anything. Any partial page, unknown detail host/path, title/timezone mismatch,
occurrence drift, price/genre disagreement, or duration mismatch freezes the
complete small run.

No Bright Data collector has been created or modified for Jagriti.
