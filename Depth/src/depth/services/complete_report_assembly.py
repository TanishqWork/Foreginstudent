"""Build the full complete report from the model's draft plus the saved free assessment.

The model writes only the analysis (DraftCompleteReport). Everything that repeats saved
data is filled here from the source, so it is always exact. Unknown IDs cannot be filled
and raise "path:code" errors, which the generation loop repairs section by section.
"""

from dataclasses import dataclass

from depth.schemas.complete_report_content import CompleteReportContent, ContextEvidence, Evidence
from depth.schemas.complete_report_draft import DraftCompleteReport
from depth.services.assessment_record_service import SavedAssessment
from depth.services.complete_report_validation import source_maps

EMPTY_COVERAGE = {
    "expected_criteria": 0, "reviewed_criteria": 0, "expected_sentences": 0, "reviewed_sentences": 0,
    "expected_paragraphs": 0, "reviewed_paragraphs": 0, "unreviewed_dimension_ids": [],
    "unreviewed_sentence_ids": [], "unreviewed_paragraph_ids": [],
}  # Recomputed from the real inventory by validate_complete_report.


@dataclass(frozen=True)
class Assembled:
    report: CompleteReportContent
    quotes_restored: int  # Evidence quotes that were not in their cited sentence and became the whole sentence.


def _unknown(path: str) -> ValueError:
    return ValueError(f"{path}:invalid_reference")


def assemble_report(draft: DraftCompleteReport, entry: SavedAssessment) -> Assembled:
    baseline = entry.assessment.report
    sentences, paragraphs, contexts = source_maps(entry)
    sentence_map = {row["id"]: row for row in sentences}
    paragraph_map = {row["id"]: row for row in paragraphs}
    dimension_map = {row.id: row for row in baseline.dimensions}
    requirement_map = {row.id: row for row in baseline.prompt_requirements}
    data = draft.model_dump()

    summary = data["executive_summary"]
    if summary is not None:
        summary.update(
            overall_score=baseline.overall_score, assessment_band=baseline.assessment_band,
            assessment_status=baseline.status, recommendation_path=baseline.recommendation.path,
            main_concern_title=baseline.main_concern.title,
        )

    baseline_fields = {"status", "weight", "base_score", "score", "level", "level_label", "weighted_points"}
    for i, row in enumerate(data["criterion_details"]):
        original = dimension_map.get(row["dimension_id"])
        if original is None:
            raise _unknown(f"criterion_details.{i}.dimension_id")
        row["label"] = original.label
        row["baseline"] = original.model_dump(include=baseline_fields)
        checkpoints = {item.index: item for item in original.checkpoints}
        for j, item in enumerate(row["checkpoints"]):
            source = checkpoints.get(item["index"])
            if source is None:
                raise ValueError(f"criterion_details.{i}.checkpoints.{j}.index:checkpoint_coverage")
            item.update(status=source.status, rating=source.rating)

    prompt = data["prompt_coverage"]
    if prompt is not None:
        for i, row in enumerate(prompt["requirements"]):
            original = requirement_map.get(row["requirement_id"])
            if original is None:
                raise _unknown(f"prompt_coverage.requirements.{i}.requirement_id")
            row.update(prompt_quote=original.prompt_quote, requirement=original.requirement,
                       priority=original.priority, status=original.status)
        prompt.update(
            assessment_status=baseline.prompt_requirements_status,
            limit_compliance=baseline.limit_compliance.model_dump(),
            missing_or_partial_required_ids=[row.id for row in baseline.prompt_requirements
                                             if row.priority == "required" and row.status in {"missing", "partial"}],
            uncertain_requirement_ids=[row.id for row in baseline.prompt_requirements if row.status == "uncertain"],
        )

    for i, row in enumerate(data["sentence_reviews"]):
        source = sentence_map.get(row["sentence_id"])
        if source is None:
            raise _unknown(f"sentence_reviews.{i}.sentence_id")
        row.update(text=source["text"], paragraph=source["paragraph"])
    for i, row in enumerate(data["paragraph_reviews"]):
        source = paragraph_map.get(row["paragraph_id"])
        if source is None:
            raise _unknown(f"paragraph_reviews.{i}.paragraph_id")
        row.update(text=source["text"], number=source["number"], sentence_ids=source["sentence_ids"])

    data.update(report_version="complete-report.v1", coverage=dict(EMPTY_COVERAGE))
    report = CompleteReportContent.model_validate(data)
    return Assembled(report, _restore_evidence(report, sentence_map, {row["id"]: row for row in contexts}))


def _restore_evidence(report: CompleteReportContent, sentence_map: dict, context_map: dict) -> int:
    """A quote may be a phrase from its cited sentence; one that is not in it becomes the whole sentence."""
    restored = 0

    def visit(value: object) -> None:
        nonlocal restored
        if isinstance(value, Evidence):
            source = sentence_map.get(value.sentence_id)
            if source is not None:
                value.paragraph = source["paragraph"]
                if not value.quote.strip() or value.quote not in source["text"]:
                    value.quote, restored = source["text"], restored + 1
        elif isinstance(value, ContextEvidence):
            source = context_map.get(value.source_id)
            if source is not None and (not value.quote.strip() or value.quote not in source["text"]):
                value.quote, restored = source["text"], restored + 1
        elif isinstance(value, list):
            for item in value:
                visit(item)
        elif hasattr(type(value), "model_fields"):
            for field in type(value).model_fields:
                visit(getattr(value, field))

    visit(report)
    return restored
