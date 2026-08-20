# Prithvi Theatre Scraper Studio worker

Use a **Code** worker with one input:

```json
{
  "url": "https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV"
}
```

Paste `worker.js` into the worker editor and use the repository-wide
`contracts/scraper-studio-output-schema.json` as the output schema. Keep default
routing. Do not add a Browser stage, pagination, detail fan-out, or a second
input.

The reviewed implementation is installed on collector
`c_mt1qtstu9kmw95k4q` as exactly one Code stage with an empty parser and the
shared 27-field schema. The redundant generated stage was deleted. Development
preview `preview_mt1scuki642uv3x7g` returned 49 exact rows from one request;
the Development save and Production save repeated the same 49-row/no-error
gate. Production batch `j_mt1sl5pg1t6ag3miax` then delivered 49 validated rows
in 63,009 bytes (SHA-256
`aeb3fb59126eb1d68d55738fbe2c7db482dfc10264d42428a363496354020d42`).

Do not create a duplicate or add stages, parser code, pagination, fan-out,
retries, inferred fields, or alternate inputs. The guarded backend activation,
immutable replay, Mumbai API, and frontend acceptance are recorded in
`../evidence/README.md`.

Local proof:

```text
node --check sources/mumbai/prithvi-theatre/collector/worker.js
npm --prefix tests/live run test:prithvi-theatre
go test ./internal/collections ./internal/sources
```
