# Source documentation template

Use this template for every source that moves beyond discovery. Keep the files
factual, concise, and independently reviewable. Do not use them as a task log or
conversation transcript.

## `source.yaml`

The manifest is the machine-readable policy. It owns:

- stable source and city identity;
- canonical input URL and allowed hosts;
- worker type and request, page, action, record, and horizon limits;
- health thresholds;
- collector ID and explicit publication/collection state.

The manifest must not claim `active` or `verified` before the application
publication gates pass.

## `RESEARCH.md`

Use these headings in this order:

1. `# <Source> research`
2. `## Product value`
3. `## Authority and access`
4. `## Transport and inventory`
5. `## Risks and stop conditions`

Record dated source facts, robots/terms findings, pagination or API shape, exact
inventory boundaries, and why the source is useful. Avoid implementation TODOs.

## `MAPPING.md`

Use these headings in this order:

1. `# <Source> mapping`
2. `## Source boundary`
3. `## Canonical mapping`
4. `## Identity and ordering`
5. `## Validation and atomicity`

Map only facts present in the source. State how unknowns remain `null` or empty,
how occurrence identity survives ordinary content changes, and which drift must
fail the full batch.

## `collector/README.md`

Keep this as a short operator guide:

- collector ID, canonical input, and worker type;
- exact tracked worker/schema installation boundary;
- preview and production expectations;
- request/page/action limits;
- rollback and same-ID repair instructions.

The dashboard and this folder must describe the same deployed revision.

## `evidence/README.md`

Append one dated section for each material external transition:

- local qualification;
- Studio Development preview;
- Production save and immutable batch;
- application publication and replay;
- failure, repair review, approval, or rollback.

For each transition, record only durable proof: collector/preview/collection/run
IDs, version, inputs, request/page/output counts, HTTP outcome, byte size,
SHA-256, schema/semantic result, and whether production changed. Do not include
credentials, private payloads, machine-specific paths, or unreviewed speculation.

## Required gates

- worker syntax and focused live/mutation harness;
- authoritative 27-field Go validation;
- exact request/page/action/input and identity assertions;
- reviewed Development preview;
- immutable production artifact validation;
- idempotent application publication and replay;
- public feed, detail, source, and calendar checks.
