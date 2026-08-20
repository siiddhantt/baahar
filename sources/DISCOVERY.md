# Baahar source discovery boundary

Discovery expands coverage; it never publishes events.

1. Maintain a small reviewed seed list of official venue, university,
   government, cultural-institution, and organizer domains per city.
2. Inspect their sitemaps, calendars, news pages, public JSON/RSS, and outbound
   official links to produce candidate source URLs.
3. Qualify each candidate manually for current inventory, public actionability,
   city and date precision, identity, access policy, bounded page cost, and a
   deterministic 27-field mapping.
4. Build one dedicated source manifest and collector only after qualification.
5. Publish only records from that dedicated collector after immutable live
   proof and backend gates pass.

Search results, aggregators, social posts, and discovery candidates are leads,
not event records. They may point to an official source but never flow directly
into the public API. Baahar does not maintain a generic crawler, copy
BookMyShow, or use runtime AI to decide which facts are true.

## Bounded discovery cadence

- Weekly per city: query a small reviewed set of venue, university, government,
  cultural, organizer, ticketing, and aggregator surfaces for candidate URLs.
- Recheck known official calendars, RSS feeds, sitemaps, and empty seasonal
  sources before searching for new domains.
- Store only candidate URL, discovery source, first/last seen, city evidence,
  official-authority link, current inventory count, access notes, format, and
  estimated page cost.
- Cap discovery at three pages per domain and twenty candidate URLs per city per
  run. There is no per-user crawl and no event publication from this stage.

Candidate states are explicit:

```text
discovered
  -> authority_verified
  -> access_verified
  -> inventory_verified
  -> mapping_reviewed
  -> collector_verified
  -> backend_published
```

AllEvents, BookMyShow, Reddit, search results, and local news may enter only at
`discovered`. A row reaches Baahar only through a dedicated official-source
collector and the normal immutable publication pipeline.

The dated Delhi and Mumbai qualification matrices and their request/access
boundaries live in
[`docs/SOURCES.md`](../docs/SOURCES.md#11-delhi-and-mumbai-qualification-snapshot).
The Piano Man and Prithvi Theatre have reached `backend_published`; every other
row remains a discovery or qualification record and cannot publish events.
