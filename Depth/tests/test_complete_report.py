"""Complete-report workflow over its saved status: no database, provider, or payment traffic.

MemoryReports mirrors CompleteReportRecordService; the real SQL is covered in test_complete_report_records.py.
"""

import asyncio
import json
import time
from contextlib import contextmanager
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from complete_report_fixture import draft_of, example_complete_report, make_source
from depth.core.exceptions import AssessmentError, AuthenticationError, LLMError
from depth.core.handlers import register_exception_handlers
from depth.database.base import utcnow
from depth.dependencies import get_complete_report_record_factory, get_complete_report_records
from depth.routes.assessment import require_session, router
from depth.schemas.complete_report_content import Discrepancy
from depth.schemas.complete_report_draft import DraftCompleteReport
from depth.services import complete_report_service
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.complete_report_record_service import (
    INTERRUPTED_MESSAGE, CompleteReportRecordService, LoadedReport, ReportRecord,
)

OWNER = "owner-1"
ID = "assessment-a"


class MemoryReports:
    """In-memory stand-in for CompleteReportRecordService, shared by requests and background jobs."""

    def __init__(self):
        self.sources, self.rows = {}, {}

    def add(self, source, owner=OWNER):
        self.sources[(source.assessment.report.assessment_id, owner)] = source
        return source

    def load(self, assessment_id, owner_id, stale_after_seconds):
        source = self.sources.get((assessment_id, owner_id))
        if source is None:
            return None
        row = self.rows.get(assessment_id)
        if row and row["status"] == "generating" and row["started_at"] < utcnow() - timedelta(seconds=stale_after_seconds):
            self.fail(assessment_id, row["started_at"], INTERRUPTED_MESSAGE, None)
        if row is None:
            return LoadedReport(source, None)
        return LoadedReport(source, ReportRecord(row["status"], row["report"], row["error"], row["seconds"], row["started_at"]))

    def unlock(self, assessment_id, owner_id, model):
        self.rows.setdefault(assessment_id, {"owner": owner_id, "status": "unlocked", "report": None, "error": None,
                                             "seconds": None, "started_at": None, "model": model})

    def claim(self, assessment_id, owner_id):
        row = self.rows.get(assessment_id)
        retryable = row and (row["status"] in ("unlocked", "failed") or (
            row["status"] == "ready" and row["report"].report_status == "incomplete"))
        if not retryable or row["owner"] != owner_id:
            return None
        started_at = utcnow()
        row.update(status="generating", started_at=started_at, report=None, error=None, seconds=None)
        return started_at

    def _finish_run(self, assessment_id, started_at, **values):
        row = self.rows.get(assessment_id)
        if row is None or row["status"] != "generating" or row["started_at"] != started_at:
            return False
        row.update(values)
        return True

    def finish(self, assessment_id, started_at, report, seconds):
        return self._finish_run(assessment_id, started_at, status="ready", report=report, error=None, seconds=seconds)

    def fail(self, assessment_id, started_at, error, seconds):
        return self._finish_run(assessment_id, started_at, status="failed", report=None, error=error, seconds=seconds)

    def factory(self):
        @contextmanager
        def reports():
            yield self
        return reports


def unlocked(needs_input=False):
    reports = MemoryReports()
    source = reports.add(make_source(ID, needs_input=needs_input))
    if not needs_input:
        reports.unlock(ID, OWNER, "gpt-5")
    return reports, source


def use_model(monkeypatch, respond):
    calls = []
    async def generate(**kwargs):
        calls.append(kwargs)
        return await respond(len(calls), kwargs)
    monkeypatch.setattr(complete_report_service, "generate_text", generate)
    return calls


async def start_and_wait(reports, assessment_id=ID, owner=OWNER):
    """Start a run and wait for its background job, as a client polling GET would."""
    tasks = set()
    started = await complete_report_service.start_complete_report(assessment_id, owner, reports, reports.factory(), tasks)
    await asyncio.gather(*tasks, return_exceptions=True)
    return started, complete_report_service.complete_report_state(assessment_id, owner, reports)


def test_state_unlock_and_ownership():
    reports = MemoryReports()
    source = reports.add(make_source(ID))
    state = complete_report_service.complete_report_state(ID, OWNER, reports)
    assert state.status == "locked" and state.report is None and state.free_generation_seconds == 12.5
    assert state.assessment == source.assessment
    for _ in range(2):  # Unlocking twice keeps one row.
        assert complete_report_service.mock_unlock(ID, OWNER, reports).status == "unlocked"
    assert len(reports.rows) == 1
    for owner, assessment_id in [("owner-2", ID), (OWNER, "missing")]:
        for action in [complete_report_service.complete_report_state, complete_report_service.mock_unlock]:
            with pytest.raises(AssessmentError, match="not_found"):
                action(assessment_id, owner, reports)


