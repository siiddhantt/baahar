# EMINDIA live evidence ledger

Reviewed on 19 August 2026. Raw service responses are private and ignored by
Git. This ledger records only non-secret identifiers, hashes, counts, and
verification facts.

## Local gate

The exact worker passed syntax, formatting, and five independent live tests
against the official page. The live source exposed one page, 13 public
occurrences (nine timed and four date-only), and one correctly excluded WECAN
row explicitly marked `By invitation only.` Structural, eligibility, fee,
date, horizon, identity, input, and save-probe mutations all failed before
collection.

## Terminal CLI generation

- Collector: `c_msz1tg0ls3ufml6ls`
- Name: `baahar-emindia-2026`
- Created: `2026-08-18T19:21:25.077Z`
- Status: `failed`
- CLI: `@brightdata/cli` 0.3.5 with `--no-retry`
- Status polls: 120
- Private envelope bytes: 414
- Private envelope SHA-256:
  `8543aa779ced3269c3486ea96be2cde64d317d29f1cc087fb8dd112232c1cece`

The terminal envelope says `AI generation finished with status "failed"`
after listing the intent, planner, collector maintainer, schema, code, input,
and preview stages as completed. There was no CLI/API retry, heal, second
collector, generated repair, production save, or batch trigger. The half-built
collector is frozen for deterministic manual review on the same ID.

## Rejected dashboard preview

The signed-in editor was reduced to one Code stage with the reviewed worker,
an empty parser, the canonical input, and the 27-field schema. Its first manual
preview failed before collection with `Cannot access 'line' before
initialization`. Nothing was saved to production and no batch was triggered.
The tracked worker removed the sandbox-conflicting `line` identifier, and the
live harness now rejects its reintroduction before another dashboard preview.

## Corrected dashboard preview

- Preview: `preview_mszq19vh22s3g5q939`
- Input: the exact canonical URL from `source.yaml`
- Run log: one request, one `load_html`, 13 `collect` calls, one page load, and
  no error
- Downloaded output: 10,240 bytes
- Downloaded output SHA-256:
  `8a4f363de39afeb6e20b575b9aa3ca133050955487c7c7ff4d4ab4d9798d0701`
- Records: 13 schema-valid and source-semantics-valid rows
- Occurrences: nine timed and four date-only across 9-13 September 2026
- Identity: 13 unique fallback tuples; the four repeated Skills School titles
  remain distinct by morning and afternoon start time
- Eligibility: zero WECAN rows

Independent validation confirmed that every preview row has exactly the 27
required contract fields with no missing or extra key, preserves all nine
reviewed null fields, uses `varanasi`, `BHU Varanasi`, and the canonical source
and registration URL, and shares one valid observed timestamp. This is preview
evidence only. It is not an immutable production batch and does not authorize
publication.

The subsequent **Save to development** probe also completed with 13 rows and
one page load. After the reviewed changelog was submitted, the dashboard
confirmed that it saved the template and linked collector and showed the
scraper as active. This did not save a production version.

## Rejected production-save probe

- Preview: `preview_mszq5jecxgo28qfcf`
- Request: the same single canonical URL
- Failure: `tunneling socket could not be established, statusCode=403`
- Stage: before HTML load and before collection
- Result: no production save and no batch trigger

The identical development draft loaded the same page successfully in the two
immediately preceding probes. This isolates the failure to Bright Data's
transport path rather than the reviewed interaction code, schema, or input.
The saved Version 2 development template was subsequently promoted without
another crawl using **Set as production**. The dashboard confirmed
`Development template successfully marked as production`; the same collector
was idle, used a Code worker, and showed no blocking issue.

## Quarantined production batch

- Collection: `j_mszq7kea7160itkzt`
- Trigger response: HTTP 200
- Trigger bytes: 78
- Trigger SHA-256:
  `a27fd6373a30179043570c60e9b838d8ed7ca08b21adaab7e7ce6a680efd0ff8`
- Trigger start ETA: `2026-08-19T06:44:14.842Z`
- Dataset polls: HTTP 202 three times, then HTTP 200
- Pending response bytes: 55 each
- Pending response SHA-256:
  `ff2f8ff073c6aaf37e2601dde6c32c5add156123847cb54ac04ad7a5791d2210`
- Terminal dataset: exact two-byte `[]`
- Terminal SHA-256:
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`

The trigger used the exact one-member manifest input. The terminal array had
zero rows, so there was no input envelope or canonical record to validate. The
batch is quarantined and cannot activate or publish this source. Per the
one-batch gate, no retry, second batch, heal, duplicate collector, or further
dataset poll was made.

The signed-in run dashboard confirmed that collection `j_mszq7kea7160itkzt`
used Template `v2 (prod)`, received one input, and failed its one crawl in the
first stage. It reported zero records, one failed crawl, one fulfilled page, zero page
loads, 29.984 seconds compute, 0% success, and $0 cost. The failed-crawl detail
for the exact canonical input was:

```json
{
  "error": "Crawler error: tunneling socket could not be established, statusCode=403",
  "error_code": "proxy_config"
}
```

The failure occurred before page load, so it is not evidence of an empty source,
the wrong template version, a parser defect, or a canonical-output mismatch.

## Recovery decision

Bright Data's official error guide classifies tunnel/proxy failures as routing
or connection problems and directs persistent cases to support with the scraper
ID, job ID, failed input, and raw error. Its worker guide recommends a Code
worker for static HTML and reserves Browser workers for client rendering or
interaction. The official `request()` reference also says that calling
`request()` on a Browser worker bypasses the browser, so changing only the worker
setting would not test a distinct browser-navigation path.

The single approved recovery path is therefore a Bright Data collection/support
ticket for this same collector and run. Include both successful 13-row
development previews, the failed production-save preview, collection
`j_mszq7kea7160itkzt`, the exact input, and the raw `proxy_config` error. Do not
retry, change country, switch worker, self-heal, recreate, or publish while the
ticket is unresolved.

That issue was submitted through the collector UI as **Collection and Delivery
-> Delivery failure** and attached directly to collection
`j_mszq7kea7160itkzt`. The notes include the collector and URL, successful
preview ID and 13-row/one-page proof, failed production-save preview ID, exact
v2 production-run statistics, raw proxy error, empty-dataset hash, and a request
for the supported Code-worker configuration. The UI confirmed
`Issue successfully submitted`. Submission did not retry or mutate the
collector.

- [Scraper Studio error codes](https://docs.brightdata.com/datasets/scraper-studio/error-codes)
- [Scraper Studio worker types](https://docs.brightdata.com/datasets/scraper-studio/worker-types)
- [Scraper Studio function reference](https://docs.brightdata.com/datasets/scraper-studio/functions)
- [Reporting a scraper issue](https://docs.brightdata.com/datasets/scraper-studio/faqs#how-to-report-issues)

No production output is approved yet. Raw trigger and dataset
responses, if a reviewed production proof is later authorized, belong in the
ignored private evidence directory. Only a separately derived, schema-valid
27-field validation view may be sanitized for tracking.
