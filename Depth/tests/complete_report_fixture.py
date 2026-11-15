"""Synthetic contract data for tests; not a calibrated applicant assessment."""

from depth.schemas.complete_report_content import CompleteReportContent
from depth.services.complete_report_validation import source_maps, validate_complete_report


def example_complete_report(entry, finding_count=1):
    baseline = entry.assessment.report
    sentences, paragraphs, _ = source_maps(entry)
    first = sentences[0]
    dimension_id = baseline.dimensions[0].id
    evidence = [{"sentence_id": first["id"], "paragraph": first["paragraph"], "quote": first["text"], "use": "context"}]
    data = {
        "report_version": "complete-report.v1", "report_status": "ready", "input_issues": [], "discrepancies": [],
        "executive_summary": {
            "overall_score": baseline.overall_score, "assessment_band": baseline.assessment_band,
            "assessment_status": baseline.status, "recommendation_path": baseline.recommendation.path,
            "main_concern_title": baseline.main_concern.title,
            "argument_summary": "Synthetic fixture illustrating a complete report contract.",
            "strengths_to_preserve": ["Preserve the applicant's specific experience."],
            "main_concern_explanation": baseline.main_concern.explanation,
            "recommendation_explanation": baseline.recommendation.reason,
            "first_action": baseline.main_concern.first_action, "limitations": ["Synthetic fixture, not calibrated advice."],
        },
        "criterion_details": [{
            "finding_id": f"criterion:{item.id}", "dimension_id": item.id, "label": item.label,
            "baseline": item.model_dump(include={"status", "weight", "base_score", "score", "level", "level_label", "weighted_points"}),
            "explanation_status": "aligned", "explanation": item.reason,
            "checkpoints": [{"index": cp.index, "status": cp.status, "rating": cp.rating,
                             "explanation": cp.reason, "evidence": evidence} for cp in item.checkpoints],
            "supporting_excerpts": evidence, "limiting_factors": [],
            "recorded_adjustment_explanation": "Recorded adjustments remain unchanged.",
            "revision_direction": item.next_action, "completion_check": "Check the relationship against the source.",
        } for item in baseline.dimensions],
        "prompt_coverage": {
            "assessment_status": baseline.prompt_requirements_status,
            "limit_compliance": baseline.limit_compliance.model_dump(),
            "requirements": [{"finding_id": f"requirement:{item.id}", "requirement_id": item.id,
                              "prompt_quote": item.prompt_quote, "requirement": item.requirement,
                              "priority": item.priority, "status": item.status, "evidence": evidence,
                              "explanation": item.reason, "next_action": item.next_action} for item in baseline.prompt_requirements],
            "missing_or_partial_required_ids": [item.id for item in baseline.prompt_requirements
                                                if item.priority == "required" and item.status in {"missing", "partial"}],
            "uncertain_requirement_ids": [item.id for item in baseline.prompt_requirements if item.status == "uncertain"],
            "limitations": [],
        },
        "sentence_reviews": [{
            "finding_id": f"sentence:{item['id']}", "sentence_id": item["id"], "paragraph": item["paragraph"],
            "text": item["text"], "function": "Develop the applicant's argument.",
            "disposition": "Refine" if i == 0 else "Keep", "action": "connect" if i == 0 else "preserve",
            "what_works": "The sentence contributes relevant material.", "concern": "Clarify the connection." if i == 0 else None,
            "explanation": "Read this sentence in the context of its paragraph.",
            "revision_direction": "Clarify the connection." if i == 0 else "Preserve the supported material.",
            "criterion_ids": [dimension_id], "context_sentence_ids": [], "uncertainty": None,
        } for i, item in enumerate(sentences)],
        "paragraph_reviews": [{
            "finding_id": f"paragraph:{item['id']}", "paragraph_id": item["id"], "number": item["number"],
            "text": item["text"], "sentence_ids": item["sentence_ids"],
            "intended_function": "Introduce relevant preparation.", "actual_contribution": "Connects experience to a learning need.",
            "disposition": "Refine" if i == 0 else "Keep", "action": "connect" if i == 0 else "preserve",
            "quality": {key: {"rating": "adequate", "reason": "A useful function is recognizable in this fixture."}
                        for key in ["purpose", "coherence", "progression", "evidence_use"]},
            "explanation": "The paragraph is assessed holistically.", "revision_direction": "Clarify the connection while preserving evidence.",
            "criterion_ids": [dimension_id], "uncertainty": None,
        } for i, item in enumerate(paragraphs)],
        "evidence_gaps": [{
            "finding_id": f"gap:{i+1}", "severity": "material", "criterion_ids": [dimension_id],
            "evidence_status": "partial", "gap_type": "outcome", "sentence_ids": [first["id"]], "paragraph_ids": [paragraphs[0]["id"]],
            "evidence": evidence, "claim_or_function": f"Synthetic evidence finding {i+1}.",
            "existing_support": "The source supplies an activity.", "missing_link": "The outcome relationship needs clarification.",
            "applicant_action": "Add only true, relevant outcome detail.", "uncertainty": None,
        } for i in range(finding_count)],
        "program_fit": {"applicability": "applicable", "baseline_dimension_ids": [],
                        "summary": "The fixture provides limited external program context.", "findings": [],
                        "limitations": ["No external program verification was performed."]},
        "voice_and_originality": {"baseline_dimension_id": "voiceAuthenticity", "classification": "Natural and grounded",
                                  "summary": "The fixture contains applicant-specific experiences.", "findings": [],
                                  "limitations": ["No authorship or plagiarism determination."]},
        "unsupported_claims": [],
        "cut_or_expand": [{
            "finding_id": "edit:1", "operation": "expand", "severity": "material", "sentence_ids": [first["id"]],
            "paragraph_ids": [paragraphs[0]["id"]], "evidence": evidence, "related_finding_ids": ["sentence:" + first["id"]],
            "rationale": "Clarify the first sentence's relationship.", "instruction": "Supply a true supporting detail.",
            "preserve": "The original applicant experience.", "placement": "After the first sentence.",
            "length_tradeoff": "Reallocate repetition if the supplied word limit requires it.",
        }],
        "revision_plan": [{
            "finding_id": "step:1", "priority": 1, "phase": "develop_evidence", "title": "Clarify the evidence connection",
            "related_finding_ids": ["edit:1"], "sentence_ids": [first["id"]], "paragraph_ids": [paragraphs[0]["id"]],
            "depends_on": [], "action": "Check and clarify the actual relationship.", "why_now": "Substance precedes polishing.",
            "preserve": "The supported experience.", "completion_check": "Explain the relationship using true material.",
        }],
        "limitations": ["Synthetic test fixture."],
        "coverage": {"expected_criteria": 0, "reviewed_criteria": 0, "expected_sentences": 0, "reviewed_sentences": 0,
                     "expected_paragraphs": 0, "reviewed_paragraphs": 0, "unreviewed_dimension_ids": [],
                     "unreviewed_sentence_ids": [], "unreviewed_paragraph_ids": []},
    }
    return validate_complete_report(CompleteReportContent.model_validate(data), entry)


