"""Complete-report contract checks: baseline consistency, source references, and completeness."""

import json

import pytest
from pydantic import ValidationError

from complete_report_fixture import draft_of, example_complete_report, make_source
from depth.schemas.complete_report_content import CompleteReportContent
from depth.schemas.complete_report_draft import DraftCheckpointExplanation, DraftCompleteReport
from depth.services.complete_report_assembly import assemble_report
from depth.services.complete_report_validation import validate_complete_report


def test_all_sections_dynamic_arrays_and_host_coverage():
    entry = make_source()
    for count in [0, 1, 10, 25]:
        report = example_complete_report(entry, count)
        assert len(report.evidence_gaps) == count
        assert report.coverage.expected_sentences == report.coverage.reviewed_sentences == 5
        assert report.coverage.expected_paragraphs == report.coverage.reviewed_paragraphs == 2
        assert report.coverage.expected_criteria == report.coverage.reviewed_criteria == 9
        assert all(len(item.checkpoints) == 4 for item in report.criterion_details)
    assert {"executive_summary", "criterion_details", "prompt_coverage", "sentence_reviews", "paragraph_reviews",
            "evidence_gaps", "program_fit", "voice_and_originality", "unsupported_claims", "cut_or_expand",
            "revision_plan"} <= CompleteReportContent.model_fields.keys()
    schema = CompleteReportContent.model_json_schema()
    assert "maxItems" not in json.dumps(schema)


def test_provider_schema_rejects_empty_adjustment_explanations_before_guard():
    payload = example_complete_report(make_source()).model_dump()
    for blank in ["", " \n\t"]:
        payload["criterion_details"][0]["recorded_adjustment_explanation"] = blank
        with pytest.raises(ValidationError, match="string_pattern_mismatch"):
            CompleteReportContent.model_validate(payload)
    provider_schema = CompleteReportContent.model_json_schema()
    field = provider_schema["$defs"]["CriterionDetail"]["properties"]["recorded_adjustment_explanation"]
    assert field["pattern"] == r"\S"


@pytest.mark.parametrize("change,code", [
    (lambda r: r.criterion_details.pop(), "missing_source_rows"),
    (lambda r: r.sentence_reviews.pop(), "missing_source_rows"),
    (lambda r: r.paragraph_reviews.pop(), "missing_source_rows"),
    (lambda r: r.sentence_reviews.append(r.sentence_reviews[0]), "duplicate_source_id"),
    (lambda r: setattr(r.evidence_gaps[0].evidence[0], "quote", "private-source-sentinel"), "quote_mismatch"),
    (lambda r: setattr(r.evidence_gaps[0], "criterion_ids", ["private-source-sentinel"]), "invalid_reference"),
    (lambda r: setattr(r.revision_plan[0], "depends_on", ["step:1"]), "dependency_order"),
    (lambda r: setattr(r.revision_plan[0], "related_finding_ids", ["private-source-sentinel"]), "invalid_reference"),
    (lambda r: r.evidence_gaps.append(r.evidence_gaps[0]), "duplicate_identifier"),
    (lambda r: setattr(r.sentence_reviews[0], "action", "preserve"), "disposition_action_mismatch"),
    (lambda r: setattr(r.criterion_details[0].checkpoints[0], "explanation", "  "), "blank_narrative"),
])
def test_guard_rejects_missing_rows_bad_refs_and_quotes(change, code):
    entry = make_source()
    report = example_complete_report(entry)
    change(report)
    with pytest.raises(ValueError, match=code) as caught:
        validate_complete_report(report, entry)
    assert "private-source-sentinel" not in str(caught.value)


