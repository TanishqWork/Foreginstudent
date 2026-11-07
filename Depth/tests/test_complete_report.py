"""Temporary complete-report tests: no database, provider, or payment traffic."""

import asyncio
import json
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from fastapi import FastAPI
from fastapi.testclient import TestClient

from depth.core.exceptions import AssessmentError, AuthenticationError, LLMError
from depth.core.handlers import register_exception_handlers
from depth.routes.assessment import require_session, router
from depth.services import assessment_service, complete_report_service
from depth.services.assessment_store import AssessmentStore
from depth.schemas.complete_report_content import CompleteReportContent
from depth.services.complete_report_validation import validate_complete_report
from complete_report_fixture import example_complete_report
from test_assessment import example_body, example_evaluation, example_response


def seed(store, assessment_id="assessment-a", owner="owner-1", needs_input=False):
    payload = json.loads(assessment_service.assessment_input(example_body()))
    payload["assessment_id"] = assessment_id
    assessment = example_response()
    assessment.report.assessment_id = assessment_id
    if needs_input:
        assessment.report.status = "needs_input"
        assessment.report.overall_score = assessment.report.assessment_band = None
        assessment.report.recommendation.path = None
        assessment.diagnostic.revision_opportunity = None
    store.save(owner, payload, assessment)
    return payload, assessment


def test_cache_owns_copies_and_hides_other_users():
    store = AssessmentStore()
    payload, assessment = seed(store)
    expected_payload, expected_assessment = json.loads(json.dumps(payload)), assessment.model_dump()
    payload["statement_text"] = "edited after caching"
    assessment.report.overall_score = 0
    entry = store.get("assessment-a", "owner-1")
    assert entry.original_input == expected_payload
    assert entry.assessment.model_dump() == expected_assessment
    entry.original_input["statement_text"] = "mutated view"
    entry.assessment.report.overall_score = 1
    assert store.get("assessment-a", "owner-1").original_input == expected_payload
    assert store.get("assessment-a", "owner-1").assessment.report.overall_score == 75
    for owner, assessment_id in [("owner-2", "assessment-a"), ("owner-1", "missing")]:
        for action in [store.get, store.unlock, store.begin_generation]:
            with pytest.raises(AssessmentError, match="not_found"):
                action(assessment_id, owner)


def test_cache_expiry_capacity_and_generation_pinning():
    now = [0.0]
    store = AssessmentStore(capacity=2, ttl_seconds=10, clock=lambda: now[0])
    seed(store, "a")
    seed(store, "b")
    store.unlock("a", "owner-1")
    store.begin_generation("a", "owner-1")
    now[0] = 11
    with pytest.raises(AssessmentError, match="not_found"):
        store.get("b", "owner-1")
    assert store.get("a", "owner-1").status == "generating"
    seed(store, "c")
    seed(store, "d")
    with pytest.raises(AssessmentError, match="not_found"):
        store.get("c", "owner-1")
    assert store.get("a", "owner-1").status == "generating"
    report = example_complete_report(store.get("a", "owner-1"))
    store.finish("a", "owner-1", report, 1.25)
    now[0] = 20
    assert store.get("a", "owner-1").report == report
    now[0] = 22
    with pytest.raises(AssessmentError, match="not_found"):
        store.get("a", "owner-1")


def test_full_cache_never_evicts_a_running_report():
    store = AssessmentStore(capacity=1)
    seed(store)
    store.unlock("assessment-a", "owner-1")
    store.begin_generation("assessment-a", "owner-1")
    with pytest.raises(AssessmentError, match="capacity"):
        seed(store, "b")
    assert store.get("assessment-a", "owner-1").status == "generating"


def test_mock_unlock_is_idempotent_and_needs_a_score():
    store = AssessmentStore()
    _, assessment = seed(store)
    with pytest.raises(AssessmentError, match="locked"):
        store.begin_generation("assessment-a", "owner-1")
    first = complete_report_service.mock_unlock("assessment-a", "owner-1", store)
    second = complete_report_service.mock_unlock("assessment-a", "owner-1", store)
    assert first.status == second.status == "unlocked"
    assert second.assessment.model_dump() == assessment.model_dump()
    seed(store, "invalid", needs_input=True)
    for action in [store.unlock, store.begin_generation]:
        with pytest.raises(AssessmentError, match="needs_input"):
            action("invalid", "owner-1")


