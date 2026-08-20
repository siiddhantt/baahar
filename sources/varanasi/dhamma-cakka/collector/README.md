# Dhamma Chakka collector

This is a reviewed single-stage Code worker on collector
`c_mszytcft2j7jjotxcc`. It requests the exact official schedule page once,
parses the complete centre and annual schedule tables, and emits the future
90-day boundary through the shared 27-field contract.

Use [`baahar/contracts/scraper-studio-output-schema.json`](../../../../contracts/scraper-studio-output-schema.json)
as the Scraper Studio presentation schema. This directory deliberately keeps no
copy. One reviewed seven-row development preview passed, but the later
schema-aligned revalidation failed before page load with Bright Data tunnel 403.
The source is blocked; no production promotion or batch exists.

## Operator gate

1. Create at most one Code-worker collector for the exact manifest input.
2. Replace generated code with `worker.js`; keep one Code stage, an empty parser,
   and one canonical input.
3. Require exactly one request and one HTML parse; reject navigation, pagination,
   form submission, fan-out, retry, or generated repair.
4. Preview must show the full current 3..20 row horizon, exact 27 keys, explicit
   nulls, zero duplicate fallback identities, and only reviewed official URLs.
5. Mixed participant availability must remain `registration_state: null`, and
   missing prices must remain unknown.
6. Preview is not publication. A production save and one explicit immutable
   async batch require separate approval after exact output review.

The current 403 stop condition forbids another preview, save, batch, or recovery
attempt without new account-access evidence and explicit review.

An undefined input URL is accepted only for Scraper Studio's internal save probe
and compiles to the exact source constant. Every present input must match the
manifest URL byte-for-byte.
