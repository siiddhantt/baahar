# EMINDIA collector operator checklist

The one permitted CLI create made collector `c_msz1tg0ls3ufml6ls`, then AI
generation ended in terminal status `failed`. Keep this same collector. Do not
retry creation or invoke self-healing.

The reviewed development template was later promoted to production on this same
collector. Its first and only explicit production batch returned an empty
dataset after three pending polls, so the collector remains blocked and must not
be triggered again without a separately reviewed diagnosis and authorization.
The failed production crawl is a Bright Data `proxy_config` tunnel error. Open a
support ticket with the collector/run evidence before considering another
worker or run; the static page and reviewed parser do not justify a Browser
worker change.

A **Collection and Delivery -> Delivery failure** issue is now attached to
collection `j_mszq7kea7160itkzt`. The dashboard confirmed submission. Keep the
source blocked. Bright Data resolved ticket `#723252` by confirming that the
target is not allowlisted for this account and requires Full Access KYC from a
registered business with a company-domain email. This is an account compliance
boundary, not a worker change: no retry, alternate routing, or personal KYC is
part of this source's recovery plan.

## Manual dashboard recovery

1. Open `https://brightdata.com/cp/scrapers/c_msz1tg0ls3ufml6ls` in the
   signed-in control panel and enter the editor for the half-built collector.
2. Reduce the draft to exactly one **Code worker** stage. Paste `worker.js` as
   interaction code and keep parser code empty. Do not retain generated stages,
   alternate routing, retries, browser functions, or wrapper output.
3. Keep exactly one project input row:

   ```json
   {
     "url": "https://www.galaxyregistration.com/event/skill-school/"
   }
   ```

4. In **Output schema -> Edit schema**, replace the generated schema with
   `../../../../contracts/scraper-studio-output-schema.json`: exactly 27 active
   canonical fields, explicit null defaults for unknowns, and no `input`,
   wrapper, description, or extra field.
5. Run an explicit preview for that one canonical input. Require one page load,
   13 collect calls and 13 output rows: nine `timed`, four `date`, zero WECAN,
   exact `BHU Varanasi`, and no error.
6. Inspect the entire preview, not only the first row. Every row must have the
   exact 27 keys; all nulls must be preserved; all 13 fallback identities must
   be unique; repeated course titles must differ by morning/afternoon time.
7. If the UI proposes a schema update, apply only the reviewed 27-field schema.
   `Finish editing` may run a separate undefined-input save probe; it must still
   request the one compiled URL and produce the same 13 rows.
8. Only after explicit preview and save probe both pass, choose **Save to
   production** and add a concise reviewed changelog note. Stop without saving
   on any selector, count, schema, null, input, request, or identity drift.
9. After production save, run one explicit async API batch with the exact
   manifest input. Do not retry, heal, or create a duplicate on failure.
10. Preserve trigger and raw dataset bytes privately before producing any
    sanitized validation view. Backend publication is a separate gate.

The worker accepts an undefined URL only for Scraper Studio's deterministic
save probe. Every production trigger must carry the exact explicit input, and
backend transport validation must reject an absent or different input.
