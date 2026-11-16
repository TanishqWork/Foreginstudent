# Structured complete report

The flow is **free assessment → complete report purchase → generate report**.
For now the purchase endpoint marks a $29 paid entitlement; payment-provider
verification is the next integration step. The free assessment is loaded from
`public.assessments`; purchase metadata, paid access, generation attempts, and
successful reports are stored in `public.purchases`,
`public.complete_report_entitlements`, and `public.complete_report_attempts`.

## Response contract

All complete-report GET, purchase, and generation endpoints return the same JSON
state: `assessment_id`, lifecycle `status`, canonical free `assessment`, nullable
structured `report`, generation durations, remaining paid generations, and `error`.
The model returns report content only. The backend supplies the saved assessment
and measured durations. Scores, nulls, exclusions, prompt verdicts, confidence,
and the provisional assessment status remain tied to that original baseline.

The report version is `complete-report.v1`. Section names, order, presentation,
navigation, and empty states belong to React. The model returns typed content,
classifications, source references, and actions rather than UI component names.

| Report field | Repeated content |
| --- | --- |
| `executive_summary` | Argument, strengths, concern, first action, limitations |
| `criterion_details` | Every selected criterion and its four original checkpoints |
| `prompt_coverage.requirements` | Every original prompt requirement |
| `sentence_reviews` | Exactly one review for every source sentence |
| `paragraph_reviews` | Exactly one review for every source paragraph |
| `evidence_gaps` | Every identified evidence gap |
| `program_fit.findings` | Fit findings supported by supplied material |
| `voice_and_originality.findings` | Grounding, defensibility, and writing-pattern findings |
| `unsupported_claims` | Supported claim concerns and verification actions |
| `cut_or_expand` | Cut and expansion recommendations |
| `revision_plan` | Ordered revision tasks and completion checks |
| `limitations`, `discrepancies`, `input_issues`, `coverage` | Uncertainty and completion information |

Array sizes follow the content. There are no fixed six/eight card quotas or UI
truncation. A single component implementation renders once per returned item.
Counts, sentence quality mix, and other derived summaries are calculated from
the data. Extra sentence/paragraph scores and invented readiness percentages are
not introduced to reproduce the old heuristic sample's meters.

The analytical `report_status` is separate from the request lifecycle. A stored
result can be `incomplete` or `review_required`; the UI must display its limitations
clearly and must not describe it as an unqualified complete assessment.

## Unlock prompt on the free result

After the free result renders, an unlock dialog appears once per assessment:
when the student reaches the existing locked-preview section (no earlier than 15
visible seconds) or after 30 seconds of visible reading time, whichever comes
first. The timer pauses while the tab is hidden, and the dialog waits while text
is selected, a field is focused, or another dialog is open. It is not shown for
unscored or `needs_input` results.

Every statement in the dialog comes from the student's own result: score,
weakest category, and riskiest sentence (or main concern). There is no
countdown: free assessments are saved, so a deletion deadline would be untrue.
The call to action opens `/dashboard/complete-report?assessment=<id>&checkout=1`,
which opens the purchase dialog once while the assessment is locked. After the
dialog is closed, a small floating link stays visible until the locked-preview
section is on screen.

## Prompt and validation

The source is the client's `../../prompt data/statement-studio-complete-report-prompt.md`,
especially sections E and G. The runtime prompt is
`Depth/src/depth/prompts/complete-report-structured.md`. The original client files
and earlier `complete-report-raw.md` remain available. The prototype does not add
the client's digest or report-history workflow.

The existing shared helper supplies the Pydantic model as a strict JSON Schema.
`gpt-5` is selected directly in the generation function, with medium reasoning.
The backend validates structure, source IDs/order, exact quotations, baseline
equality, references, and review coverage. It computes coverage counts itself.
The model writes only the analysis, in the `DraftCompleteReport` schema (`schemas/complete_report_draft.py`). Fields that would only repeat the saved free assessment or the statement (baseline scores, labels, checkpoint ratings, prompt-requirement text and verdicts, limit compliance, sentence and paragraph text, coverage, report_version) are not requested; `services/complete_report_assembly.py` fills them from saved data, and an evidence quote that is not in its cited sentence becomes the whole sentence. Validation then checks the analysis: row coverage and order, references, quotes, finding IDs, dispositions, and completeness. A failure inside one section is repaired by regenerating only that section (up to two section repairs, with the rest of the report as context); the whole report is regenerated once only when the draft is unusable or a problem spans sections. Structured output controls
the response shape; it does not prove every explanation is factually correct.
The provider schema requires nonempty adjustment explanations; an unadjusted
criterion explicitly says that no adjustment applies. This prevents a blank
field from needlessly triggering a second full generation.

