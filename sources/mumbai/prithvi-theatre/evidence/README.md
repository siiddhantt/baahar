# Prithvi Theatre evidence

No mutable raw response is committed. The focused live harness fetches the
official endpoint once, independently proves all four array joins, executes the
worker, and exercises atomic mutation gates.

Evidence clock: `2026-08-20T00:00:00.000Z`

- request/page budget: `1 / 1`
- response: `200 application/json; charset=utf-8`
- response bytes: `41,892`
- raw SHA-256: `fab5ec2efe8e600a705fb9360a19d6d4e8b113386c2b39f6ad8d74cf166fc152`
- venue / event / day-session / timed-session rows: `3 / 28 / 49 / 49`
- native timed join coverage: `49 / 49`
- pagination fields: `0`
- canonical rows: `49`
- canonical SHA-256: `8faf79fcba46243715e9b679de69564bb07e8db8a5fd4ca366c4c19d5c980885`
- categories: `theatre 44`, `music 2`, `arts 2`, `talks 1`
- free / priced: `4 / 45`
- verified price conversion: API `500.00` rupees -> `50000` INR minor units
- registration state: `open 49`
- authoritative Go contract validation: `49 / 49`

## Exact occurrence inventory

| Session | Start (Asia/Kolkata) | Category | Title                                          |
| ------: | -------------------- | -------- | ---------------------------------------------- |
|     723 | 21 Aug 17:00         | theatre  | B Spot Productions' Lavani Ke rang             |
|     722 | 21 Aug 20:00         | theatre  | B Spot Productions LOVE & LAVANI               |
|     709 | 22 Aug 17:00         | theatre  | Water Lily's THE GREATEST SHOW ON EARTH        |
|     710 | 22 Aug 20:00         | theatre  | Water Lily's THE GREATEST SHOW ON EARTH        |
|     749 | 23 Aug 11:00         | music    | JAZZ@PRITHVI: JOE ALVARES & GINO BANKS         |
|     711 | 23 Aug 17:00         | theatre  | Water Lily's THE GREATEST SHOW ON EARTH        |
|     712 | 23 Aug 20:00         | theatre  | Water Lily's THE GREATEST SHOW ON EARTH        |
|     754 | 24 Aug 19:00         | arts     | Caferati@Prithvi                               |
|     724 | 25 Aug 20:00         | theatre  | 72 East Production's THE QUEEN                 |
|     725 | 26 Aug 20:00         | theatre  | 72 East Production's SIACHEN                   |
|     750 | 27 Aug 21:00         | theatre  | O Gaanewali's ALBUM PREVIEW SHOW               |
|     753 | 28 Aug 19:00         | arts     | Vikalp@Prithvi                                 |
|     734 | 28 Aug 20:00         | theatre  | The Company Theatre's Baaghi Albele            |
|     735 | 29 Aug 12:00         | theatre  | The Company Theatre's Baaghi Albele            |
|     736 | 29 Aug 20:00         | theatre  | The Company Theatre's TAKING SIDES             |
|     759 | 30 Aug 11:00         | theatre  | Storytelling@Prithvi                           |
|     737 | 30 Aug 12:00         | theatre  | The Company Theatre's TAKING SIDES             |
|     738 | 30 Aug 20:00         | theatre  | The Company Theatre's Baaghi Albele            |
|     778 | 1 Sep 19:00          | theatre  | IPTA Mumbai: Bhooke Bhajan Na Hoye Gopala      |
|     779 | 2 Sep 19:00          | theatre  | IPTA Mumbai's Taj Mahal Ka Tender              |
|     771 | 3 Sep 21:00          | theatre  | Jyoti Dogra's MEZOK                            |
|     760 | 4 Sep 18:00          | theatre  | Jyoti Dogra's MEZOK                            |
|     761 | 4 Sep 21:00          | theatre  | Jyoti Dogra's MEZOK                            |
|     762 | 5 Sep 18:00          | theatre  | The Primetime Theatre Co.'s GAUHAR             |
|     763 | 5 Sep 21:00          | theatre  | The Primetime Theatre Co.'s GAUHAR             |
|     791 | 6 Sep 11:00          | talks    | CHAI&WHY?@PRITHVI                              |
|     769 | 6 Sep 17:00          | theatre  | The Primetime Theatre Co.'s GAUHAR             |
|     770 | 6 Sep 20:00          | theatre  | The Primetime Theatre Co.'s GAUHAR             |
|     774 | 8 Sep 20:00          | theatre  | Kopal Productions' Sharad Joshi Express        |
|     775 | 9 Sep 20:00          | theatre  | Kopal Productions' Sharad Joshi Express        |
|     772 | 10 Sep 17:00         | theatre  | Poor-Box: THE VAGINA MONOLOGUES IN ENGLISH (A) |
|     773 | 10 Sep 20:00         | theatre  | Poor-Box: THE VAGINA MONOLOGUES IN ENGLISH (A) |
|     764 | 11 Sep 20:00         | theatre  | Rage Productions' ONE ON ONE DHAMAAL           |
|     765 | 12 Sep 17:00         | theatre  | Rage Productions' ONE ON ONE DHAMAAL           |
|     766 | 12 Sep 20:00         | theatre  | Rage Productions' ONE ON ONE DHAMAAL           |
|     767 | 13 Sep 17:00         | theatre  | Rage Productions' ONE ON ONE DHAMAAL           |
|     768 | 13 Sep 20:00         | theatre  | Rage Productions' ONE ON ONE DHAMAAL           |
|     790 | 14 Sep 20:00         | music    | SOI@Prithvi: SYMPHONY ORCHESTRA OF INDIA       |
|     786 | 15 Sep 20:00         | theatre  | Roopkatha Rangmanch's THE JUST                 |
|     788 | 16 Sep 17:00         | theatre  | Roopkatha Rangmanch's MODEL TOWN ''DEEWANEY    |
|     787 | 16 Sep 20:00         | theatre  | Roopkatha Rangmanch's MODEL TOWN ''DEEWANEY    |
|     776 | 17 Sep 20:00         | theatre  | D for Drama: DHUMRAPAAN (A)                    |
|     777 | 18 Sep 20:00         | theatre  | D for Drama's PATNA KA SUPERHERO               |
|     780 | 19 Sep 17:00         | theatre  | Ansh Theatre Group's MANUSHYA                  |
|     781 | 19 Sep 21:00         | theatre  | Ansh Theatre Group's MANUSHYA                  |
|     782 | 20 Sep 16:00         | theatre  | Ansh Theatre Group's Sir Sir Sarla             |
|     783 | 20 Sep 20:00         | theatre  | Ansh Theatre Group's Sir Sir Sarla             |
|     784 | 29 Sep 20:00         | theatre  | Dramarsis' DAAG                                |
|     785 | 30 Sep 20:00         | theatre  | Dramarsis' DAAG                                |

The test suite also proves that missing joins, duplicate native identity,
region drift, unknown genre, off-host registration, impossible time, incomplete
coverage, malformed response, input drift, and invalid clocks all fail before
any record is collected.
