# Free assessment response structure

The implementation uses one versioned response and one matching React page renderer. The AI supplies judgments and feedback; FastAPI validates evidence and calculates scores; React turns the fields into cards.

`free-diagnostic.v1` maps to `FreeDiagnosticV1` through the small `DiagnosticResult` switch. All pathways and document types share this renderer. Repeated findings and score bars reuse its internal components.

## Public API envelope

`POST /api/assessments/free` returns `application/json` with `Cache-Control: no-store`. Authentication is unchanged. The server supplies the version and context snapshot:

```text
{
  schema_version: "free-diagnostic.v1",
  context: { pathway, degree, field, target_institution, target_program, statement_type },
  report: { ...the complete canonical free assessment },
  diagnostic: {
    revision_opportunity,
    pathway_observation,
    evidence_gap: { summary, quote, sentence_ids },
    evidence_examples: [{ id, sentence_ids, summary }]
  }
}
```

The AI transport uses `{ report, evidence_gap, evidence_examples }`, enforced by `AssessmentEvaluation`. Backend calculations replace the report's derived fields before the public envelope is constructed. The separate `rubric_version` identifies scoring rules. Styling changes do not require a new response version; incompatible field changes do.

## Debugging without an AI request

With the existing Vite development server, open [the fixture preview](http://localhost:5173/tests/diagnostic-preview.html). It renders the actual V1 component using a fictional backend-validated response. The selector exercises complete, provisional, needs-input, null sentence, and unsupported-version states. The preview is outside the production application entry point and makes no assessment or authentication requests.

- Full sample JSON: [free-diagnostic.v1.json](../Surface/tests/fixtures/free-diagnostic.v1.json).
- Backend contract: [assessment_report.py](../Depth/src/depth/schemas/assessment_report.py).
- Source checks and calculator: [assessment_scoring.py](../Depth/src/depth/services/assessment_scoring.py).
- Provider orchestration and one repair attempt: [assessment_service.py](../Depth/src/depth/services/assessment_service.py).
- Frontend boundary: [response.ts](../Surface/src/features/assessment/diagnostic/response.ts).
- Single renderer: [DiagnosticResult.tsx](../Surface/src/features/assessment/diagnostic/DiagnosticResult.tsx).

Backend validation logs only field paths and reason codes, never the submitted draft or provider response. The frontend logs `DiagnosticResponseError.field` while displaying a safe retry message. Unknown versions are rejected. Invalid output gets one repair attempt, then a 502 rather than an invented report. A null score is displayed as unavailable.

The interactive assessment selects `model="gpt-5"` directly in `run_free_assessment` and uses medium reasoning. The API key stays in the ignored backend environment file. Provider requests use a 90-second network timeout with automatic SDK retries disabled; only the explicit validation repair can make a second generation. Provider failures log exception type, HTTP status, and an allowlisted error code. Incomplete responses log a safe status/reason, such as `max_output_tokens`, so operational failures can be diagnosed without exposing content.

From `Surface`, run `npm test`, `npm run lint`, and `npm run build`. From `Depth`, run `.venv\Scripts\python.exe -m pytest tests/test_assessment.py tests/test_llm.py -q -p no:cacheprovider`. These focused assessment tests require no database or paid provider requests.

## Reuse the existing contract

The canonical JSON shape is already in [free-assessment.md, section 10](../Depth/src/depth/prompts/free-assessment.md). Preserve its field names and rubric version, `ss-free-ai-draft-1.0`.

Supporting files:

- [Free page renderer](../../statement-studio-developer-handoff/dist/app.js): `renderDiagnostic`.
- [Rubric](../../prompt%20data/statement-studio-rubric.json): dimensions, weights, and checkpoints.
- [Reference calculator](../../prompt%20data/statement-studio-scoring.mjs): arithmetic, caps, deductions, bands, rankings, and recommendations.
- [Free integration guide](../../prompt%20data/DEVELOPER-README.md).

The local demo uses keyword heuristics. The AI rubric preserves the 70/30 architecture and core thresholds, with additional checkpoint and missing-context rules. The engines need not produce identical scores.

## Replaced raw-text flow

Previously the route returned `PlainTextResponse`, and React displayed `response.text()` inside `<pre>`. The provider now receives an enforced output schema, the service validates/calculates the report, and React parses the JSON before switching from the form to the result screen. Returning to the form preserves the draft.

## Field-to-component map

| React section | Existing JSON fields | Display rule |
| --- | --- | --- |
| Overall score ring and band | `overall_score`, `assessment_band` | Null means unavailable, never 0/100. |
| Status and confidence | `status`, `confidence`, `scored_weight`, `renormalized`, `missing_context`, `input_issues` | Show provisional limitations with the score. |
| Two strengths | `strongest_categories` | Category label, score out of 100, reason. |
| Two weaknesses | `weakest_categories`, `ranking_note` | Use backend ranking and distinct categories. |
| What lands | `strongest_sentence` | Exact quote, paragraph number, explanation. Handle null quotes. |
| What weakens confidence | `riskiest_sentence` | Exact quote and explanation. Null can mean no sentence-specific concern. |
| Still unanswered | `prompt_requirements_status`, `missing_prompt_requirements`, `uncertain_prompt_requirements` | List missing/partial items and next actions. Unknown coverage means it could not be checked. |
| Main concern | `main_concern` | Title, explanation, first action. |
| Refine/Rebuild | `recommendation` | Path, reason, next action, provisional status. |
| Revision actions | `priority_actions` | Short ordered list. |
| Counts and length warning | `measurements`, `limit_compliance` | Backend measurements and compliance. |
| Verification concerns | `integrity_flags`, `verification_limits`, `score_meaning` | Separate from the numeric score. |
| Optional category details | `dimensions`, `adjustments` | Score, reason, next action, checkpoint evidence, applied adjustment. |

The API retains the complete contract, including audit fields. The free page selects the fields it needs.

## Small response excerpt

This illustrates fields inside `response.report` only. It is not a complete model response or a scored applicant example; the full fixture linked above includes the actual envelope and every report field. Scores and copy below are fictional.

```json
{
  "assessment_id": "example-assessment",
  "rubric_version": "ss-free-ai-draft-1.0",
  "status": "complete",
  "overall_score": 70,
  "assessment_band": "Credible draft",
  "strongest_categories": [
    {"dimension_id": "promptAlignment", "label": "Prompt alignment", "score": 75, "reason": "The requested topics are addressed."},
    {"dimension_id": "proseControl", "label": "Prose control", "score": 75, "reason": "The writing communicates its main ideas clearly."}
  ],
  "weakest_categories": [
    {"dimension_id": "programFit", "label": "Program and faculty fit", "score": 55, "reason": "Program features need a clearer connection to the applicant's learning needs."},
    {"dimension_id": "throughlineStructure", "label": "Throughline and structure", "score": 65, "reason": "The experiences need a clearer organizing argument."}
  ],
  "main_concern": {
    "title": "Connect program features to your learning needs",
    "explanation": "Explain how the training addresses a gap established by your experience.",
    "dimension_ids": ["programFit"],
    "sentence_ids": [],
    "first_action": "Choose one relevant program feature and explain the capability it would help you develop."
  },
  "recommendation": {
    "path": "Refine",
    "provisional": false,
    "triggered_rules": [],
    "reason": "The overall, prompt, and structure scores do not trigger a Rebuild rule.",
    "next_action": "Strengthen program fit, then tighten the throughline."
  }
}
```

## Calculation ownership

**AI:** checkpoint ratings and applicability; prompt coverage; evidence references; sentence selection; explanations; confidence; main concern; revision actions.

**FastAPI:** trusted ID and profile; weights; counts and sentence IDs; exact quote checks; category scores; caps/deductions; overall score; band; rankings; eligibility/status rules; Refine/Rebuild thresholds. Ensure narrative explanations agree with the calculated result.

The current prompt asks the AI for the whole report, including calculated fields. Keep that contract, then recompute derived fields server-side. Structured JSON establishes shape, not correct arithmetic, factual truth, or valid source quotes.

The supplied calculator defines category rounding to increments of five, weighted totals, and missing-context handling. Rebuild applies when eligible overall score is below 55, scored prompt alignment is below 45, or scored throughline/structure is below 45. Otherwise the eligible path is Refine. An ineligible assessment has null score and path.

## Exact handoff widgets

- Revision opportunity is derived from the trusted overall score: 85+ Low; 70-84 Moderate; 55-69 High; below 55 Foundational. Leave unavailable when the score is null. This describes revision work, not a promised future score.
- Pathway guidance can use frontend copy keyed by the submitted pathway. Applicant-specific feedback already exists in the assessment findings.
- The V1 extension defines one evidence example as a distinct experience with the applicant's action and a linked outcome, consequence, or learning. Its source sentence IDs are checked; duplicate IDs/source groups are rejected. The page counts `diagnostic.evidence_examples`, rather than counting quoted sentences. Assessing whether separate examples are semantically distinct remains an AI judgment.

## Implementation sequence

1. Define Pydantic response models for the existing contract. Request OpenAI Structured Outputs for a compatible configured model, preserving the rubric and separating applicant data.
2. Validate selected dimensions, four checkpoints each, rating ranges, sentence/paragraph references, exact quotes, and requirement references.
3. Implement the reference calculator's rules in a Python scoring service. Compare results against its supplied fixtures. Merge calculated fields with validated narrative findings by dimension ID.
4. Follow the prompt's one-repair-attempt policy for invalid output, then return an assessment error if it still fails. Keep the draft available for retry.
5. Return `application/json` with a declared FastAPI response model and the existing `Cache-Control: no-store` behavior.
6. Add the matching TypeScript type. Use `response.json()` and assessment-object-or-null state.
7. Render `FreeAssessmentReport` with the sections above and explicit loading, failure, provisional, and needs-input states.

Official API reference: [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Refusals and incomplete generations still need error handling.

## Full report boundary

The React full sample is a static local-demo snapshot with more fields than the free contract. An existing [complete report contract](../../prompt%20data/statement-studio-complete-report-README.md) defines the expanded AI report.

Its server envelope is `{ assessment_snapshot: storedValidatedFreeAssessment, report: validatedExpansion }`. It expands the original canonical assessment, preserving its scores and findings. Payment does not rerun scoring. Its sentence/paragraph quality labels are qualitative; the local demo's additional numeric scores must not be invented from the free response.
