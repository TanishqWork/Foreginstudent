"""PostgreSQL round trip for free assessments and their status; skipped without TEST_DATABASE_URL, rolled back per test."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from depth.models.assessment import Assessment
from depth.models.user import User
from depth.repositories.assessments import AssessmentRepository
from depth.services.assessment_record_service import AssessmentRecordService
from test_assessment import example_response


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


def make_user(db, email):
    user = User(email=email, supabase_user_id=uuid4())
    db.add(user)
    db.flush()
    return user


def make_assessment():
    assessment = example_response()
    assessment.report.assessment_id = str(uuid4())
    return assessment


def save_ready(service, owner, assessment, original_input=None, seconds=134.241):
    assessment_id = assessment.report.assessment_id
    service.create_pending(str(owner.id), assessment_id, original_input or {}, "gpt-5")
    assert service.mark_ready(assessment_id, assessment, seconds) is True
    return assessment_id


def test_generating_then_ready_round_trip_is_owner_bound(db):
    owner, other = make_user(db, "owner@example.com"), make_user(db, "other@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    assessment = make_assessment()
    assessment_id = assessment.report.assessment_id
    original_input = {"statement_text": "My statement.", "pathway": "health"}

    service.create_pending(str(owner.id), assessment_id, original_input, "gpt-5")
    pending = service.free_state(assessment_id, str(owner.id), 280)
    assert pending.status == "generating" and pending.assessment is None
    assert service.load_owned(assessment_id, str(owner.id)) is None  # Not usable for a complete report yet.

    assert service.mark_ready(assessment_id, assessment, 134.241) is True
    ready = service.free_state(assessment_id, str(owner.id), 280)
    assert ready.status == "ready" and ready.assessment == assessment and ready.generation_seconds == pytest.approx(134.241)
    saved = service.load_owned(assessment_id, str(owner.id))
    assert saved.original_input == original_input and saved.assessment == assessment
    assert service.load_owned(assessment_id, str(other.id)) is None
    assert service.free_state(assessment_id, str(other.id), 280) is None
    # A finished run cannot be overwritten.
    assert service.mark_failed(assessment_id, "late failure") is False

    row = db.get(Assessment, UUID(assessment_id))
    assert row.status == "ready" and row.model == "gpt-5" and row.created_at.tzinfo is not None


def test_failed_run_keeps_its_input_and_is_not_reportable(db):
    owner = make_user(db, "failed@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    assessment_id = str(uuid4())
    service.create_pending(str(owner.id), assessment_id, {"statement_text": "Kept."}, "gpt-5")
    assert service.mark_failed(assessment_id, "Please try again.", 3.5) is True
    state = service.free_state(assessment_id, str(owner.id), 280)
    assert state.status == "failed" and state.error == "Please try again." and state.assessment is None
    assert service.load_owned(assessment_id, str(owner.id)) is None
    assert db.get(Assessment, UUID(assessment_id)).input == {"statement_text": "Kept."}


def test_stale_generating_run_is_marked_failed_on_read(db):
    owner = make_user(db, "stale@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    assessment_id = str(uuid4())
    service.create_pending(str(owner.id), assessment_id, {}, "gpt-5")
    assert service.free_state(assessment_id, str(owner.id), 280).status == "generating"
    db.execute(update(Assessment).where(Assessment.id == UUID(assessment_id))
               .values(created_at=datetime.now(timezone.utc) - timedelta(seconds=600)))
    state = service.free_state(assessment_id, str(owner.id), 280)
    assert state.status == "failed" and "interrupted" in state.error


def test_ready_row_requires_a_result(db):
    owner = make_user(db, "constraint@example.com")
    db.add(Assessment(id=uuid4(), user_id=owner.id, status="ready", input={}, result=None, model="gpt-5"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_list_is_newest_first_and_cascades_with_the_user(db):
    owner = make_user(db, "history@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    ids = [save_ready(service, owner, make_assessment(), seconds=None) for _ in range(3)]
    listed = AssessmentRepository(db).list_for_user(owner.id)
    assert [str(row.id) for row in listed] == list(reversed(ids))
    assert all(row.generation_seconds is None for row in listed)
    db.delete(owner)
    db.flush()
    assert AssessmentRepository(db).list_for_user(owner.id) == []


def test_duplicate_id_is_rejected(db):
    owner = make_user(db, "duplicate@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    assessment = make_assessment()
    save_ready(service, owner, assessment)
    with pytest.raises(IntegrityError):
        service.create_pending(str(owner.id), assessment.report.assessment_id, {}, "gpt-5")