def test_incomplete_and_review_required_are_preserved_honestly():
    entry = make_source()
    report = example_complete_report(entry)
    report.report_status = "incomplete"
    report.input_issues = ["The final sentence has not been reviewed."]
    report.sentence_reviews.pop()
    validated = validate_complete_report(report, entry)
    assert validated.report_status == "incomplete"
    assert validated.coverage.reviewed_sentences == 4
    assert validated.coverage.unreviewed_sentence_ids == ["s5"]
    report = example_complete_report(entry)
    report.report_status = "review_required"
    from depth.schemas.complete_report_content import Discrepancy
    report.discrepancies = [Discrepancy(finding_id="discrepancy:1", baseline_field="/main_concern",
                                      issue="The baseline finding needs human review.", evidence=[],
                                      resolution_needed="Check the cited baseline concern.")]
    assert validate_complete_report(report, entry).report_status == "review_required"
    report.report_status = "ready"
    with pytest.raises(ValueError, match="ready_has_discrepancies"):
        validate_complete_report(report, entry)


def test_criterion_review_requires_its_matching_baseline_discrepancy():
    from depth.schemas.complete_report_content import Discrepancy
    entry = make_source()
    report = example_complete_report(entry)
    report.report_status = "review_required"
    report.criterion_details[0].explanation_status = "review_required"
    report.discrepancies = [Discrepancy(finding_id="discrepancy:1", baseline_field="/main_concern",
                                      issue="This concern needs review.", evidence=[], resolution_needed="Review the actual criterion.")]
    with pytest.raises(ValueError, match="unmatched_discrepancy"):
        validate_complete_report(report, entry)
    report.discrepancies[0].baseline_field = "/dimensions/0/checkpoints/0"
    assert validate_complete_report(report, entry).report_status == "review_required"


def test_ready_report_requires_an_actionable_revision_step():
    entry = make_source()
    report = example_complete_report(entry)
    report.revision_plan = []
    with pytest.raises(ValueError, match="revision_plan:missing_required_steps"):
        validate_complete_report(report, entry)


@pytest.mark.parametrize("field", ["criterion_details", "sentence_reviews", "paragraph_reviews", "prompt_requirements"])
def test_source_backed_findings_require_canonical_link_ids(field):
    entry = make_source()
    report = example_complete_report(entry)
    rows = report.prompt_coverage.requirements if field == "prompt_requirements" else getattr(report, field)
    rows[0].finding_id = "custom:private-identifier-sentinel"
    with pytest.raises(ValueError, match="canonical_finding_id") as caught:
        validate_complete_report(report, entry)
    assert "private-identifier-sentinel" not in str(caught.value)


@pytest.mark.parametrize("field,bad_id", [("evidence_gaps", "custom:1"), ("evidence_gaps", "gap:"),
                                        ("cut_or_expand", "claim:1"), ("revision_plan", "step: ")])
def test_diagnostic_findings_require_their_group_prefix_and_suffix(field, bad_id):
    entry = make_source()
    report = example_complete_report(entry)
    getattr(report, field)[0].finding_id = bad_id
    with pytest.raises(ValueError, match="finding_id_prefix"):
        validate_complete_report(report, entry)


def test_cut_cannot_contradict_keep_unless_paragraph_reconstruction_is_documented():
    entry = make_source()
    report = example_complete_report(entry)
    kept_sentence = report.sentence_reviews[1]
    assert kept_sentence.disposition == "Keep" and kept_sentence.action == "preserve"
    edit = report.cut_or_expand[0]
    edit.operation = "cut"
    edit.sentence_ids = [kept_sentence.sentence_id]
    with pytest.raises(ValueError, match="cut_or_expand.0.sentence_ids:keep_cut_conflict"):
        validate_complete_report(report, entry)
    paragraph = next(row for row in report.paragraph_reviews if row.number == kept_sentence.paragraph)
    paragraph.disposition, paragraph.action = "Rebuild", "rebuild"
    paragraph.explanation = "This paragraph requires reconstruction; preserve its useful source material in the new argument."
    paragraph.revision_direction = "Reconstruct the paragraph's reasoning and omit material that no longer serves its role."
    assert validate_complete_report(report, entry).report_status == "ready"


