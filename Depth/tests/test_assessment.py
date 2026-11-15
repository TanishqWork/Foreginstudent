"""Free-diagnostic contract, arithmetic and source checks; no provider or database."""

import asyncio
import json
import time
from contextlib import contextmanager
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from depth.core.exceptions import LLMError
from depth.core.handlers import register_exception_handlers
from depth.routes.assessment import require_session, router
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.assessment_report import AssessmentEvaluation, FreeDiagnosticResponse
from depth.schemas.free_assessment import FreeAssessmentState
from depth.services import assessment_service
from depth.services.assessment_scoring import (
    calculate_report, length_compliance, selected_dimensions, validate_evaluation,
)


def example_body(**changes) -> AssessmentRequest:
    return AssessmentRequest(**{
        "statement_text": (
            "At our local clinic, referrals often stalled after the first visit. "
            "I compared referral logs and interviewed the outreach team to locate missed handoffs. "
            "With the coordinator, I tested a contact schedule and reviewed which follow-ups still failed.\n\n"
            "I want to study public health evaluation so I can improve the design of community referral services. "
            "The program's evaluation module would help me assess which changes actually improve continuity of care."
        ),
        "statement_type": "statement_of_purpose", "pathway": "health", "degree": "MPH",
        "field": "Public health", "target_institution": "Fictional University",
        "target_program": "MPH", "application_prompt": "Describe your preparation, goals, and program fit.",
        "word_limit": 500, **changes,
    })


def example_evaluation(payload: dict, rating: int = 3) -> AssessmentEvaluation:
    dimensions = [{
        **definition, "status": "scored", "base_score": None, "score": None, "level": None,
        "level_label": None, "weighted_points": None,
        "reason": "Relevant material is present; connect it more directly to the central argument.",
        "next_action": "Explain how this experience establishes the next step in your argument.",
        "sentence_ids": ["s2"],
        "checkpoints": [{"index": index, "status": "scored", "rating": rating, "sentence_ids": ["s2"], "reason": "Synthetic contract fixture; this is not a calibrated assessment."} for index in range(1, 5)],
    } for definition in selected_dimensions(payload["statement_type"])]
    if payload["statement_type"] == "supplemental_essay" and not payload.get("main_statement_text"):
        for checkpoint in dimensions[-1]["checkpoints"][:2]:
            checkpoint.update(status="unknown", rating=None, sentence_ids=[], reason="The main statement was not supplied for comparison.")
    finding = {"sentence_id": None, "paragraph": None, "quote": None, "explanation": "No sentence-specific concern was identified in this fictional fixture.", "supporting_sentence_ids": []}
    report = {
        "assessment_id": payload["assessment_id"], "rubric_version": "ss-free-ai-draft-1.0",
        "status": "complete", "input_issues": [], "statement_type": payload["statement_type"],
        "measurements": {key: value for key, value in payload["measurements"].items() if key != "sentences"},
        "limit_compliance": {"status": "within_limit", "max_words": payload["limits"]["max_words"], "max_characters": None, "largest_overrun_percent": 0.0, "prose_deduction": 0, "reason": "Within the supplied limit."},
        "overall_score": None, "overall_unrounded": None, "assessment_band": None,
        "scored_weight": 0, "renormalized": False, "excluded_dimension_ids": [],
        "confidence": {"level": "moderate", "reason": "Fictional implementation fixture; ratings illustrate the contract only."},
        "dimensions": dimensions, "adjustments": [], "strongest_categories": [], "weakest_categories": [],
        "ranking_note": "", "strongest_sentence": {"sentence_id": "s2", "paragraph": 1, "quote": payload["measurements"]["sentences"][1]["text"], "explanation": "The sentence makes the applicant's action concrete.", "supporting_sentence_ids": ["s3"]},
        "riskiest_sentence": finding,
        "prompt_requirements_status": "evaluated", "prompt_requirements": [{"id": "r1", "prompt_quote": "Describe your preparation", "requirement": "Describe relevant preparation", "priority": "required", "status": "covered", "sentence_ids": ["s2", "s3"], "reason": "The draft explains an investigation and a practical trial.", "next_action": "Connect this preparation to the skills you need next."}],
        "missing_prompt_requirements": [], "uncertain_prompt_requirements": [], "missing_context": [],
        "verification_limits": ["Program details and applicant claims have not been independently verified."],
        "integrity_flags": [], "main_concern": {"title": "Develop the link between experience and training", "explanation": "The next revision should explain what the experience revealed about the applicant's learning needs.", "dimension_ids": ["programFit"] if payload["statement_type"] == "statement_of_purpose" else [], "sentence_ids": ["s4", "s5"], "first_action": "Identify one learning gap and connect it to the program's evaluation training."},
        "recommendation": {"path": None, "provisional": False, "triggered_rules": [], "reason": "Calculated by the backend.", "next_action": "Develop the program-fit explanation."},
        "priority_actions": ["Connect the referral experience to a specific learning gap.", "Explain how evaluation training addresses that gap."],
        "defaults_applied": ["D1", "D2", "D3", "D4", "D5"], "score_meaning": "Fictional fixture.",
    }
    return AssessmentEvaluation.model_validate({
        "report": report,
        "evidence_gap": {"summary": "Explain what the contact-schedule trial taught you and what remains unresolved.", "quote": payload["measurements"]["sentences"][2]["text"], "sentence_ids": ["s3"]},
        "evidence_examples": [{"id": "e1", "sentence_ids": ["s2", "s3"], "summary": "The applicant investigated stalled referrals and trialed a contact schedule."}],
    })