def test_free_success_caches_the_exact_input_and_full_response(monkeypatch):
    store = AssessmentStore()
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return example_evaluation(json.loads(kwargs["input_prompt"])).model_dump_json()
    monkeypatch.setattr(assessment_service, "generate_text", generate)
    body = example_body()
    response = asyncio.run(assessment_service.run_free_assessment(
        body, SimpleNamespace(free_assessment_max_output_tokens=4096), owner_id="owner-1", store=store,
    ))
    entry = store.get(response.report.assessment_id, "owner-1")
    assert entry.original_input == json.loads(calls[0]["input_prompt"])
    assert entry.original_input["statement_text"] == body.statement_text
    assert entry.assessment.model_dump() == response.model_dump()
    assert entry.status == "locked"
    assert entry.free_generation_seconds is not None and entry.free_generation_seconds >= 0


def test_structured_generation_uses_selected_prompt_and_reuses_ready_report(monkeypatch):
    store = AssessmentStore()
    original, assessment = seed(store)
    store.unlock("assessment-a", "owner-1")
    calls = []
    report = example_complete_report(store.get("assessment-a", "owner-1"), 12)
    async def generate(**kwargs):
        calls.append(kwargs)
        return report.model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    first = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    second = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert first == second and first.report == report
    assert first.generation_seconds >= 0 and len(calls) == 1
    call = calls[0]
    assert call["model"] == "gpt-5" and call["reasoning_effort"] == "medium"
    assert call["max_output_tokens"] == 32768
    assert call["timeout_seconds"] == 270
    assert call["output_model"] is CompleteReportContent
    prompt = call["system_prompt"]
    assert prompt == complete_report_service.complete_report_prompt()
    assert "Return one JSON object" in prompt and "every sentence" in prompt
    assert "four checkpoints" in prompt and "provisional baseline stays provisional" in prompt
    assert "no fixed UI quota" in prompt
    data = json.loads(call["input_prompt"])
    assert data["original_input"] == original
    assert data["first_assessment"] == assessment.report.model_dump()
    assert data["first_diagnostic"] == assessment.diagnostic.model_dump()
    assert data["paragraphs"][0]["sentence_ids"] == ["s1", "s2", "s3"]
    assert len(data["rubric_dimensions"]) == len(assessment.report.dimensions)
    assert all(len(item["checkpoints"]) == 4 for item in data["rubric_dimensions"])
    state = complete_report_service.complete_report_state("assessment-a", "owner-1", store)
    assert state.status == "ready" and state.report == report
    assert state.assessment.model_dump() == assessment.model_dump()


def test_concurrent_generation_is_rejected_before_a_second_provider_call(monkeypatch):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    calls = []
    async def scenario():
        started, release = asyncio.Event(), asyncio.Event()
        async def generate(**kwargs):
            calls.append(kwargs)
            started.set()
            await release.wait()
            return example_complete_report(store.get("assessment-a", "owner-1")).model_dump_json()
        monkeypatch.setattr(complete_report_service, "generate_text", generate)
        task = asyncio.create_task(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
        await started.wait()
        assert complete_report_service.complete_report_state("assessment-a", "owner-1", store).status == "generating"
        with pytest.raises(AssessmentError, match="generating"):
            await complete_report_service.generate_complete_report("assessment-a", "owner-1", store)
        release.set()
        await task
    asyncio.run(scenario())
    assert len(calls) == 1


@pytest.mark.parametrize("failure", [LLMError("private-provider-sentinel"), RuntimeError("private-provider-sentinel")])
def test_failure_keeps_mock_unlock_and_allows_retry(monkeypatch, caplog, failure):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    async def fail(**kwargs):
        raise failure
    monkeypatch.setattr(complete_report_service, "generate_text", fail)
    with pytest.raises(LLMError) as caught:
        asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    state = complete_report_service.complete_report_state("assessment-a", "owner-1", store)
    assert state.status == "failed" and state.report is None and "mock unlock is kept" in state.error
    assert "private-provider-sentinel" not in str(caught.value) + caplog.text + state.error
    async def succeed(**kwargs):
        return example_complete_report(store.get("assessment-a", "owner-1")).model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", succeed)
    assert asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store)).report.report_status == "ready"