def test_locked_and_needs_input_cannot_generate():
    reports, _ = unlocked(needs_input=True)
    with pytest.raises(AssessmentError, match="needs_input"):
        complete_report_service.mock_unlock(ID, OWNER, reports)
    with pytest.raises(AssessmentError, match="needs_input"):
        asyncio.run(start_and_wait(reports))
    locked = MemoryReports()
    locked.add(make_source(ID))
    with pytest.raises(AssessmentError, match="locked"):
        asyncio.run(start_and_wait(locked))


def test_start_returns_generating_then_saves_the_report_built_from_the_saved_assessment(monkeypatch):
    reports, source = unlocked()
    report = example_complete_report(source, 12)
    async def respond(count, kwargs):
        assert reports.rows[ID]["status"] == "generating"  # Polls see the running state.
        return draft_of(report).model_dump_json()
    calls = use_model(monkeypatch, respond)
    started, finished = asyncio.run(start_and_wait(reports))
    assert started.status == "generating" and started.report is None
    assert finished.status == "ready" and finished.report == report and finished.generation_seconds >= 0
    assert len(calls) == 1
    call = calls[0]
    assert call["model"] == "gpt-5" and call["reasoning_effort"] == "medium"
    assert call["max_output_tokens"] == 32768 and call["timeout_seconds"] == 420
    assert call["output_model"] is DraftCompleteReport
    prompt = call["system_prompt"]
    assert prompt == complete_report_service.complete_report_prompt()
    assert "Return one JSON object" in prompt and "every sentence" in prompt
    assert "four checkpoints" in prompt and "provisional baseline stays provisional" in prompt
    assert "no fixed UI quota" in prompt
    data = json.loads(call["input_prompt"])
    assert data["original_input"] == source.original_input
    assert data["first_assessment"] == source.assessment.report.model_dump()
    assert data["first_diagnostic"] == source.assessment.diagnostic.model_dump()
    assert data["paragraphs"][0]["sentence_ids"] == ["s1", "s2", "s3"]
    assert len(data["rubric_dimensions"]) == len(source.assessment.report.dimensions)
    assert all(len(item["checkpoints"]) == 4 for item in data["rubric_dimensions"])
    # A ready report is returned as saved, without another model call.
    again, _ = asyncio.run(start_and_wait(reports))
    assert again == finished and len(calls) == 1


def test_a_second_start_while_generating_is_rejected_before_any_model_call(monkeypatch):
    reports, source = unlocked()
    async def scenario():
        started, release = asyncio.Event(), asyncio.Event()
        async def respond(count, kwargs):
            started.set()
            await release.wait()
            return draft_of(example_complete_report(source)).model_dump_json()
        calls = use_model(monkeypatch, respond)
        tasks = set()
        await complete_report_service.start_complete_report(ID, OWNER, reports, reports.factory(), tasks)
        await started.wait()
        with pytest.raises(AssessmentError, match="generating"):
            await complete_report_service.start_complete_report(ID, OWNER, reports, reports.factory(), set())
        release.set()
        await asyncio.gather(*tasks)
        return calls
    assert len(asyncio.run(scenario())) == 1


def test_losing_the_atomic_claim_reports_generating(monkeypatch):
    reports, _ = unlocked()
    monkeypatch.setattr(reports, "claim", lambda *args: None)  # Another process won the UPDATE.
    with pytest.raises(AssessmentError, match="generating"):
        asyncio.run(start_and_wait(reports))


@pytest.mark.parametrize("failure", [LLMError("private-provider-sentinel"), RuntimeError("private-provider-sentinel")])
def test_failure_keeps_the_unlock_and_allows_retry(monkeypatch, caplog, failure):
    reports, source = unlocked()
    async def fail(count, kwargs):
        raise failure
    use_model(monkeypatch, fail)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "failed" and state.report is None and "mock unlock is kept" in state.error
    assert "private-provider-sentinel" not in caplog.text + state.error
    async def succeed(count, kwargs):
        return draft_of(example_complete_report(source)).model_dump_json()
    use_model(monkeypatch, succeed)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "ready" and state.report.report_status == "ready"