The helper consumes provider streams internally and returns only a completed
response. The frontend receives one validated JSON result. No frontend streaming
framework or component-definition language is involved.

## Timing and saved state

Both response timing fields measure successful server processing, including any
validation repair. The free assessment's duration is saved with its row and
returned as `generation_seconds` by `GET /api/assessments/{id}/free`. The frontend displays
elapsed time during generation and measured durations afterwards.

Free generation has a 220-second total deadline. `POST /complete` is asynchronous:
it reads the statement and free assessment from `public.assessments`, starts the
model in a background task, and returns `202` with status `generating` (or `200`
with the existing state when the report is already ready). The page then polls
`GET /complete` every 4 seconds until the status is `ready` or `failed`. Each OpenAI
call may take 420 seconds and the whole job, including one repair, 600 seconds.
Stopping the API cancels running jobs and marks them failed. Errors preserve the
paid access for a retry.
API responses disable HTTP caching. Paid access is split across
`public.purchases`, `public.complete_report_entitlements`, and
`public.complete_report_attempts`: one purchase creates one entitlement with two
successful detailed generations, and each AI run is stored as its own attempt.
Failed attempts keep safe error metadata and do not count against the limit.
Successful ready attempts store the detailed report JSON once. A generating
attempt left running for 660 seconds (after a crash or restart) is marked failed
on the next read. Reports survive restarts and reopen from the database.
An explicitly incomplete report has a Retry full report action without consuming
paid access, and baseline-review notices remain explicit.

## Checks

From `Surface`, run `npm test`, `npm run lint`, and `npm run build`.
The development preview `/tests/complete-report-preview.html` uses fictional data
and the real renderer to exercise zero, one, ten, and twenty-five findings.
It makes no assessment or provider requests.

From `Depth`, run:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_assessment.py tests/test_complete_report.py tests/test_complete_report_validation.py tests/test_llm.py -q -p no:cacheprovider
```

For the live scenario, sign in with a disposable local account and submit a
fictional statement. Record the free duration, open Complete report, simulate
payment, and generate the detailed report. Check all sections, source coverage,
the original score, copy output, and sidebar reuse. Record wall time separately
from the sum of server generation times; checkout and navigation add overhead.

## Live browser verification: 7 November 2026

Final checks passed: 98 focused backend tests, 49 frontend tests, frontend lint,
the production build, and `git diff --check`.

The corrected build completed the full signed-in form, purchase dialog, structured
generation, Copy report, and sidebar reopening flow using the fictional MPH
sample (285 words, 15 sentences, five paragraphs).

| Measurement | Observed duration |
| --- | --- |
| Cached free-generation measurement | 134.1 seconds |
| Free endpoint processing header | 134.241 seconds |
| Structured complete report | 192.2 seconds |
| Combined generation time shown in the report | 326.3 seconds (5 minutes 26 seconds) |
| Approximate form submission to result, including test navigation and purchase dialog | 369.7 seconds (6 minutes 10 seconds) |

The form-to-result estimate uses browser submission/button timestamps plus the
server's final generation duration, excluding the later copy/reopen checks.
The small free-timing difference is request/cache overhead and rounding. These
are measurements from one run, not a latency guarantee.

The final result preserved the original 79/100 provisional assessment. The UI
rendered one `complete-report.v1` report, 15 fixed report panels, all nine criteria,
36 checkpoints, 15 sentence reviews, five paragraph reviews, three evidence gaps,
and six revision steps. The readable copy contained 69,973 characters, including
the last source sentence and revision plan. Reopening showed the same content
and durations; the API log recorded one complete-generation POST and subsequent
cached GETs, with no validation repair in the corrected run.

The fixture preview separately rendered exactly 0, 1, 10, and 25 evidence cards,
retained all 15 panels, displayed incomplete/review-required notices, and rendered
literal markup as text. No injected markup element appeared.

An earlier timing trial found a blank adjustment explanation and a dropped
connection during repair (146.0 seconds for free; 178.0 seconds for the failed
report attempt). The provider schema and runtime prompt now prevent that empty
field. Failure preserved the original score and paid access and displayed its
duration without consuming one of the two successful generations. The successful
timings above come from the corrected fresh run.
