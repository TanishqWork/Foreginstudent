"""Deterministic ss-free-ai-draft-1.0 calculations and source checks.

The reference is prompt data/statement-studio-scoring.mjs. No provider or HTTP code.
"""

import json
import math
from functools import lru_cache
from importlib.resources import files

from depth.schemas.assessment_report import AssessmentEvaluation, FreeAssessmentReport

SCORE_MEANING = (
    "Writing quality and revision readiness against Statement Studio’s rubric; "
    "not admission probability, verified truth, or AI-authorship detection."
)
LEVEL_LABELS = ["Missing or misaligned", "Weak", "Developing", "Strong", "Exemplary"]


@lru_cache
def assessment_rubric() -> dict:
    return json.loads(files("depth.prompts").joinpath("rubric.json").read_text(encoding="utf-8"))


def selected_dimensions(statement_type: str) -> list[dict]:
    rubric = assessment_rubric()
    return rubric["universal"] + rubric["profiles"][statement_type]["dimensions"]


def validate_evaluation(evaluation: AssessmentEvaluation, payload: dict) -> None:
    """Raise a short reason code; never put applicant prose in validation errors."""
    report = evaluation.report
    definitions = selected_dimensions(payload["statement_type"])
    dimension_ids = [item["id"] for item in definitions]
    if report.assessment_id != payload["assessment_id"] or report.statement_type != payload["statement_type"]:
        raise ValueError("assessment_identity_mismatch")
    if [item.id for item in report.dimensions] != dimension_ids:
        raise ValueError("dimension_profile_mismatch")
    sentences = {item["id"]: item for item in payload["measurements"]["sentences"]}

    def check_ids(ids: list[str]) -> None:
        if len(ids) != len(set(ids)) or any(item not in sentences for item in ids):
            raise ValueError("invalid_sentence_reference")

    for dimension in report.dimensions:
        check_ids(dimension.sentence_ids)
        for index, checkpoint in enumerate(dimension.checkpoints, 1):
            if checkpoint.index != index or ((checkpoint.status == "scored") != (checkpoint.rating is not None)):
                raise ValueError("invalid_checkpoint_status_or_order")
            check_ids(checkpoint.sentence_ids)
            if checkpoint.status == "scored" and checkpoint.rating > 0 and not checkpoint.sentence_ids:
                raise ValueError("positive_checkpoint_requires_evidence")
        if dimension.id == "addsBeyondMain" and not payload.get("main_statement_text"):
            if any(check.status != "unknown" for check in dimension.checkpoints[:2]):
                raise ValueError("comparison_requires_main_statement")
    prompt = payload.get("application_prompt") or ""
    if not prompt.strip():
        if report.prompt_requirements or report.prompt_requirements_status != "unknown":
            raise ValueError("requirements_without_prompt")
        if any(check.status != "unknown" for check in report.dimensions[0].checkpoints):
            raise ValueError("alignment_requires_prompt")
    elif report.prompt_requirements_status == "unknown" and report.prompt_requirements:
        raise ValueError("unknown_coverage_has_requirements")
    requirement_ids = [item.id for item in report.prompt_requirements]
    if len(requirement_ids) != len(set(requirement_ids)) or any(not item for item in requirement_ids):
        raise ValueError("invalid_requirement_identity")
    for requirement in report.prompt_requirements:
        check_ids(requirement.sentence_ids)
        if not requirement.prompt_quote.strip() or requirement.prompt_quote not in prompt:
            raise ValueError("requirement_quote_mismatch")
        if requirement.status == "covered" and not requirement.sentence_ids:
            raise ValueError("covered_requirement_requires_evidence")
    for finding in [report.strongest_sentence, report.riskiest_sentence]:
        check_ids(finding.supporting_sentence_ids)
        if finding.sentence_id is None:
            if finding.quote is not None or finding.paragraph is not None:
                raise ValueError("incomplete_sentence_finding")
        elif (
            finding.sentence_id not in sentences
            or finding.quote != sentences[finding.sentence_id]["text"]
            or finding.paragraph != sentences[finding.sentence_id]["paragraph"]
        ):
            raise ValueError("sentence_quote_mismatch")
    if any(item not in dimension_ids for item in report.main_concern.dimension_ids):
        raise ValueError("invalid_concern_dimension")
    check_ids(report.main_concern.sentence_ids)
    for flag in report.integrity_flags:
        check_ids(flag.sentence_ids)
        if not flag.sentence_ids:
            raise ValueError("integrity_flag_requires_evidence")
    example_ids = [item.id for item in evaluation.evidence_examples]
    example_sources = [tuple(sorted(item.sentence_ids)) for item in evaluation.evidence_examples]
    if (
        any(not item for item in example_ids) or len(example_ids) != len(set(example_ids))
        or len(example_sources) != len(set(example_sources))
    ):
        raise ValueError("duplicate_evidence_example")
    for example in evaluation.evidence_examples:
        check_ids(example.sentence_ids)
    gap = evaluation.evidence_gap
    check_ids(gap.sentence_ids)
    if gap.quote is not None and not any(gap.quote == sentences[item]["text"] for item in gap.sentence_ids):
        raise ValueError("evidence_gap_quote_mismatch")