def test_cancellation_clears_generating_state(monkeypatch):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    async def scenario():
        started = asyncio.Event()
        async def generate(**kwargs):
            started.set()
            await asyncio.Future()
        monkeypatch.setattr(complete_report_service, "generate_text", generate)
        task = asyncio.create_task(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    asyncio.run(scenario())
    assert store.get("assessment-a", "owner-1").status == "failed"
    assert store.begin_generation("assessment-a", "owner-1").status == "generating"


def test_wall_timeout_and_empty_output_leave_retryable_state(monkeypatch):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    monkeypatch.setattr(complete_report_service, "COMPLETE_REPORT_TIMEOUT_SECONDS", 0.001)
    async def slow(**kwargs):
        await asyncio.sleep(1)
        return "Too late"
    monkeypatch.setattr(complete_report_service, "generate_text", slow)
    with pytest.raises(LLMError, match="timed out"):
        asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert store.get("assessment-a", "owner-1").status == "failed"
    async def empty(**kwargs):
        return "  "
    monkeypatch.setattr(complete_report_service, "generate_text", empty)
    with pytest.raises(LLMError):
        asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert store.get("assessment-a", "owner-1").status == "failed"


def app_for(store, owner):
    app = FastAPI()
    app.state.assessment_store = store
    app.state.settings = object()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_session] = lambda: SimpleNamespace(user_id=owner[0])
    return app


def test_http_state_unlock_json_headers_and_owner_enforcement(monkeypatch):
    store, owner = AssessmentStore(), ["owner-1"]
    _, assessment = seed(store)
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return example_complete_report(store.get("assessment-a", "owner-1")).model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    with TestClient(app_for(store, owner)) as client:
        response = client.get("/api/assessments/assessment-a/complete")
        assert response.status_code == 200 and response.json()["status"] == "locked"
        assert response.headers["cache-control"] == "no-store"
        assert client.post("/api/assessments/assessment-a/complete").status_code == 403
        for _ in range(2):
            response = client.post("/api/assessments/assessment-a/mock-unlock")
            assert response.status_code == 200 and response.json()["status"] == "unlocked"
        response = client.post("/api/assessments/assessment-a/complete")
        assert response.status_code == 200 and response.json()["report"]["report_version"] == "complete-report.v1"
        assert response.headers["content-type"].startswith("application/json")
        assert response.headers["cache-control"] == "no-store"
        assert float(response.headers["x-generation-seconds"]) >= 0
        state = client.get("/api/assessments/assessment-a/complete").json()
        assert state["status"] == "ready" and state["assessment"] == assessment.model_dump()
        assert client.post("/api/assessments/assessment-a/complete").json() == response.json()
        assert len(calls) == 1
        owner[0] = "owner-2"
        for method, suffix in [(client.get, "complete"), (client.post, "mock-unlock"), (client.post, "complete")]:
            denied = method(f"/api/assessments/assessment-a/{suffix}")
            missing = method(f"/api/assessments/missing/{suffix}")
            assert denied.status_code == missing.status_code == 404
            assert denied.json() == missing.json()


def test_http_needs_input_failure_and_authentication(monkeypatch):
    store, owner = AssessmentStore(), ["owner-1"]
    seed(store, needs_input=True)
    app = app_for(store, owner)
    with TestClient(app) as client:
        assert client.post("/api/assessments/assessment-a/mock-unlock").status_code == 422
        assert client.post("/api/assessments/assessment-a/complete").status_code == 422
        seed(store, "valid")
        client.post("/api/assessments/valid/mock-unlock")
        async def fail(**kwargs):
            raise LLMError("private-provider-detail")
        monkeypatch.setattr(complete_report_service, "generate_text", fail)
        response = client.post("/api/assessments/valid/complete")
        assert response.status_code == 502 and "private-provider-detail" not in response.text
        assert client.get("/api/assessments/valid/complete").json()["status"] == "failed"
        def unauthorized():
            raise AuthenticationError()
        app.dependency_overrides[require_session] = unauthorized
        assert client.get("/api/assessments/valid/complete").status_code == 401


