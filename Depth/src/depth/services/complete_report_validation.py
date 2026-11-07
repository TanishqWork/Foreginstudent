"""Source and baseline checks after schema validation. Errors contain paths only."""

import re

from depth.schemas.complete_report_content import CompleteReportContent, Coverage
from depth.services.assessment_store import CachedAssessment


def source_maps(entry: CachedAssessment) -> tuple[list[dict], list[dict], list[dict]]:
    original = entry.original_input
    sentences = original["measurements"]["sentences"]
    paragraphs = [{
        "id": f"p{number}", "number": number, "text": text,
        "sentence_ids": [row["id"] for row in sentences if row["paragraph"] == number],
    } for number, text in enumerate(
        [part for part in re.split(r"\r?\n[ \t]*\r?\n", original["statement_text"]) if part.strip()], 1,
    )]
    context_sources = []
    for key, kind in [("application_prompt", "application_prompt"), ("program_context", "program_context"),
                      ("main_statement_text", "main_statement"), ("applicant_notes", "applicant_notes")]:
        text = original.get(key)
        if isinstance(text, str) and text.strip():
            context_sources.append({"id": f"c{len(context_sources) + 1}", "kind": kind, "text": text})
    return sentences, paragraphs, context_sources


def validate_complete_report(report: CompleteReportContent, entry: CachedAssessment) -> CompleteReportContent:
    """Reject contradictory identities/quotes. The host computes coverage counts."""
    def require(condition: bool, path: str, code: str) -> None:
        if not condition:
            raise ValueError(f"{path}:{code}")

    baseline = entry.assessment.report
    sentences, paragraphs, contexts = source_maps(entry)
    sentence_map = {row["id"]: row for row in sentences}
    paragraph_map = {row["id"]: row for row in paragraphs}
    context_map = {row["id"]: row for row in contexts}
    dimension_map = {row.id: row for row in baseline.dimensions}
    requirement_map = {row.id: row for row in baseline.prompt_requirements}
    full = report.report_status == "ready"

    def source_order(rows: list, key: str, ids: list[str], path: str) -> list[str]:
        returned = [getattr(row, key) for row in rows]
        require(len(returned) == len(set(returned)), path, "duplicate_source_id")
        require(all(item in ids for item in returned), path, "unknown_source_id")
        require(returned == [item for item in ids if item in returned], path, "source_order")
        if full:
            require(returned == ids, path, "missing_source_rows")
        return returned

    criterion_ids = source_order(report.criterion_details, "dimension_id", list(dimension_map), "criterion_details")
    sentence_ids = source_order(report.sentence_reviews, "sentence_id", list(sentence_map), "sentence_reviews")
    paragraph_ids = source_order(report.paragraph_reviews, "paragraph_id", list(paragraph_map), "paragraph_reviews")
    if full:
        require(not report.input_issues, "input_issues", "ready_has_issues")
        require(not report.discrepancies, "discrepancies", "ready_has_discrepancies")
        require(all(section is not None for section in [report.executive_summary, report.prompt_coverage,
                    report.program_fit, report.voice_and_originality]), "report_status", "missing_required_section")
        require(bool(report.revision_plan), "revision_plan", "missing_required_steps")
    if report.report_status == "review_required":
        require(bool(report.discrepancies), "discrepancies", "review_requires_discrepancy")
    if report.report_status in {"needs_input", "incomplete"}:
        require(bool(report.input_issues), "input_issues", "status_requires_explanation")
    if report.report_status == "needs_input":
        require(all(section is None for section in [report.executive_summary, report.prompt_coverage,
                    report.program_fit, report.voice_and_originality]), "report_status", "needs_input_has_analysis")
        require(not any([report.criterion_details, report.sentence_reviews, report.paragraph_reviews,
                    report.evidence_gaps, report.unsupported_claims, report.cut_or_expand, report.revision_plan]),
                "report_status", "needs_input_has_analysis")

    summary = report.executive_summary
    if summary is not None:
        values = {"overall_score": baseline.overall_score, "assessment_band": baseline.assessment_band,
                  "assessment_status": baseline.status, "recommendation_path": baseline.recommendation.path,
                  "main_concern_title": baseline.main_concern.title}
        for key, expected in values.items():
            require(getattr(summary, key) == expected, f"executive_summary.{key}", "baseline_mismatch")

    for i, row in enumerate(report.criterion_details):
        original = dimension_map[row.dimension_id]
        require(row.label == original.label, f"criterion_details.{i}.label", "baseline_mismatch")
        expected = original.model_dump(include=set(type(row.baseline).model_fields))
        require(row.baseline.model_dump() == expected, f"criterion_details.{i}.baseline", "baseline_mismatch")
        require([item.index for item in row.checkpoints] == [item.index for item in original.checkpoints],
                f"criterion_details.{i}.checkpoints", "checkpoint_coverage")
        for j, (item, source) in enumerate(zip(row.checkpoints, original.checkpoints)):
            require((item.status, item.rating) == (source.status, source.rating),
                    f"criterion_details.{i}.checkpoints.{j}", "baseline_mismatch")
        if row.explanation_status == "review_required":
            require(report.report_status == "review_required" and bool(report.discrepancies),
                    f"criterion_details.{i}.explanation_status", "unreported_discrepancy")
            prefix = f"/dimensions/{list(dimension_map).index(row.dimension_id)}"
            require(any(item.baseline_field == prefix or item.baseline_field.startswith(prefix + "/")
                        for item in report.discrepancies), f"criterion_details.{i}.explanation_status", "unmatched_discrepancy")

    prompt = report.prompt_coverage
    if prompt is not None:
        require(prompt.assessment_status == baseline.prompt_requirements_status, "prompt_coverage.assessment_status", "baseline_mismatch")
        require(prompt.limit_compliance == baseline.limit_compliance, "prompt_coverage.limit_compliance", "baseline_mismatch")
        source_order(prompt.requirements, "requirement_id", list(requirement_map), "prompt_coverage.requirements")
        for i, row in enumerate(prompt.requirements):
            original = requirement_map[row.requirement_id]
            for key in ["prompt_quote", "requirement", "priority", "status"]:
                require(getattr(row, key) == getattr(original, key), f"prompt_coverage.requirements.{i}.{key}", "baseline_mismatch")
        require(prompt.missing_or_partial_required_ids == [row.id for row in baseline.prompt_requirements
                if row.priority == "required" and row.status in {"missing", "partial"}],
                "prompt_coverage.missing_or_partial_required_ids", "baseline_mismatch")
        require(prompt.uncertain_requirement_ids == [row.id for row in baseline.prompt_requirements if row.status == "uncertain"],
                "prompt_coverage.uncertain_requirement_ids", "baseline_mismatch")

    for path, rows, source_key, prefix in [
        ("criterion_details", report.criterion_details, "dimension_id", "criterion:"),
        ("sentence_reviews", report.sentence_reviews, "sentence_id", "sentence:"),
        ("paragraph_reviews", report.paragraph_reviews, "paragraph_id", "paragraph:"),
        ("prompt_coverage.requirements", prompt.requirements if prompt else [], "requirement_id", "requirement:"),
    ]:
        for i, row in enumerate(rows):
            require(row.finding_id == prefix + getattr(row, source_key), f"{path}.{i}.finding_id", "canonical_finding_id")
    for path, rows, prefix in [
        ("evidence_gaps", report.evidence_gaps, "gap:"),
        ("program_fit.findings", report.program_fit.findings if report.program_fit else [], "fit:"),
        ("voice_and_originality.findings", report.voice_and_originality.findings if report.voice_and_originality else [], "voice:"),
        ("unsupported_claims", report.unsupported_claims, "claim:"),
        ("cut_or_expand", report.cut_or_expand, "edit:"),
        ("revision_plan", report.revision_plan, "step:"),
        ("discrepancies", report.discrepancies, "discrepancy:"),
    ]:
        for i, row in enumerate(rows):
            require(row.finding_id.startswith(prefix) and bool(row.finding_id[len(prefix):].strip()),
                    f"{path}.{i}.finding_id", "finding_id_prefix")

    for i, row in enumerate(report.sentence_reviews):
        original = sentence_map[row.sentence_id]
        require((row.text, row.paragraph) == (original["text"], original["paragraph"]), f"sentence_reviews.{i}", "source_mismatch")
    for i, row in enumerate(report.paragraph_reviews):
        original = paragraph_map[row.paragraph_id]
        require((row.text, row.number, row.sentence_ids) == (original["text"], original["number"], original["sentence_ids"]),
                f"paragraph_reviews.{i}", "source_mismatch")
    for group_name, rows in [("sentence_reviews", report.sentence_reviews), ("paragraph_reviews", report.paragraph_reviews)]:
        for i, row in enumerate(rows):
            require((row.disposition == "Keep" and row.action == "preserve") or
                    (row.disposition == "Rebuild" and row.action == "rebuild") or
                    (row.disposition == "Refine" and row.action not in {"preserve", "rebuild"}),
                    f"{group_name}.{i}.action", "disposition_action_mismatch")

    sentence_reviews = {row.sentence_id: row for row in report.sentence_reviews}
    rebuilt_paragraphs = {row.number for row in report.paragraph_reviews
                          if row.disposition == "Rebuild" and row.action == "rebuild"}
    for i, edit in enumerate(report.cut_or_expand):
        if edit.operation != "cut":
            continue
        for sentence_id in edit.sentence_ids:
            row = sentence_reviews.get(sentence_id)
            source = sentence_map.get(sentence_id)
            if row is not None and source is not None and row.disposition == "Keep":
                require(source["paragraph"] in rebuilt_paragraphs, f"cut_or_expand.{i}.sentence_ids", "keep_cut_conflict")

    data = report.model_dump()
    finding_ids = []
    narrative_keys = {
        "argument_summary", "main_concern_explanation", "recommendation_explanation", "first_action",
        "explanation", "revision_direction", "completion_check", "recorded_adjustment_explanation",
        "next_action", "function", "what_works", "concern", "uncertainty", "reason",
        "intended_function", "actual_contribution", "claim_or_function", "existing_support",
        "missing_link", "applicant_action", "summary", "applicant_need", "program_feature",
        "connection", "effect", "verification_action", "rationale", "instruction", "preserve",
        "placement", "length_tradeoff", "title", "action", "why_now", "issue", "resolution_needed",
    }

    def walk(value: object, path: str = "report") -> None:
        if isinstance(value, dict):
            if "finding_id" in value:
                finding_ids.append(value["finding_id"])
                require(bool(value["finding_id"].strip()), f"{path}.finding_id", "empty_identifier")
            if {"sentence_id", "quote", "paragraph"} <= value.keys():
                source = sentence_map.get(value["sentence_id"])
                require(source is not None and source["paragraph"] == value["paragraph"] and
                        bool(value["quote"].strip()) and value["quote"] in source["text"], path, "quote_mismatch")
            if {"source_id", "quote"} <= value.keys():
                source = context_map.get(value["source_id"])
                require(source is not None and bool(value["quote"].strip()) and value["quote"] in source["text"], path, "context_quote_mismatch")
            for key, values in value.items():
                if key in narrative_keys and isinstance(values, str):
                    require(bool(values.strip()), f"{path}.{key}", "blank_narrative")
                allowed = sentence_map if key in {"sentence_ids", "context_sentence_ids"} else paragraph_map if key == "paragraph_ids" else dimension_map if key in {"criterion_ids", "baseline_dimension_ids"} else None
                if allowed is not None:
                    require(len(values) == len(set(values)) and all(item in allowed for item in values), f"{path}.{key}", "invalid_reference")
                if key == "baseline_integrity_flag_indices":
                    require(len(values) == len(set(values)) and all(0 <= item < len(baseline.integrity_flags) for item in values),
                            f"{path}.{key}", "invalid_reference")
                walk(values, f"{path}.{key}")
        elif isinstance(value, list):
            for i, item in enumerate(value):
                walk(item, f"{path}.{i}")
    walk(data)
    require(len(finding_ids) == len(set(finding_ids)), "finding_ids", "duplicate_identifier")
    findings = set(finding_ids)

    def finding_references(value: object, path: str = "report") -> None:
        if isinstance(value, dict):
            if "related_finding_ids" in value:
                refs = value["related_finding_ids"]
                require(len(refs) == len(set(refs)) and all(item in findings and item != value.get("finding_id") for item in refs),
                        f"{path}.related_finding_ids", "invalid_reference")
            for key, item in value.items():
                finding_references(item, f"{path}.{key}")
        elif isinstance(value, list):
            for i, item in enumerate(value):
                finding_references(item, f"{path}.{i}")
    finding_references(data)
    previous_steps = set()
    for i, row in enumerate(report.revision_plan):
        require(row.priority == i + 1, f"revision_plan.{i}.priority", "priority_order")
        require(len(row.depends_on) == len(set(row.depends_on)) and all(item in previous_steps for item in row.depends_on),
                f"revision_plan.{i}.depends_on", "dependency_order")
        previous_steps.add(row.finding_id)
    for i, row in enumerate(report.discrepancies):
        target: object = baseline.model_dump()
        require(row.baseline_field.startswith("/"), f"discrepancies.{i}.baseline_field", "invalid_baseline_path")
        try:
            for part in row.baseline_field[1:].split("/"):
                key = part.replace("~1", "/").replace("~0", "~")
                target = target[int(key)] if isinstance(target, list) else target[key]
        except (KeyError, IndexError, TypeError, ValueError):
            raise ValueError(f"discrepancies.{i}.baseline_field:invalid_baseline_path") from None

    report.coverage = Coverage(
        expected_criteria=len(dimension_map), reviewed_criteria=len(criterion_ids),
        expected_sentences=len(sentence_map), reviewed_sentences=len(sentence_ids),
        expected_paragraphs=len(paragraph_map), reviewed_paragraphs=len(paragraph_ids),
        unreviewed_dimension_ids=[item for item in dimension_map if item not in criterion_ids],
        unreviewed_sentence_ids=[item for item in sentence_map if item not in sentence_ids],
        unreviewed_paragraph_ids=[item for item in paragraph_map if item not in paragraph_ids],
    )
    return report
