"""PostgreSQL behaviour of complete-report rows; skipped without TEST_DATABASE_URL, rolled back per test."""

from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from complete_report_fixture import example_complete_report, make_source
from depth.database.base import utcnow
from depth.models.complete_report import CompleteReport
from depth.models.user import User
from depth.repositories.assessments import AssessmentRepository
from depth.repositories.complete_reports import CompleteReportRepository
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.complete_report_record_service import CompleteReportRecordService

STALE = 660


@pytest.fixture
def db(test_engine):
    with test_engine.connect() as connection:
        transaction = connection.begin()
        session = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")()
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


def services(db):
    free = AssessmentRecordService(db, AssessmentRepository(db))
    return free, CompleteReportRecordService(db, CompleteReportRepository(db))


def ready_assessment(db, email):
    """A user with a finished free assessment, as the complete report requires."""
    user = User(email=email, supabase_user_id=uuid4())
    db.add(user)
    db.flush()
    free, reports = services(db)
    source = make_source(str(uuid4()))
    assessment_id = source.assessment.report.assessment_id
    free.create_pending(str(user.id), assessment_id, source.original_input, "gpt-5")
    assert free.mark_ready(assessment_id, source.assessment, 12.5)
    return str(user.id), assessment_id, source, reports


def test_locked_unlock_claim_finish_round_trip_is_owner_bound(db):
    owner, assessment_id, source, reports = ready_assessment(db, "owner@example.com")
    other, _, _, _ = ready_assessment(db, "other@example.com")
    assert reports.load(assessment_id, owner, STALE).record is None  # Locked.
    assert reports.load(assessment_id, other, STALE) is None

    reports.unlock(assessment_id, owner, "gpt-5")
    reports.unlock(assessment_id, owner, "gpt-5")  # Idempotent.
    assert reports.load(assessment_id, owner, STALE).record.status == "unlocked"

    started_at = reports.claim(assessment_id, owner)
    assert started_at is not None
    assert reports.claim(assessment_id, owner) is None  # Only one run can hold the row.
    assert reports.claim(assessment_id, other) is None
    assert reports.load(assessment_id, owner, STALE).record.status == "generating"

    report = example_complete_report(source)
    assert reports.finish(assessment_id, started_at - timedelta(seconds=1), report, 3.0) is False  # Another run's result.
    assert reports.finish(assessment_id, started_at, report, 191.234) is True
    record = reports.load(assessment_id, owner, STALE).record
    assert record.status == "ready" and record.report == report and record.generation_seconds == pytest.approx(191.234)
    assert reports.claim(assessment_id, owner) is None  # A complete report is not regenerated.


def test_failed_and_incomplete_reports_can_be_claimed_again(db):
    owner, assessment_id, source, reports = ready_assessment(db, "retry@example.com")
    reports.unlock(assessment_id, owner, "gpt-5")
    started_at = reports.claim(assessment_id, owner)
    assert reports.fail(assessment_id, started_at, "Please try again.", 12.0) is True
    record = reports.load(assessment_id, owner, STALE).record
    assert record.status == "failed" and record.error == "Please try again." and record.report is None

    started_at = reports.claim(assessment_id, owner)
    partial = example_complete_report(source)
    partial.report_status = "incomplete"
    partial.input_issues = ["Unfinished."]
    partial.sentence_reviews.pop()
    assert reports.finish(assessment_id, started_at, partial, 5.0)
    assert reports.claim(assessment_id, owner) is not None
    row = db.get(CompleteReport, UUID(assessment_id))
    assert row.status == "generating" and row.report is None  # Cleared to SQL NULL, not JSON null.


def test_run_left_generating_past_the_deadline_is_marked_failed_on_read(db):
    owner, assessment_id, source, reports = ready_assessment(db, "stale@example.com")
    reports.unlock(assessment_id, owner, "gpt-5")
    started_at = reports.claim(assessment_id, owner)
    old = started_at - timedelta(seconds=STALE + 1)
    db.execute(update(CompleteReport).where(CompleteReport.assessment_id == UUID(assessment_id)).values(started_at=old))
    record = reports.load(assessment_id, owner, STALE).record
    assert record.status == "failed" and "interrupted" in record.error
    assert reports.finish(assessment_id, old, example_complete_report(source), 1.0) is False


def test_report_needs_a_ready_free_assessment(db):
    owner, assessment_id, _, reports = ready_assessment(db, "pending@example.com")
    free, _ = services(db)
    pending_id = str(uuid4())
    free.create_pending(owner, pending_id, {}, "gpt-5")
    assert reports.load(pending_id, owner, STALE) is None


def test_ready_row_requires_a_report(db):
    owner, assessment_id, _, _ = ready_assessment(db, "constraint@example.com")
    db.add(CompleteReport(assessment_id=UUID(assessment_id), user_id=UUID(owner), status="ready", report=None,
                          model="gpt-5", started_at=utcnow()))
    with pytest.raises(IntegrityError):
        db.flush()
