"""Small, owner-bound process cache. Nothing here writes to the database."""

from collections import OrderedDict
from copy import deepcopy
from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Callable

from depth.core.exceptions import AssessmentError
from depth.schemas.assessment_report import FreeDiagnosticResponse
from depth.schemas.complete_report import CompleteStatus
from depth.schemas.complete_report_content import CompleteReportContent


@dataclass
class CachedAssessment:
    owner_id: str
    original_input: dict
    assessment: FreeDiagnosticResponse
    expires_at: float
    status: CompleteStatus = "locked"
    report: CompleteReportContent | None = None
    generation_seconds: float | None = None
    free_generation_seconds: float | None = None
    error: str | None = None


class AssessmentStore:
    """64 baselines for one hour; active generation is pinned until it finishes."""

    def __init__(self, capacity: int = 64, ttl_seconds: float = 3600, clock: Callable[[], float] = monotonic):
        if capacity <= 0 or ttl_seconds <= 0:
            raise ValueError("Cache capacity and TTL must be positive.")
        self.capacity = capacity
        self.ttl_seconds = ttl_seconds
        self._clock = clock
        self._entries: OrderedDict[str, CachedAssessment] = OrderedDict()
        self._lock = Lock()

    def _prune(self) -> None:
        now = self._clock()
        expired = [key for key, entry in self._entries.items() if entry.status != "generating" and entry.expires_at <= now]
        for key in expired:
            del self._entries[key]

    def _owned(self, assessment_id: str, owner_id: str) -> CachedAssessment:
        self._prune()
        entry = self._entries.get(assessment_id)
        if entry is None or entry.owner_id != owner_id:
            raise AssessmentError("not_found")
        return entry

    @staticmethod
    def _require_score(entry: CachedAssessment) -> None:
        if entry.assessment.report.status == "needs_input" or entry.assessment.report.overall_score is None:
            raise AssessmentError("needs_input")

    def save(self, owner_id: str, original_input: dict, assessment: FreeDiagnosticResponse,
             free_generation_seconds: float | None = None) -> None:
        assessment_id = assessment.report.assessment_id
        with self._lock:
            self._prune()
            if assessment_id in self._entries:
                raise AssessmentError("duplicate")
            if len(self._entries) >= self.capacity:
                oldest = next((key for key, entry in self._entries.items() if entry.status != "generating"), None)
                if oldest is None:
                    raise AssessmentError("capacity")
                del self._entries[oldest]
            self._entries[assessment_id] = CachedAssessment(
                owner_id=owner_id, original_input=deepcopy(original_input),
                assessment=assessment.model_copy(deep=True), expires_at=self._clock() + self.ttl_seconds,
                free_generation_seconds=free_generation_seconds,
            )

    def get(self, assessment_id: str, owner_id: str) -> CachedAssessment:
        with self._lock:
            return deepcopy(self._owned(assessment_id, owner_id))

    def unlock(self, assessment_id: str, owner_id: str) -> CachedAssessment:
        with self._lock:
            entry = self._owned(assessment_id, owner_id)
            self._require_score(entry)
            if entry.status == "locked":
                entry.status = "unlocked"
            return deepcopy(entry)

    def begin_generation(self, assessment_id: str, owner_id: str) -> CachedAssessment:
        with self._lock:
            entry = self._owned(assessment_id, owner_id)
            self._require_score(entry)
            if entry.status == "locked":
                raise AssessmentError("locked")
            if entry.status == "generating":
                raise AssessmentError("generating")
            retry_incomplete = entry.status == "ready" and entry.report is not None and entry.report.report_status == "incomplete"
            if entry.status != "ready" or retry_incomplete:
                entry.status = "generating"
                entry.report = entry.error = entry.generation_seconds = None
            return deepcopy(entry)

    def finish(self, assessment_id: str, owner_id: str, report: CompleteReportContent, seconds: float) -> None:
        with self._lock:
            entry = self._owned(assessment_id, owner_id)
            entry.report, entry.generation_seconds = report.model_copy(deep=True), seconds
            entry.status, entry.error = "ready", None
            entry.expires_at = self._clock() + self.ttl_seconds

    def fail(self, assessment_id: str, owner_id: str, message: str, seconds: float) -> None:
        with self._lock:
            entry = self._owned(assessment_id, owner_id)
            entry.status, entry.error = "failed", message
            entry.report, entry.generation_seconds = None, seconds
            entry.expires_at = self._clock() + self.ttl_seconds