def length_compliance(measurements: dict, limits: dict, conflict: bool = False) -> dict:
    if conflict:
        return {"status": "unknown", "largest_overrun_percent": None, "prose_deduction": 0}
    ratios = [
        (measurements[count] - limits[limit]) / limits[limit]
        for limit, count in [("max_words", "word_count"), ("max_characters", "character_count")]
        if limits.get(limit) is not None
    ]
    if not ratios:
        return {"status": "not_supplied", "largest_overrun_percent": None, "prose_deduction": 0}
    overrun = max(0, *ratios)
    deduction = 20 if overrun > 0.10 + 1e-12 else 10 if overrun > 0.05 + 1e-12 else 5 if overrun > 0 else 0
    return {
        "status": "over_limit" if overrun else "within_limit",
        "largest_overrun_percent": overrun * 100,
        "prose_deduction": deduction,
    }


def calculate_report(report: FreeAssessmentReport, payload: dict) -> FreeAssessmentReport:
    """Replace every numeric/rule-derived field with host calculations."""
    result = report.model_dump()
    requirements = report.prompt_requirements
    missing = [item for item in requirements if item.priority == "required" and item.status == "missing"]
    partial = [item for item in requirements if item.priority == "required" and item.status == "partial"]
    prompt_supplied = bool((payload.get("application_prompt") or "").strip())
    limits = payload["limits"]
    # The evaluator can identify conflicting supplied constraints, but cannot invent limits.
    conflict = report.limit_compliance.status == "unknown" and any(value is not None for value in limits.values())
    compliance = length_compliance(payload["measurements"], limits, conflict)
    reasons = {
        "within_limit": "The draft is within the supplied maximum.",
        "over_limit": "The draft exceeds the supplied maximum; the published prose deduction applies once.",
        "not_supplied": "No hard maximum was supplied.",
        "unknown": report.limit_compliance.reason,
    }
    result["limit_compliance"] = {**compliance, **limits, "reason": reasons[compliance["status"]]}
    result["measurements"] = {key: value for key, value in payload["measurements"].items() if key != "sentences"}
    incomplete = (
        not prompt_supplied or bool(report.missing_context) or conflict
        or report.prompt_requirements_status != "evaluated"
        or any(item.status == "uncertain" for item in requirements)
    )
    dimensions = []
    adjustments = []
    for definition, dimension in zip(selected_dimensions(report.statement_type), report.dimensions, strict=True):
        row = dimension.model_dump()
        row.update(definition)
        checks = [check for check in dimension.checkpoints if check.status == "scored"]
        incomplete = incomplete or len(checks) != 4
        row.update(status="excluded", base_score=None, score=None, level=None, level_label=None, weighted_points=None)
        if len(checks) >= 3:
            base = 5 * math.floor((25 * sum(check.rating for check in checks) / len(checks)) / 5 + 0.5)
            cap = 40 if definition["id"] == "promptAlignment" and missing else 65 if definition["id"] == "promptAlignment" and partial else 100
            deduction = compliance["prose_deduction"] if definition["id"] == "proseControl" else 0
            score = max(0, min(base, cap) - deduction)
            level = 4 if score >= 85 else 3 if score >= 70 else 2 if score >= 55 else 1 if score >= 30 else 0
            row.update(status="scored", base_score=base, score=score, level=level, level_label=LEVEL_LABELS[level], weighted_points=definition["weight"] * score / 100)
            if score < base:
                adjustments.append({
                    "dimension_id": definition["id"],
                    "rule": "length_overrun" if deduction else "missing_required_content" if missing else "partial_required_content",
                    "base_score": base, "cap": cap if cap < 100 else None, "deduction": deduction,
                    "points_lost": base - score, "final_score": score,
                    "evidence_requirement_ids": [] if deduction else [item.id for item in missing or partial],
                    "reason": reasons[compliance["status"]] if deduction else "Required prompt content is missing." if missing else "Required prompt content is only partially answered.",
                })
        dimensions.append(row)
    scored = [item for item in dimensions if item["status"] == "scored"]
    weight = sum(item["weight"] for item in scored)
    eligible = weight >= 70 and len(scored) >= 6 and not report.input_issues
    unrounded = 100 * sum(item["weighted_points"] for item in scored) / weight if eligible else None
    total = min(100, max(0, math.floor(unrounded + 0.5))) if eligible else None
    triggers = []
    if eligible:
        if total < 55:
            triggers.append("overall_below_55")
        triggers.extend(item["id"] + "_below_45" for item in scored if item["id"] in {"promptAlignment", "throughlineStructure"} and item["score"] < 45)
    order = {item["id"]: index for index, item in enumerate(dimensions)}
    strongest = sorted(scored, key=lambda item: (-item["score"], order[item["id"]]))[:2]
    strongest_ids = {item["id"] for item in strongest}
    weakest = sorted([item for item in scored if item["id"] not in strongest_ids], key=lambda item: (item["score"], order[item["id"]]))[:2]

    def rank(items: list[dict]) -> list[dict]:
        return [{"dimension_id": item["id"], "label": item["label"], "score": item["score"], "reason": item["reason"]} for item in items]

    path = ("Rebuild" if triggers else "Refine") if eligible else None
    recommendation_reason = (
        "More usable input or assessable rubric coverage is needed before recommending a revision path." if not eligible else
        "Rebuild is recommended because: " + ", ".join({"overall_below_55": "the overall score is below 55", "promptAlignment_below_45": "prompt alignment is below 45", "throughlineStructure_below_45": "throughline and structure is below 45"}[item] for item in triggers) + "." if triggers else
        "The overall score is at least 55 and no scored foundational dimension is below 45. Refine the existing argument."
    )
    result.update(
        rubric_version=assessment_rubric()["version"], dimensions=dimensions, adjustments=adjustments,
        overall_score=total, overall_unrounded=unrounded, scored_weight=weight,
        renormalized=eligible and weight != 100, excluded_dimension_ids=[item["id"] for item in dimensions if item["status"] == "excluded"],
        status="needs_input" if not eligible else "provisional" if incomplete else "complete",
        assessment_band=None if total is None else "Highly developed" if total >= 85 else "Credible draft" if total >= 70 else "Material gaps" if total >= 55 else "Rebuild recommended",
        strongest_categories=rank(strongest), weakest_categories=rank(weakest),
        ranking_note="" if len(strongest) + len(weakest) == 4 else "Fewer than four distinct dimensions could be scored.",
        missing_prompt_requirements=[{"requirement_id": item.id, "requirement": item.requirement, "status": item.status, "next_action": item.next_action} for item in requirements if item.priority == "required" and item.status in {"missing", "partial"}],
        recommendation={"path": path, "provisional": incomplete, "triggered_rules": triggers, "reason": recommendation_reason, "next_action": report.main_concern.first_action},
        defaults_applied=["D1", "D2", "D3", "D4", "D5"], score_meaning=SCORE_MEANING,
    )
    if not eligible and not result["input_issues"]:
        result["input_issues"] = ["A total requires at least six scored dimensions covering 70 nominal rubric points."]
    if (incomplete or not eligible) and report.confidence.level == "high":
        result["confidence"] = {"level": "moderate", "reason": "Missing context or incomplete rubric coverage limits judgment confidence. " + report.confidence.reason}
    return FreeAssessmentReport.model_validate(result)