def example_response() -> FreeDiagnosticResponse:
    body = example_body()
    payload = json.loads(assessment_service.assessment_input(body))
    payload["assessment_id"] = "fictional-diagnostic-v1"
    evaluation = example_evaluation(payload)
    validate_evaluation(evaluation, payload)
    return FreeDiagnosticResponse.model_validate({
        "schema_version": "free-diagnostic.v1",
        "context": body.model_dump(include={"pathway", "degree", "field", "target_institution", "target_program", "statement_type"}),
        "report": calculate_report(evaluation.report, payload).model_dump(),
        "diagnostic": {"revision_opportunity": "Moderate", "pathway_observation": assessment_service.PATHWAY_GUIDANCE[body.pathway], "evidence_gap": evaluation.evidence_gap.model_dump(), "evidence_examples": [item.model_dump() for item in evaluation.evidence_examples]},
    })


def test_all_profiles_and_distinct_fixed_order_rankings():
    from depth.services.assessment_scoring import assessment_rubric
    for statement_type in assessment_rubric()["profiles"]:
        body = example_body(statement_type=statement_type)
        payload = json.loads(assessment_service.assessment_input(body))
        result = calculate_report(example_evaluation(payload).report, payload)
        assert result.overall_score == 75
        assert result.scored_weight == (92 if statement_type == "supplemental_essay" else 100)
        assert result.recommendation.path == "Refine"
        ids = [item.dimension_id for item in result.strongest_categories + result.weakest_categories]
        assert ids == [item["id"] for item in selected_dimensions(statement_type)[:4]]


@pytest.mark.parametrize("word_count,deduction", [(1000, 0), (1001, 5), (1050, 5), (1051, 10), (1100, 10), (1101, 20)])
def test_length_deduction_boundaries(word_count, deduction):
    assert length_compliance({"word_count": word_count}, {"max_words": 1000})["prose_deduction"] == deduction


def test_missing_required_content_triggers_rebuild_even_with_high_total():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    evaluation = example_evaluation(payload, rating=4)
    evaluation.report.prompt_requirements[0].status = "missing"
    result = calculate_report(evaluation.report, payload)
    assert result.dimensions[0].score == 40
    assert result.overall_score == 93
    assert result.assessment_band == "Highly developed"
    assert result.recommendation.path == "Rebuild"
    assert result.recommendation.triggered_rules == ["promptAlignment_below_45"]
    assert result.missing_prompt_requirements[0].requirement_id == "r1"


def test_unknown_prompt_is_provisional_and_unscored_alignment():
    payload = json.loads(assessment_service.assessment_input(example_body(application_prompt=None)))
    evaluation = example_evaluation(payload)
    report = evaluation.report
    report.prompt_requirements = []
    report.prompt_requirements_status = "unknown"
    for checkpoint in report.dimensions[0].checkpoints:
        checkpoint.status, checkpoint.rating = "unknown", None
    validate_evaluation(evaluation, payload)
    result = calculate_report(report, payload)
    assert (result.overall_score, result.scored_weight, result.status, result.renormalized) == (75, 88, "provisional", True)
    assert result.dimensions[0].score is None


def test_unavailable_prompt_coverage_cannot_be_complete_or_high_confidence():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    evaluation = example_evaluation(payload)
    evaluation.report.prompt_requirements_status = "unknown"
    evaluation.report.prompt_requirements = []
    evaluation.report.confidence.level = "high"
    validate_evaluation(evaluation, payload)
    result = calculate_report(evaluation.report, payload)
    assert result.status == "provisional"
    assert result.confidence.level != "high"


