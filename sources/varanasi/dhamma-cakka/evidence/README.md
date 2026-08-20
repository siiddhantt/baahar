# Dhamma Chakka evidence

## Local qualification — 19 August 2026

The official centre page returned HTTP 200 as static HTML in one request. Its
raw response contained one centre table, complete 2026 and 2027 schedule tables,
and no pagination. The reviewed 90-day boundary produced seven date-only
occurrences from 28 August through 11 November 2026.

The focused live harness verifies the request/page budget, raw-table coverage,
exact mapped rows, shared Draft 2020-12 schema, official application URLs,
fallback identities, and atomic structural/date/input failures. This is local
qualification only.

The frozen local gate passed 6/6 focused tests plus `node --check`, the strict
repository manifest test, and Prettier. The dated fetch was 48,687 bytes with
10 + 18 annual source rows; the seven canonical records had SHA-256
`6bf55c39d5e571c14454e5d19773f152e757854f3bcf7f4f0944c1fac69887aa`.
Drupal emits changing view-instance IDs, so the complete live HTML hash is
diagnostic rather than a frozen baseline.

## Bright Data create gate — 19 August 2026

The exact non-secret prompt is tracked in `../collector/create-prompt.txt`. One
initial CLI process stopped locally before authentication with `No API key
found`; it created no template, envelope, or external state.

Exactly one authenticated create was then issued with official
`@brightdata/cli` 0.3.5 and `--no-retry`:

- collector ID: `c_mszytcft2j7jjotxcc`;
- name: `baahar-dhamma-cakka`;
- created: `2026-08-19T10:45:07.769Z`;
- terminal status: `failed` after 22 poll attempts;
- completed step: `prepare_intent_analyzer`;
- terminal error: `AI generation finished with status "failed".`;
- view: `https://brightdata.com/cp/scrapers/c_mszytcft2j7jjotxcc`;
- private immutable envelope: 298 bytes, SHA-256
  `8fe09805475f587d3b90a7c18946aea1fa22ade9182c6dfbb7c152fb35915e7b`.

No generated interaction or parser template was returned, so there is no
generated AI output to approve or inspect. The half-built same-ID collector
remained the sole collector of record. No duplicate, retry, heal, or other
collector call occurred during creation.

## Same-ID Studio recovery and stop gate — 19 August 2026

The reviewed worker was installed manually on the same collector. Its
CRLF-normalized editor copy equalled the tracked worker exactly, with SHA-256
`47344b6d8143f0c32e97ba912c9a6f94f765347dd0faa633e5586f6db710c022`.
The collector had one Code stage, an empty parser, screenshots disabled, and one
canonical URL input.

The first explicit preview, `preview_mszz2ww52eub5hx1ly`, passed with exactly
one request, one `load_html`, seven `collect` calls, and one total page load. Its
export at `C:\Users\Sid\Downloads\lines (2).json` was 5,507 bytes with SHA-256
`c21c302f94f45ef9c2c7d046e045d0168b21edfa197c179a98fb6ce12e4653b7`.
All seven rows had one uniform exact 27-key shape and passed the authoritative
Go schema. They preserved the reviewed titles, dates, and first-party Apply
URLs:

- 3 Day Course — 28–31 August;
- 10 Day Course — 3–14 September and 18–29 September;
- 10 Day Special Course — 3–14 October;
- 10 Day Course — 18–29 October;
- STP Course — 30 October–7 November;
- 30 Day Course — 11 November–12 December.

`Finish editing` created draft `mszyyw6v22ogzvpjt0` and saved the new template.
The authoritative schema was then installed with 27 active fields; nullable
added fields defaulted to null. Schema Save showed the expected incompatible
update confirmation and navigated to collector statistics.

The schema-aligned revalidation preview, `preview_mszzjptf13xxnaa319`, failed
before page load and before any collection with
`Crawler error: tunneling socket could not be established, statusCode=403`.
This reached the stop condition. It resembles the account-whitelist diagnosis
Bright Data gave for another source in ticket `#723252`; applying that diagnosis
to this host is an inference, not a new support confirmation.

No production promotion, async batch, API trigger, retry, heal, duplicate, or
backend registration followed. The valid preview is presentation evidence, not
production data. The source remains `preview` and is blocked by
`account_whitelist_proxy_config_403`.