def test_shutdown_marks_the_run_failed_and_it_can_restart(monkeypatch):
    reports, _ = unlocked()
    async def scenario():
        started = asyncio.Event()
        async def never(count, kwargs):
            started.set()
            await asyncio.Future()
        use_model(monkeypatch, never)
        tasks = set()
        await complete_report_service.start_complete_report(ID, OWNER, reports, reports.factory(), tasks)
        await started.wait()
        for task in list(tasks):  # What the app lifespan does on shutdown.
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        assert not tasks
    asyncio.run(scenario())
    assert reports.rows[ID]["status"] == "failed" and "interrupted" in reports.rows[ID]["error"]
    assert reports.claim(ID, OWNER) is not None


def test_wall_timeout_leaves_a_retryable_failure(monkeypatch):
    reports, _ = unlocked()
    async def slow(count, kwargs):
        await asyncio.sleep(1)
    use_model(monkeypatch, slow)
    monkeypatch.setattr(complete_report_service, "COMPLETE_REPORT_TIMEOUT_SECONDS", 0.02)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "failed" and "timed out" in state.error


def test_a_run_lost_to_a_restart_is_marked_failed_when_read_and_cannot_overwrite_a_newer_run():
    reports, source = unlocked()
    old_start = reports.claim(ID, OWNER) - timedelta(seconds=complete_report_service.COMPLETE_REPORT_STALE_SECONDS + 1)
    reports.rows[ID]["started_at"] = old_start
    state = complete_report_service.complete_report_state(ID, OWNER, reports)
    assert state.status == "failed" and "interrupted" in state.error
    assert reports.claim(ID, OWNER) is not None
    # The old run finishing late is ignored; only the current run may save.
    assert reports.finish(ID, old_start, example_complete_report(source), 1.0) is False
    assert reports.rows[ID]["status"] == "generating"


def test_validation_repairs_once_without_logging_private_keys(monkeypatch, caplog):
    reports, source = unlocked()
    report = example_complete_report(source)
    invalid = draft_of(report).model_dump()
    invalid["sentence_reviews"][0]["private-key-sentinel"] = "private-value-sentinel"
    async def respond(count, kwargs):
        return json.dumps(invalid) if count == 1 else draft_of(report).model_dump_json()
    calls = use_model(monkeypatch, respond)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.report == report and len(calls) == 2
    assert "unexpected_field" in calls[1]["system_prompt"]
    assert "private-key-sentinel" not in calls[1]["system_prompt"] + caplog.text
    assert "private-value-sentinel" not in calls[1]["system_prompt"] + caplog.text


def test_a_broken_section_is_repaired_alone_without_regenerating_the_report(monkeypatch, caplog):
    reports, source = unlocked()
    expected = example_complete_report(source)
    broken = draft_of(expected)
    broken.sentence_reviews[0].action = "preserve"  # Refine with preserve breaks the disposition rule.
    async def respond(count, kwargs):
        if count == 1:
            return broken.model_dump_json()
        return json.dumps({"sentence_reviews": draft_of(expected).model_dump()["sentence_reviews"]})
    calls = use_model(monkeypatch, respond)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "ready" and state.report == expected and len(calls) == 2
    repair = calls[1]
    assert repair["output_model"].__name__ == "SectionRepair_sentence_reviews"
    assert list(repair["output_model"].model_fields) == ["sentence_reviews"]
    assert repair["max_output_tokens"] == 16384 and repair["reasoning_effort"] == "medium"
    data = json.loads(repair["input_prompt"])
    assert data["repair"] == {"section": "sentence_reviews", "problem": "sentence_reviews.0.action:disposition_action_mismatch"}
    assert data["current_report"]["sentence_reviews"][0]["action"] == "preserve"
    assert "Return only the sentence_reviews section" in repair["system_prompt"]
    assert "section repair" in caplog.text and "section_repairs=1" in caplog.text


def test_an_unknown_id_is_repaired_in_its_section(monkeypatch):
    reports, source = unlocked()
    expected = example_complete_report(source)
    broken = draft_of(expected)
    broken.paragraph_reviews[0].paragraph_id = "p9"
    async def respond(count, kwargs):
        if count == 1:
            return broken.model_dump_json()
        return json.dumps({"paragraph_reviews": draft_of(expected).model_dump()["paragraph_reviews"]})
    calls = use_model(monkeypatch, respond)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "ready" and state.report == expected and len(calls) == 2
    assert calls[1]["output_model"].__name__ == "SectionRepair_paragraph_reviews"