def test_supplement_comparison_requires_main_statement():
    payload = json.loads(assessment_service.assessment_input(example_body(statement_type="supplemental_essay")))
    evaluation = example_evaluation(payload)
    validate_evaluation(evaluation, payload)
    result = calculate_report(evaluation.report, payload)
    assert result.dimensions[-1].score is None and result.status == "provisional"
    evaluation.report.dimensions[-1].checkpoints[0].status = "scored"
    evaluation.report.dimensions[-1].checkpoints[0].rating = 0
    with pytest.raises(ValueError, match="comparison_requires_main_statement"):
        validate_evaluation(evaluation, payload)


def test_ineligible_or_unusable_input_never_gets_a_total():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    evaluation = example_evaluation(payload)
    for dimension in evaluation.report.dimensions[:3]:
        for checkpoint in dimension.checkpoints:
            checkpoint.status, checkpoint.rating = "unknown", None
    result = calculate_report(evaluation.report, payload)
    assert result.status == "needs_input"
    assert result.overall_score is None and result.recommendation.path is None
    invalid = example_evaluation(payload).report
    invalid.input_issues = ["The text does not contain meaningful applicant prose."]
    assert calculate_report(invalid, payload).overall_score is None


@pytest.mark.parametrize("mutation,code", [
    (lambda value: setattr(value.report.strongest_sentence, "quote", "Invented quote."), "sentence_quote_mismatch"),
    (lambda value: value.report.dimensions[0].sentence_ids.append("s999"), "invalid_sentence_reference"),
    (lambda value: setattr(value.report.prompt_requirements[0], "prompt_quote", "Invented prompt requirement"), "requirement_quote_mismatch"),
    (lambda value: setattr(value.evidence_gap, "quote", "Invented evidence"), "evidence_gap_quote_mismatch"),
    (lambda value: value.evidence_examples.append(deepcopy(value.evidence_examples[0])), "duplicate_evidence_example"),
])
def test_source_mismatches_are_rejected(mutation, code):
    payload = json.loads(assessment_service.assessment_input(example_body()))
    evaluation = example_evaluation(payload)
    mutation(evaluation)
    with pytest.raises(ValueError, match=code):
        validate_evaluation(evaluation, payload)


def test_report_counts_weights_and_numeric_values_are_host_owned():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    evaluation = example_evaluation(payload)
    evaluation.report.measurements.word_count = 9999
    evaluation.report.dimensions[0].weight = 99
    evaluation.report.overall_score = 1
    result = calculate_report(evaluation.report, payload)
    assert result.measurements.word_count == payload["measurements"]["word_count"]
    assert result.dimensions[0].weight == 12
    assert result.overall_score == 75


def test_published_calculation_and_category_rounding_match_reference():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    report = example_evaluation(payload).report
    for dimension, total in zip(report.dimensions, [12, 13, 11, 13, 12, 13, 11, 10, 10], strict=True):
        remaining = total
        for checkpoint in dimension.checkpoints:
            checkpoint.rating = min(4, remaining)
            remaining -= checkpoint.rating
    result = calculate_report(report, payload)
    assert [item.score for item in result.dimensions] == [75, 80, 70, 80, 75, 80, 70, 65, 65]
    assert result.overall_unrounded == pytest.approx(73.2)
    assert result.overall_score == 73
    # A raw category score of 62.5 rounds upward to 65, not Python's ties-to-even.
    for checkpoint, rating in zip(report.dimensions[1].checkpoints, [3, 2, 3, 2], strict=True):
        checkpoint.rating = rating
    assert calculate_report(report, payload).dimensions[1].score == 65


@pytest.mark.parametrize("ratings,score,band", [
    ([3, 2, 2, 2], 55, "Material gaps"),
    ([3, 3, 3, 2], 70, "Credible draft"),
    ([4, 4, 4, 4], 100, "Highly developed"),
    ([0, 0, 0, 0], 0, "Rebuild recommended"),
])
def test_score_bands(ratings, score, band):
    payload = json.loads(assessment_service.assessment_input(example_body()))
    report = example_evaluation(payload).report
    for dimension in report.dimensions:
        for checkpoint, rating in zip(dimension.checkpoints, ratings, strict=True):
            checkpoint.rating = rating
    result = calculate_report(report, payload)
    assert (result.overall_score, result.assessment_band) == (score, band)


def test_partial_required_content_and_length_are_applied_once():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    report = example_evaluation(payload).report
    report.prompt_requirements[0].status = "partial"
    payload["limits"]["max_words"] = 1000
    payload["measurements"]["word_count"] = 1101
    result = calculate_report(report, payload)
    assert result.dimensions[0].score == 65
    assert result.dimensions[3].score == 55
    assert len(result.adjustments) == 2
    assert result.recommendation.path == "Refine"