def test_http_generation_conflict_is_409(monkeypatch):
    store, owner = AssessmentStore(), ["owner-1"]
    seed(store)
    store.unlock("assessment-a", "owner-1")
    store.begin_generation("assessment-a", "owner-1")
    async def unexpected_call(**kwargs):
        pytest.fail("A duplicate request must not call the provider")
    monkeypatch.setattr(complete_report_service, "generate_text", unexpected_call)
    with TestClient(app_for(store, owner)) as client:
        response = client.post("/api/assessments/assessment-a/complete")
        assert response.status_code == 409 and response.headers["cache-control"] == "no-store"
        assert client.get("/api/assessments/assessment-a/complete").json()["status"] == "generating"


def test_all_sections_dynamic_arrays_and_host_coverage():
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
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
    store = AssessmentStore()
    seed(store)
    payload = example_complete_report(store.get("assessment-a", "owner-1")).model_dump()
    for blank in ["", " \n\t"]:
        payload["criterion_details"][0]["recorded_adjustment_explanation"] = blank
        with pytest.raises(ValidationError, match="string_pattern_mismatch"):
            CompleteReportContent.model_validate(payload)
    provider_schema = CompleteReportContent.model_json_schema()
    field = provider_schema["$defs"]["CriterionDetail"]["properties"]["recorded_adjustment_explanation"]
    assert field["pattern"] == r"\S"


@pytest.mark.parametrize("change,code", [
    (lambda r: setattr(r.executive_summary, "overall_score", 1), "baseline_mismatch"),
    (lambda r: setattr(r.criterion_details[0].baseline, "score", 1), "baseline_mismatch"),
    (lambda r: setattr(r.criterion_details[0].checkpoints[0], "rating", 0), "baseline_mismatch"),
    (lambda r: r.criterion_details.pop(), "missing_source_rows"),
    (lambda r: r.sentence_reviews.pop(), "missing_source_rows"),
    (lambda r: r.paragraph_reviews.pop(), "missing_source_rows"),
    (lambda r: r.sentence_reviews.append(r.sentence_reviews[0]), "duplicate_source_id"),
    (lambda r: setattr(r.sentence_reviews[0], "text", "private-source-sentinel"), "source_mismatch"),
    (lambda r: setattr(r.paragraph_reviews[0], "text", "private-source-sentinel"), "source_mismatch"),
    (lambda r: setattr(r.evidence_gaps[0].evidence[0], "quote", "private-source-sentinel"), "quote_mismatch"),
    (lambda r: setattr(r.evidence_gaps[0], "criterion_ids", ["private-source-sentinel"]), "invalid_reference"),
    (lambda r: setattr(r.prompt_coverage.requirements[0], "status", "missing"), "baseline_mismatch"),
    (lambda r: setattr(r.prompt_coverage.limit_compliance, "max_words", 123), "baseline_mismatch"),
    (lambda r: setattr(r.revision_plan[0], "depends_on", ["step:1"]), "dependency_order"),
    (lambda r: setattr(r.revision_plan[0], "related_finding_ids", ["private-source-sentinel"]), "invalid_reference"),
    (lambda r: r.evidence_gaps.append(r.evidence_gaps[0]), "duplicate_identifier"),
    (lambda r: setattr(r.sentence_reviews[0], "action", "preserve"), "disposition_action_mismatch"),
    (lambda r: setattr(r.criterion_details[0].checkpoints[0], "explanation", "  "), "blank_narrative"),
])
def test_guard_rejects_changed_baselines_missing_rows_bad_refs_and_quotes(change, code):
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
    report = example_complete_report(entry)
    change(report)
    with pytest.raises(ValueError, match=code) as caught:
        validate_complete_report(report, entry)
    assert "private-source-sentinel" not in str(caught.value)


def test_incomplete_and_review_required_are_preserved_honestly():
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
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


