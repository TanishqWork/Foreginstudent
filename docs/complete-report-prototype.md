# Complete report prototype

> Historical raw-text prototype. The current implementation is described in
> [Structured complete report](complete-report-structure.md). The raw timing below
> records an earlier run and does not measure the structured implementation.

The signed-in flow is **Free assessment → Complete report → mock checkout → raw report**.
The checkout charges no money and asks for no card details. This prototype includes
the detailed report only, without revision credits or permanent report history.

## Prompt and model

The client source is `../../prompt data/statement-studio-complete-report-prompt.md`.
The runtime system prompt is `Depth/src/depth/prompts/complete-report-raw.md`.
It adapts the client's detailed assessment instructions for raw text and temporary
memory, removing the JSON output, database envelope, and digest requirements. The
original client documents are unchanged. The complete-report README is guidance;
the free-assessment prompt remains responsible for the free baseline.

`Depth/src/depth/services/complete_report_service.py` calls the shared LLM helper
with literal `model="gpt-5"`. No model environment variable is used. Only
`OPENAI_API_KEY` is required in the existing ignored backend environment file.
The prompt receives the exact original input, full validated free result,
sentence/paragraph references, and selected rubric. It asks the model to preserve
the baseline and expand the reasoning into sentence, paragraph, evidence, prompt,
fit, voice, and revision guidance. Raw prose is not schema-validated; exhaustive
coverage and adherence to every instruction are not mechanically guaranteed.

## Temporary state

`services/assessment_store.py` keeps up to 64 owner-bound assessments in one API
process for one hour. Successful free assessments populate this store; no database
tables, migrations, or report writes were added. The browser remembers only the
latest assessment ID for the signed-in user in session storage. Reports disappear
after expiry, eviction, or an API restart. Use one API process for this prototype.

States are `locked`, `unlocked`, `generating`, `ready`, and `failed`. Mock unlocks
are idempotent. Concurrent generation is rejected; a ready report is reused.
Generation failures retain the unlock so the user can retry. Generation has a
180-second wall timeout. The free assessment has a 220-second total deadline,
including its possible validation repair; both assessment calls allow up to 180
seconds per provider request. Other uses of the shared helper retain its default
90-second timeout. API responses disable HTTP caching.

## API and rendering

All endpoints require the existing signed-in session:

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/assessments/free` | Existing `free-diagnostic.v1` response, now also cached temporarily |
| GET | `/api/assessments/{id}/complete` | State, full free assessment, raw text when ready, elapsed generation seconds, safe error |
| POST | `/api/assessments/{id}/mock-unlock` | Updated state; no real payment |
| POST | `/api/assessments/{id}/complete` | Unchanged report text as `text/plain` |

Metadata uses a small JSON transport envelope; the **LLM report itself is raw
text**. Missing, expired, and other users' IDs return 404; locked generation
returns 403; an active generation returns 409; an unscored baseline returns 422.

`Surface/src/features/complete-report/CompleteReportPage.tsx` renders the original
baseline above one whitespace-preserving text block. It never parses the report
as JSON or HTML. Generation starts from an explicit user action; page loading
only reads status. The sidebar reopens the latest report without another model
request. Copy report copies the original text.

## Checks and debugging

From `Surface`, run `npm test`, `npm run lint`, and `npm run build`.
From `Depth`, run the provider-mocked tests with the local Python environment:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_assessment.py tests/test_complete_report.py tests/test_llm.py -q -p no:cacheprovider
```

The tests exercise state, ownership, expiry, concurrency, failure/retry, cached
reuse, raw transport, and the existing free contract without a live provider or
database. For a browser check, use a fictional form sample, run the free assessment,
follow Unlock complete report, confirm the clearly labelled mock checkout, and
wait for the text. Reopen it from the sidebar to verify reuse. A missing report
after restarting the API is expected: run a fresh free assessment first.

The OpenAI helper consumes streaming events internally and returns only the full
terminal response. The frontend still receives one complete result, and interrupted
or incomplete output is rejected. This avoids waiting on a single silent provider
response for long reports. See the [official streaming guide](https://developers.openai.com/api/docs/guides/streaming-responses).

The page shows measured generation time once ready. No fixed response time is
promised. Logs report safe error types, cause types, and elapsed time rather than
applicant text or credentials.

## Verified locally

On 7 November 2026, the final build passed 62 provider-mocked backend tests and
32 frontend tests, plus frontend lint and the production build. A signed-in
browser run used a fictional 104-word, three-paragraph MPH statement: free result,
mock checkout, unlock, raw GPT-5 generation, Copy report, and sidebar reopening.
The complete report took **69.7 seconds**, contained 24,047 characters, preserved
the original 71/100 provisional result, copied exactly, and reopened unchanged.
The empty and restart-expiry recovery states were also checked. This timing is
one observed run, not a response-time guarantee for other drafts.