def test_three_scorable_checkpoints_and_foundational_boundary():
    payload = json.loads(assessment_service.assessment_input(example_body()))
    report = example_evaluation(payload).report
    for checkpoint, rating in zip(report.dimensions[1].checkpoints, [2, 2, 2, 1], strict=True):
        checkpoint.rating = rating
    result = calculate_report(report, payload)
    assert result.dimensions[1].score == 45 and result.recommendation.path == "Refine"
    report.dimensions[1].checkpoints[2].rating = 1
    assert calculate_report(report, payload).recommendation.path == "Rebuild"
    report.dimensions[0].checkpoints[3].status = "not_applicable"
    report.dimensions[0].checkpoints[3].rating = None
    assert calculate_report(report, payload).dimensions[0].score == 75


def test_service_repairs_once_and_keeps_assessment_identity(monkeypatch, caplog):
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        payload = json.loads(kwargs["input_prompt"])
        evaluation = example_evaluation(payload)
        if len(calls) == 1:
            evaluation.report.strongest_sentence.quote = "private-invalid-quote-sentinel"
        return evaluation.model_dump_json()
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    settings = SimpleNamespace(free_assessment_max_output_tokens=4096, free_assessment_model="gpt-5", free_assessment_reasoning_effort="minimal")
    result = asyncio.run(assessment_service.run_free_assessment(example_body(), settings))
    assert result.schema_version == "free-diagnostic.v1" and result.report.overall_score == 75
    assert len(calls) == 2
    assert [call["model"] for call in calls] == ["gpt-5", "gpt-5"]
    assert [call["timeout_seconds"] for call in calls] == [180, 180]
    assert calls[0]["input_prompt"] == calls[1]["input_prompt"]
    assert calls[0]["output_model"] is AssessmentEvaluation
    assert "private-invalid-quote-sentinel" not in caplog.text
    assert "sentence_quote_mismatch" in caplog.text


def test_service_does_not_return_invalid_output_after_repair(monkeypatch, caplog):
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return '{"private-input-sentinel": "invalid"}'
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    settings = SimpleNamespace(free_assessment_max_output_tokens=4096, free_assessment_model="gpt-5", free_assessment_reasoning_effort="minimal")
    with pytest.raises(LLMError):
        asyncio.run(assessment_service.run_free_assessment(example_body(), settings))
    assert len(calls) == 2
    assert [call["model"] for call in calls] == ["gpt-5", "gpt-5"]
    assert "private-input-sentinel" not in caplog.text


def test_free_wall_deadline_covers_initial_and_repair_attempts(monkeypatch, caplog):
    calls = []
    cancelled = []
    async def generate(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            return '{"private-input-sentinel": "invalid"}'
        try:
            await asyncio.sleep(1)
        except asyncio.CancelledError:
            cancelled.append(True)
            raise
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    monkeypatch.setattr(assessment_service, "FREE_ASSESSMENT_TIMEOUT_SECONDS", 0.02)
    settings = SimpleNamespace(free_assessment_max_output_tokens=4096, free_assessment_model="gpt-5", free_assessment_reasoning_effort="minimal")
    with pytest.raises(LLMError, match="timed out"):
        asyncio.run(assessment_service.run_free_assessment(example_body(), settings))
    assert len(calls) == 2 and cancelled == [True]
    assert "type=TimeoutError" in caplog.text
    assert "private-input-sentinel" not in caplog.text


FREE_SETTINGS = SimpleNamespace(free_assessment_max_output_tokens=4096, free_assessment_model="gpt-5", free_assessment_reasoning_effort="minimal")


class MemoryRecords:
    """In-memory stand-in for AssessmentRecordService, shared by the request and its background job."""

    def __init__(self, fail_create=False):
        self.rows, self.fail_create = {}, fail_create

    def create_pending(self, owner_id, assessment_id, original_input, model):
        if self.fail_create:
            raise OperationalError("INSERT", {}, Exception("connection lost"))
        self.rows[assessment_id] = {"owner": owner_id, "status": "generating", "input": original_input,
                                    "model": model, "result": None, "error": None, "seconds": None}

    def _resolve(self, assessment_id, **values):
        row = self.rows.get(assessment_id)
        if row is None or row["status"] != "generating":
            return False
        row.update(values)
        return True

    def mark_ready(self, assessment_id, assessment, seconds):
        return self._resolve(assessment_id, status="ready", result=assessment, seconds=seconds)

    def mark_failed(self, assessment_id, error, seconds=None):
        return self._resolve(assessment_id, status="failed", error=error, seconds=seconds)

    def free_state(self, assessment_id, owner_id, stale_after_seconds):
        row = self.rows.get(assessment_id)
        if row is None or row["owner"] != owner_id:
            return None
        return FreeAssessmentState(assessment_id=assessment_id, status=row["status"], assessment=row["result"],
                                   generation_seconds=row["seconds"], error=row["error"])

    def factory(self):
        @contextmanager
        def records():
            yield self
        return records


def free_app(records, owner):
    from depth.dependencies import get_assessment_record_factory, get_assessment_records
    app = FastAPI()
    app.state.settings = FREE_SETTINGS
    app.state.background_tasks = set()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_session] = lambda: SimpleNamespace(user_id=owner[0])
    app.dependency_overrides[get_assessment_records] = lambda: records
    app.dependency_overrides[get_assessment_record_factory] = records.factory
    return app