def test_the_model_schema_has_no_host_filled_fields():
    schema = json.dumps(DraftCompleteReport.model_json_schema())
    for field in ["prompt_quote", "limit_compliance", "overall_score", "assessment_band", "main_concern_title",
                  "weighted_points", "level_label", "report_version", '"coverage"', '"text"', '"number"']:
        assert field not in schema, field
    # Checkpoint ratings come from the baseline; the model only explains them.
    assert set(DraftCheckpointExplanation.model_fields) == {"index", "explanation", "evidence"}


def test_assembly_fills_every_copied_field_from_saved_data():
    entry = make_source()
    expected = example_complete_report(entry, 3)
    assembled = assemble_report(draft_of(expected), entry)
    assert validate_complete_report(assembled.report, entry) == expected
    assert assembled.quotes_restored == 0


def test_evidence_quotes_and_paragraphs_come_from_the_cited_sentence():
    entry = make_source()
    expected = example_complete_report(entry)
    draft = draft_of(expected)
    draft.evidence_gaps[0].evidence[0].quote = "A quote that is not in the sentence."
    draft.evidence_gaps[0].evidence[0].paragraph = 9
    assembled = assemble_report(draft, entry)
    assert assembled.quotes_restored == 1
    assert validate_complete_report(assembled.report, entry) == expected
    phrase = expected.evidence_gaps[0].evidence[0].quote.split()[0]
    draft = draft_of(expected)
    draft.evidence_gaps[0].evidence[0].quote = phrase  # A phrase from the cited sentence is kept.
    assert assemble_report(draft, entry).report.evidence_gaps[0].evidence[0].quote == phrase


@pytest.mark.parametrize("change,code", [
    (lambda d: setattr(d.sentence_reviews[0], "sentence_id", "s99"), "sentence_reviews.0.sentence_id:invalid_reference"),
    (lambda d: setattr(d.paragraph_reviews[0], "paragraph_id", "p9"), "paragraph_reviews.0.paragraph_id:invalid_reference"),
    (lambda d: setattr(d.criterion_details[0], "dimension_id", "unknown"), "criterion_details.0.dimension_id:invalid_reference"),
    (lambda d: setattr(d.prompt_coverage.requirements[0], "requirement_id", "r9"), "prompt_coverage.requirements.0.requirement_id:invalid_reference"),
    (lambda d: setattr(d.criterion_details[0].checkpoints[0], "index", 9), "criterion_details.0.checkpoints.0.index:checkpoint_coverage"),
])
def test_unknown_ids_cannot_be_filled_and_name_their_section(change, code):
    entry = make_source()
    draft = draft_of(example_complete_report(entry))
    change(draft)
    with pytest.raises(ValueError, match=code.replace(".", r"\.")):
        assemble_report(draft, entry)


@pytest.mark.parametrize("change,code", [
    (lambda r: r.criterion_details.pop(), "missing_source_rows"),
    (lambda r: r.sentence_reviews.pop(), "missing_source_rows"),
    (lambda r: r.sentence_reviews.append(r.sentence_reviews[0]), "duplicate_source_id"),
    (lambda r: setattr(r.evidence_gaps[0], "criterion_ids", ["unknown"]), "invalid_reference"),
    (lambda r: setattr(r.evidence_gaps[0].evidence[0], "sentence_id", "s99"), "quote_mismatch"),
    (lambda r: setattr(r.sentence_reviews[0], "action", "preserve"), "disposition_action_mismatch"),
    (lambda r: setattr(r.criterion_details[0].checkpoints[0], "explanation", "  "), "blank_narrative"),
    (lambda r: setattr(r.revision_plan[0], "depends_on", ["step:1"]), "dependency_order"),
])
def test_analysis_mistakes_are_still_rejected(change, code):
    entry = make_source()
    report = example_complete_report(entry)
    change(report)
    with pytest.raises(ValueError, match=code):
        validate_complete_report(report, entry)