def test_a_problem_across_sections_regenerates_the_whole_report(monkeypatch, caplog):
    reports, source = unlocked()
    expected = example_complete_report(source, 2)
    broken = draft_of(expected)
    broken.evidence_gaps[1].finding_id = broken.evidence_gaps[0].finding_id  # A duplicate ID spans the report.
    async def respond(count, kwargs):
        return (broken if count == 1 else draft_of(expected)).model_dump_json()
    calls = use_model(monkeypatch, respond)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "ready" and state.report == expected and len(calls) == 2
    assert calls[1]["output_model"] is DraftCompleteReport
    assert "finding_ids:duplicate_identifier" in calls[1]["system_prompt"]
    assert "section=whole_report" in caplog.text


def test_section_repairs_are_bounded_then_the_whole_report_is_regenerated(monkeypatch):
    reports, source = unlocked()
    expected = example_complete_report(source)
    broken = draft_of(expected)
    broken.sentence_reviews[0].action = "preserve"
    still_broken = {"sentence_reviews": broken.model_dump()["sentence_reviews"]}
    async def respond(count, kwargs):
        if count == 1:
            return broken.model_dump_json()
        if count in (2, 3):
            return json.dumps(still_broken)  # Two section repairs that do not fix it.
        return draft_of(expected).model_dump_json()
    calls = use_model(monkeypatch, respond)
    _, state = asyncio.run(start_and_wait(reports))
    assert state.status == "ready" and len(calls) == 4
    assert [call["output_model"].__name__ for call in calls] == [
        "DraftCompleteReport", "SectionRepair_sentence_reviews", "SectionRepair_sentence_reviews", "DraftCompleteReport"]


def test_lifecycle_is_logged_without_content(monkeypatch, caplog):
    reports, source = unlocked()
    async def respond(count, kwargs):
        return draft_of(example_complete_report(source)).model_dump_json()
    use_model(monkeypatch, respond)
    with caplog.at_level("INFO", logger="depth"):
        asyncio.run(start_and_wait(reports))
    for line in ["Complete report generation started assessment_id=assessment-a",
                 "Complete report checked assessment_id=assessment-a report_status=ready model_calls=1 section_repairs=0",
                 "Complete report saved assessment_id=assessment-a status=ready report_status=ready"]:
        assert line in caplog.text, line
    assert source.original_input["statement_text"][:40] not in caplog.text


def test_incomplete_report_is_saved_honestly_and_can_be_retried(monkeypatch):
    reports, source = unlocked()
    ready = example_complete_report(source)
    partial = ready.model_copy(deep=True)
    partial.report_status = "incomplete"
    partial.input_issues = ["The final sentence review is unfinished."]
    partial.sentence_reviews.pop()
    async def respond(count, kwargs):
        return draft_of(partial if count == 1 else ready).model_dump_json()
    calls = use_model(monkeypatch, respond)
    _, first = asyncio.run(start_and_wait(reports))
    assert first.status == "ready" and first.report.report_status == "incomplete"
    assert first.report.coverage.unreviewed_sentence_ids == ["s5"]
    _, second = asyncio.run(start_and_wait(reports))
    _, third = asyncio.run(start_and_wait(reports))
    assert second == third and second.report.report_status == "ready" and len(calls) == 2


def test_review_required_report_is_kept_without_automatic_regeneration(monkeypatch):
    reports, source = unlocked()
    report = example_complete_report(source)
    report.report_status = "review_required"
    report.discrepancies = [Discrepancy(finding_id="discrepancy:1", baseline_field="/main_concern",
                                      issue="The saved concern needs review.", evidence=[], resolution_needed="Review the concern.")]
    async def respond(count, kwargs):
        return draft_of(report).model_dump_json()
    calls = use_model(monkeypatch, respond)
    _, first = asyncio.run(start_and_wait(reports))
    _, second = asyncio.run(start_and_wait(reports))
    assert first == second and second.report.report_status == "review_required" and len(calls) == 1


def test_record_services_roll_back_and_hide_database_errors(caplog):
    class Broken:
        def __getattr__(self, name):
            def fail(*args, **kwargs):
                raise OperationalError("SQL", {}, Exception("connection lost"))
            return fail
    class Session:
        rolled_back = committed = False
        def commit(self): self.committed = True
        def rollback(self): self.rolled_back = True
    source = make_source(str(uuid4()))
    session = Session()
    free = AssessmentRecordService(session, Broken())
    with pytest.raises(OperationalError):  # No row means no generation, so this reaches the caller (503).
        free.create_pending(str(uuid4()), str(uuid4()), {"statement_text": "private-statement-sentinel"}, "gpt-5")
    assert session.rolled_back and not session.committed
    assert free.mark_ready(str(uuid4()), source.assessment, 1.5) is False
    with pytest.raises(ValueError):
        free.create_pending("not-a-uuid", str(uuid4()), {}, "gpt-5")
    assert free.load_owned("not-a-uuid", str(uuid4())) is None
    assert free.free_state("not-a-uuid", str(uuid4()), 280) is None

    session = Session()
    reports = CompleteReportRecordService(session, Broken())
    with pytest.raises(OperationalError):
        reports.claim(str(uuid4()), str(uuid4()))
    assert session.rolled_back and not session.committed
    assert reports.finish(str(uuid4()), utcnow(), example_complete_report(source), 1.0) is False
    assert reports.fail("not-a-uuid", utcnow(), "x", None) is False
    assert "private-statement-sentinel" not in caplog.text and "OperationalError" in caplog.text


