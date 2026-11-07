# Structured complete report

The flow is **free assessment → complete report → mock checkout → generate report**.
Checkout is simulated and charges no money. Reports use the existing owner-bound
temporary memory cache; no report database tables or migrations were added.

## Response contract

All complete-report GET, unlock, and generation endpoints return the same JSON
state: `assessment_id`, lifecycle `status`, canonical free `assessment`, nullable
structured `report`, `generation_seconds`, `free_generation_seconds`, and `error`.
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

## Prompt and validation

The source is the client's `../../prompt data/statement-studio-complete-report-prompt.md`,
especially sections E and G. The runtime prompt is
`Depth/src/depth/prompts/complete-report-structured.md`. The original client files
and earlier `complete-report-raw.md` remain available. The temporary prototype
does not add the client's production database, digest, or permanent-history workflow.

The existing shared helper supplies the Pydantic model as a strict JSON Schema.
`gpt-5` is selected directly in the generation function, with medium reasoning.
The backend validates structure, source IDs/order, exact quotations, baseline
equality, references, and review coverage. It computes coverage counts itself.
One bounded repair is allowed for an invalid report. Structured output controls
the response shape; it does not prove every explanation is factually correct.
The provider schema requires nonempty adjustment explanations; an unadjusted
criterion explicitly says that no adjustment applies. This prevents a blank
field from needlessly triggering a second full generation.

The helper consumes provider streams internally and returns only a completed
response. The frontend receives one validated JSON result. No frontend streaming
framework or component-definition language is involved.

## Timing and temporary state

Both response timing fields measure successful server processing, including any
validation repair. The free endpoint also returns `X-Generation-Seconds` without
changing the existing `free-diagnostic.v1` JSON envelope. The frontend displays
elapsed time during generation and measured durations afterwards.

Free generation has a 220-second total deadline. Structured complete generation
has a 270-second total deadline. API errors preserve the mock unlock for a retry.
Ready results are reused without another model request. API responses disable
HTTP caching. Reports expire after one hour, capacity eviction, or API restart;
active generation is pinned. This prototype uses one API process.
Failed attempts retain the unlock and show their measured duration. An explicitly
incomplete report has a Retry full report action; a completed report reopens from
cache, and baseline-review notices remain explicit.

## Checks

From `Surface`, run `npm test`, `npm run lint`, and `npm run build`.
The development preview `/tests/complete-report-preview.html` uses fictional data
and the real renderer to exercise zero, one, ten, and twenty-five findings.
It makes no assessment or provider requests.

From `Depth`, run:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_assessment.py tests/test_complete_report.py tests/test_llm.py -q -p no:cacheprovider
```

For the live scenario, sign in with a disposable local account and submit a
fictional statement. Record the free duration, open Complete report, simulate
payment, and generate the detailed report. Check all sections, source coverage,
the original score, copy output, and sidebar reuse. Record wall time separately
from the sum of server generation times; checkout and navigation add overhead.

## Live browser verification: 7 November 2026

Final checks passed: 98 focused backend tests, 49 frontend tests, frontend lint,
the production build, and `git diff --check`.

The corrected build completed the full signed-in form, mock checkout, structured
generation, Copy report, and sidebar reopening flow using the fictional MPH
sample (285 words, 15 sentences, five paragraphs).

| Measurement | Observed duration |
| --- | --- |
| Cached free-generation measurement | 134.1 seconds |
| Free endpoint processing header | 134.241 seconds |
| Structured complete report | 192.2 seconds |
| Combined generation time shown in the report | 326.3 seconds (5 minutes 26 seconds) |
| Approximate form submission to result, including test navigation and mock checkout | 369.7 seconds (6 minutes 10 seconds) |

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
field. Failure preserved the original score and mock unlock and displayed its
duration. The successful timings above come from the corrected fresh run.