def test_structured_validation_repairs_once_without_logging_private_keys(monkeypatch, caplog):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    report = example_complete_report(store.get("assessment-a", "owner-1"))
    invalid = report.model_dump()
    invalid["sentence_reviews"][0]["private-key-sentinel"] = "private-value-sentinel"
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return json.dumps(invalid) if len(calls) == 1 else report.model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    result = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert result.report == report and len(calls) == 2
    assert "unexpected_field" in calls[1]["system_prompt"]
    assert "private-key-sentinel" not in calls[1]["system_prompt"] + caplog.text
    assert "private-value-sentinel" not in calls[1]["system_prompt"] + caplog.text


def test_generation_accepts_incomplete_content_without_claiming_ready_analysis(monkeypatch):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    report = example_complete_report(store.get("assessment-a", "owner-1"))
    report.report_status = "incomplete"
    report.input_issues = ["The final sentence review is unfinished."]
    report.sentence_reviews.pop()
    async def generate(**kwargs):
        return report.model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    state = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert state.status == "ready" and state.report.report_status == "incomplete"
    assert state.report.coverage.unreviewed_sentence_ids == ["s5"]


def test_criterion_review_requires_its_matching_baseline_discrepancy():
    from depth.schemas.complete_report_content import Discrepancy
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
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
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
    report = example_complete_report(entry)
    report.revision_plan = []
    with pytest.raises(ValueError, match="revision_plan:missing_required_steps"):
        validate_complete_report(report, entry)


@pytest.mark.parametrize("field", ["criterion_details", "sentence_reviews", "paragraph_reviews", "prompt_requirements"])
def test_source_backed_findings_require_canonical_link_ids(field):
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
    report = example_complete_report(entry)
    rows = report.prompt_coverage.requirements if field == "prompt_requirements" else getattr(report, field)
    rows[0].finding_id = "custom:private-identifier-sentinel"
    with pytest.raises(ValueError, match="canonical_finding_id") as caught:
        validate_complete_report(report, entry)
    assert "private-identifier-sentinel" not in str(caught.value)


@pytest.mark.parametrize("field,bad_id", [("evidence_gaps", "custom:1"), ("evidence_gaps", "gap:"),
                                        ("cut_or_expand", "claim:1"), ("revision_plan", "step: ")])
def test_diagnostic_findings_require_their_group_prefix_and_suffix(field, bad_id):
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
    report = example_complete_report(entry)
    getattr(report, field)[0].finding_id = bad_id
    with pytest.raises(ValueError, match="finding_id_prefix"):
        validate_complete_report(report, entry)


def test_incomplete_can_retry_atomically_and_complete_results_stay_cached(monkeypatch):
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    ready = example_complete_report(store.get("assessment-a", "owner-1"))
    partial = ready.model_copy(deep=True)
    partial.report_status = "incomplete"
    partial.input_issues = ["The final sentence review is unfinished."]
    partial.sentence_reviews.pop()
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        if len(calls) == 2:
            assert store.get("assessment-a", "owner-1").status == "generating"
            with pytest.raises(AssessmentError, match="generating"):
                store.begin_generation("assessment-a", "owner-1")
        return (partial if len(calls) == 1 else ready).model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    first = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert first.status == "ready" and first.report.report_status == "incomplete"
    second = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    third = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert second == third and second.report.report_status == "ready" and len(calls) == 2


def test_review_required_report_is_cached_without_automatic_regeneration(monkeypatch):
    from depth.schemas.complete_report_content import Discrepancy
    store = AssessmentStore()
    seed(store)
    store.unlock("assessment-a", "owner-1")
    report = example_complete_report(store.get("assessment-a", "owner-1"))
    report.report_status = "review_required"
    report.discrepancies = [Discrepancy(finding_id="discrepancy:1", baseline_field="/main_concern",
                                      issue="The saved concern needs review.", evidence=[], resolution_needed="Review the concern.")]
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return report.model_dump_json()
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    first = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    second = asyncio.run(complete_report_service.generate_complete_report("assessment-a", "owner-1", store))
    assert first == second and second.report.report_status == "review_required" and len(calls) == 1


def test_cut_cannot_contradict_keep_unless_paragraph_reconstruction_is_documented():
    store = AssessmentStore()
    seed(store)
    entry = store.get("assessment-a", "owner-1")
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