def make_source(assessment_id="assessment-a", needs_input=False, generation_seconds=12.5):
    """A finished free assessment as loaded from the database: the input and baseline for a complete report."""
    import json as _json
    from depth.services import assessment_service
    from depth.services.assessment_record_service import SavedAssessment
    from test_assessment import example_body, example_response

    payload = _json.loads(assessment_service.assessment_input(example_body(), assessment_id))
    assessment = example_response()
    assessment.report.assessment_id = assessment_id
    if needs_input:
        assessment.report.status = "needs_input"
        assessment.report.overall_score = assessment.report.assessment_band = None
        assessment.report.recommendation.path = None
        assessment.diagnostic.revision_opportunity = None
    return SavedAssessment(payload, assessment, generation_seconds)


def draft_of(report):
    """What the model now returns for a report: the analysis without host-filled fields."""
    from depth.schemas.complete_report_draft import DraftCompleteReport

    data = report.model_dump()
    for key in ["report_version", "coverage"]:
        data.pop(key)
    if data["executive_summary"] is not None:
        for key in ["overall_score", "assessment_band", "assessment_status", "recommendation_path", "main_concern_title"]:
            data["executive_summary"].pop(key)
    for row in data["criterion_details"]:
        row.pop("label"); row.pop("baseline")
        for item in row["checkpoints"]:
            item.pop("status"); item.pop("rating")
    if data["prompt_coverage"] is not None:
        for key in ["assessment_status", "limit_compliance", "missing_or_partial_required_ids", "uncertain_requirement_ids"]:
            data["prompt_coverage"].pop(key)
        for row in data["prompt_coverage"]["requirements"]:
            for key in ["prompt_quote", "requirement", "priority", "status"]:
                row.pop(key)
    for row in data["sentence_reviews"]:
        row.pop("text"); row.pop("paragraph")
    for row in data["paragraph_reviews"]:
        row.pop("text"); row.pop("number"); row.pop("sentence_ids")
    return DraftCompleteReport.model_validate(data)