# ---------------------------------------------------------------- HTTP


def app_for(reports, owner):
    app = FastAPI()
    app.state.settings = object()
    app.state.background_tasks = set()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_session] = lambda: SimpleNamespace(user_id=owner[0])
    app.dependency_overrides[get_complete_report_records] = lambda: reports
    app.dependency_overrides[get_complete_report_record_factory] = reports.factory
    return app


def wait_for_report(client, assessment_id):
    for _ in range(200):
        state = client.get(f"/api/assessments/{assessment_id}/complete").json()
        if state["status"] != "generating":
            return state
        time.sleep(0.01)
    pytest.fail("Background generation did not finish")


def test_http_flow_headers_polling_and_owner_enforcement(monkeypatch):
    reports, owner = MemoryReports(), [OWNER]
    source = reports.add(make_source(ID))
    async def respond(count, kwargs):
        return draft_of(example_complete_report(source)).model_dump_json()
    calls = use_model(monkeypatch, respond)
    with TestClient(app_for(reports, owner)) as client:
        response = client.get(f"/api/assessments/{ID}/complete")
        assert response.status_code == 200 and response.json()["status"] == "locked"
        assert response.headers["cache-control"] == "no-store"
        assert client.post(f"/api/assessments/{ID}/complete").status_code == 403
        for _ in range(2):
            response = client.post(f"/api/assessments/{ID}/mock-unlock")
            assert response.status_code == 200 and response.json()["status"] == "unlocked"
        started = client.post(f"/api/assessments/{ID}/complete")
        assert started.status_code == 202 and started.json()["status"] == "generating" and started.json()["report"] is None
        assert started.headers["content-type"].startswith("application/json")
        assert started.headers["cache-control"] == "no-store" and "x-generation-seconds" not in started.headers
        state = wait_for_report(client, ID)
        assert state["status"] == "ready" and state["report"]["report_version"] == "complete-report.v1"
        assert state["assessment"] == source.assessment.model_dump()
        again = client.post(f"/api/assessments/{ID}/complete")
        assert again.status_code == 200 and again.json() == state
        assert float(again.headers["x-generation-seconds"]) >= 0
        assert len(calls) == 1
        owner[0] = "owner-2"
        for method, suffix in [(client.get, "complete"), (client.post, "mock-unlock"), (client.post, "complete")]:
            denied = method(f"/api/assessments/{ID}/{suffix}")
            missing = method(f"/api/assessments/missing/{suffix}")
            assert denied.status_code == missing.status_code == 404
            assert denied.json() == missing.json()


def test_http_needs_input_failure_conflict_and_authentication(monkeypatch):
    reports, owner = MemoryReports(), [OWNER]
    reports.add(make_source("needs-input", needs_input=True))
    reports.add(make_source(ID))
    app = app_for(reports, owner)
    async def fail(count, kwargs):
        raise LLMError("private-provider-detail")
    use_model(monkeypatch, fail)
    with TestClient(app) as client:
        assert client.post("/api/assessments/needs-input/mock-unlock").status_code == 422
        assert client.post("/api/assessments/needs-input/complete").status_code == 422
        client.post(f"/api/assessments/{ID}/mock-unlock")
        assert client.post(f"/api/assessments/{ID}/complete").status_code == 202
        state = wait_for_report(client, ID)
        assert state["status"] == "failed" and "private-provider-detail" not in json.dumps(state)
        reports.claim(ID, OWNER)  # A run is already in progress.
        response = client.post(f"/api/assessments/{ID}/complete")
        assert response.status_code == 409 and response.headers["cache-control"] == "no-store"
        def unauthorized():
            raise AuthenticationError()
        app.dependency_overrides[require_session] = unauthorized
        assert client.get(f"/api/assessments/{ID}/complete").status_code == 401
