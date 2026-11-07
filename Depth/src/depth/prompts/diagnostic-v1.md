# Free diagnostic v1 transport extension

Preserve all assessment rules and the complete section-10 report above. For this
integration, return the enforced `AssessmentEvaluation` object, with exactly:

- `report`: the entire section-10 assessment report.
- `evidence_gap`: `{ "summary": string, "quote": string or null, "sentence_ids": string[] }`.
- `evidence_examples`: an array of `{ "id": string, "sentence_ids": string[], "summary": string }`.

This wrapper supersedes the instruction to return the bare report. Do not emit
UI names, schema versions, HTML, or layout instructions. The server owns them.

An evidence example is one distinct experience developed with the applicant's
own action and a linked outcome, consequence, or learning. Several sentences
about the same experience are one example. Do not count background facts, titles,
claims without development, or a list of methods as examples. Use stable unique
IDs such as e1 and cite exact host sentence IDs. Do not duplicate an experience
with a different ID. The array may be empty. The server derives its count.

`evidence_gap.summary` identifies the most useful remaining evidence development
or says no material evidence gap was identified. A gap quote, when useful, must
equal one full source sentence referenced by `sentence_ids`. Use null and an
empty list for an absence-level finding. Do not manufacture a weak sentence.

For unusable input (instructions alone, placeholders, unrelated content), set
report.status to needs_input and explain the issue in report.input_issues. Do
not supply a total. Report honest qualitative findings with empty evidence arrays
and null sentence quotes where appropriate.
