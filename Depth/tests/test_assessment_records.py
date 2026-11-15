"""PostgreSQL round trip for saved free assessments; skipped without TEST_DATABASE_URL, rolled back per test."""

from uuid import UUID, uuid4

import pytest
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


def test_save_and_load_round_trip_is_owner_bound(db):
    owner, other = make_user(db, "owner@example.com"), make_user(db, "other@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    assessment = make_assessment()
    original_input = {"statement_text": "My statement.", "pathway": "health"}
    assert service.save(str(owner.id), original_input, assessment, "gpt-5", 134.241) is True

    saved = service.load_owned(assessment.report.assessment_id, str(owner.id))
    assert saved is not None
    assert saved.original_input == original_input
    assert saved.assessment == assessment
    assert saved.generation_seconds == pytest.approx(134.241)
    assert service.load_owned(assessment.report.assessment_id, str(other.id)) is None

    row = db.get(Assessment, UUID(assessment.report.assessment_id))
    assert row.model == "gpt-5" and row.created_at.tzinfo is not None


def test_list_is_newest_first_and_cascades_with_the_user(db):
    owner = make_user(db, "history@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    ids = []
    for _ in range(3):
        assessment = make_assessment()
        ids.append(assessment.report.assessment_id)
        assert service.save(str(owner.id), {}, assessment, "gpt-5", None)
    listed = AssessmentRepository(db).list_for_user(owner.id)
    assert [str(row.id) for row in listed] == list(reversed(ids))
    assert all(row.generation_seconds is None for row in listed)
    db.delete(owner)
    db.flush()
    assert AssessmentRepository(db).list_for_user(owner.id) == []


def test_duplicate_id_is_rejected_without_raising(db):
    owner = make_user(db, "duplicate@example.com")
    service = AssessmentRecordService(db, AssessmentRepository(db))
    assessment = make_assessment()
    assert service.save(str(owner.id), {}, assessment, "gpt-5", 1.0) is True
    assert service.save(str(owner.id), {}, assessment, "gpt-5", 1.0) is False