def wait_for_free(client, assessment_id):
    for _ in range(200):
        state = client.get(f"/api/assessments/{assessment_id}/free").json()
        if state["status"] != "generating":
            return state
        time.sleep(0.01)
    pytest.fail("Background assessment did not finish")


def test_free_post_returns_generating_then_get_returns_the_saved_v1_result(monkeypatch):
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return example_evaluation(json.loads(kwargs["input_prompt"])).model_dump_json()
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    records, owner = MemoryRecords(), ["owner-1"]
    body = example_body()
    with TestClient(free_app(records, owner)) as client:
        started = client.post("/api/assessments/free", json=body.model_dump())
        assert started.status_code == 202 and started.headers["cache-control"] == "no-store"
        assert started.headers["content-type"].startswith("application/json")
        assessment_id = started.json()["assessment_id"]
        assert started.json() == {"assessment_id": assessment_id, "status": "generating", "assessment": None,
                                  "generation_seconds": None, "error": None}
        row = records.rows[assessment_id]
        assert row["input"]["assessment_id"] == assessment_id and row["input"]["statement_text"] == body.statement_text
        state = wait_for_free(client, assessment_id)
        assert state["status"] == "ready" and state["generation_seconds"] >= 0
        result = FreeDiagnosticResponse.model_validate(state["assessment"])
        assert result.schema_version == "free-diagnostic.v1" and result.report.assessment_id == assessment_id
        assert json.loads(calls[0]["input_prompt"]) == row["input"]
        owner[0] = "owner-2"
        assert client.get(f"/api/assessments/{assessment_id}/free").status_code == 404
        assert client.get("/api/assessments/missing/free").status_code == 404


def test_free_failure_is_saved_without_provider_details(monkeypatch):
    async def fail(**kwargs):
        raise LLMError("private-provider-detail")
    monkeypatch.setattr(assessment_service, "generate_text", fail)
    records = MemoryRecords()
    with TestClient(free_app(records, ["owner-1"])) as client:
        assessment_id = client.post("/api/assessments/free", json=example_body().model_dump()).json()["assessment_id"]
        state = wait_for_free(client, assessment_id)
    assert state["status"] == "failed" and state["assessment"] is None and "try again" in state["error"]
    assert "private-provider-detail" not in json.dumps(state)


def test_free_is_not_started_when_its_row_cannot_be_saved(monkeypatch):
    async def generate(**kwargs):
        pytest.fail("The model must not run without a saved row")
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    records = MemoryRecords(fail_create=True)
    app = free_app(records, ["owner-1"])
    with TestClient(app) as client:
        response = client.post("/api/assessments/free", json=example_body().model_dump())
    assert response.status_code == 503 and not app.state.background_tasks


def test_free_shutdown_marks_the_running_assessment_failed(monkeypatch):
    async def generate(**kwargs):
        await asyncio.Future()  # The model never answers.
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    records = MemoryRecords()
    async def scenario():
        tasks = set()
        state = await assessment_service.start_free_assessment(
            example_body(), FREE_SETTINGS, "owner-1", records, records.factory(), tasks,
        )
        assert state.status == "generating" and len(tasks) == 1
        await asyncio.sleep(0)
        for task in list(tasks):  # What the app lifespan does on shutdown.
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        return state.assessment_id
    assessment_id = asyncio.run(scenario())
    assert records.rows[assessment_id]["status"] == "failed" and "interrupted" in records.rows[assessment_id]["error"]


def test_shared_frontend_fixture_matches_backend_contract():
    fixture = Path(__file__).parents[2] / "Surface/tests/fixtures/free-diagnostic.v1.json"
    if fixture.exists():
        response = FreeDiagnosticResponse.model_validate_json(fixture.read_text(encoding="utf-8"))
        assert response.report.overall_score == 75
