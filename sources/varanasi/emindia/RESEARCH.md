# EMINDIA 2026 source research

Research date: 19 August 2026 (Asia/Kolkata)

The official Galaxy Registration page returned HTTP 200 as static WordPress
HTML and contained the complete EMINDIA 2026 schedule. It is a registration
authority rather than an aggregator: the page contains the attendee form,
role-based fee tables, participation rules, and the BHU schedule from 9-13
September 2026.

The page has eight HTML tables. The unique `Conference Details` field contains
exactly five direct schedule tables with the reviewed class set and border
attributes. The remaining three tables are commercial registration tables;
one deliberately shares the three broad schedule classes but adds
`align-middle`, which is why a broad CSS selector is unsafe. The five bounded
schedule tables contain two summaries, two exact Skills School sessions, and
one exact Skills Mela session. There is no
pagination, calendar cursor, archive traversal, JavaScript rendering, or detail
fan-out. A Code worker is the minimum justified worker and costs one page load.

The public inventory is 13 occurrence rows. Nine have exact session times and
four have date precision. One additional WECAN summary row spans 11-12
September but explicitly says `By invitation only.` It is a negative canary,
not a Baahar occurrence.

The source is useful but intentionally professional: registration roles cover
nurses, medical students, postgraduate trainees, and doctors. The current
event contract has no audience-eligibility field, so Baahar must not rewrite
those roles into an age or accessibility field. The official registration link
remains available for users to verify eligibility.

The site's `robots.txt` allows this public path and disallows `/wp-admin/`.
Terms reserve content and media but do not publish a scraping prohibition.
Only factual schedule fields are mapped; descriptions and images stay out.

Rejected nearby alternatives included an unfinished Bharat Innovation
Conclave page, one-row professional expo pages, a BHU News GraphQL feed with
zero future records in the 90-day horizon, and aggregator-only listings that
lacked an official organizer schedule.
