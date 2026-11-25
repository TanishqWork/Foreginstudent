"""Purchase and generate complete reports. Payment access and attempts are persisted."""

import asyncio
import json
import logging
from dataclasses import replace
from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import datetime
from functools import lru_cache
from importlib.resources import files
from time import perf_counter

from pydantic import ValidationError, create_model

from depth.core.exceptions import AssessmentError, LLMError
from depth.integrations.llm import generate_text
from depth.schemas.assessment_report import ReportModel
from depth.schemas.complete_report import CompleteReportState
from depth.schemas.complete_report_content import CompleteReportContent
from depth.schemas.complete_report_draft import DraftCompleteReport
from depth.services.assessment_record_service import SavedAssessment
from depth.services.assessment_scoring import assessment_rubric, selected_dimensions
from depth.services.background_jobs import spawn, write_with
from depth.services.complete_report_record_service import CompleteReportRecordService, LoadedReport, ReportRecord
from depth.services.complete_report_assembly import assemble_report
from depth.services.complete_report_validation import source_maps, validate_complete_report

logger = logging.getLogger(__name__)
COMPLETE_REPORT_MODEL = "gpt-5"
COMPLETE_REPORT_TIMEOUT_SECONDS = 600  # The whole job, including one repair attempt.
COMPLETE_REPORT_CALL_TIMEOUT_SECONDS = 420  # One OpenAI call.
# A row still `generating` after this was cut off by a restart; the next read marks it failed.
COMPLETE_REPORT_STALE_SECONDS = COMPLETE_REPORT_TIMEOUT_SECONDS + 60
ReportFactory = Callable[[], AbstractContextManager[CompleteReportRecordService]]


@lru_cache
def complete_report_prompt() -> str:
    return files("depth.prompts").joinpath("complete-report-structured.md").read_text(encoding="utf-8").strip()


def _load(
    reports: CompleteReportRecordService, assessment_id: str, owner_id: str,
    include_input: bool = False, *, attempt_id: str | None = None,
) -> LoadedReport:
    """Status reads skip the statement; only starting a generation loads it for the model."""
    loaded = reports.load(assessment_id, owner_id, COMPLETE_REPORT_STALE_SECONDS, include_input=include_input, attempt_id=attempt_id)
    if loaded is None:  # Missing, another user's, or a free assessment that is not ready.
        raise AssessmentError("not_found")
    return loaded


def _require_score(source: SavedAssessment) -> None:
    if source.assessment.report.status == "needs_input" or source.assessment.report.overall_score is None:
        raise AssessmentError("needs_input")


def _state(source: SavedAssessment, record: ReportRecord | None) -> CompleteReportState:
    return CompleteReportState(
        assessment_id=source.assessment.report.assessment_id,
        status="locked" if record is None else record.status,
        assessment=source.assessment,
        report=None if record is None else record.report,
        generation_seconds=None if record is None else record.generation_seconds,
        free_generation_seconds=source.generation_seconds,
        remaining_successful_runs=0,
        successful_runs=0,
        max_successful_runs=None,
        error=None if record is None else record.error,
    )


def _loaded_state(loaded: LoadedReport) -> CompleteReportState:
    state = _state(loaded.source, loaded.record)
    state.remaining_successful_runs = loaded.remaining_successful_runs
    state.successful_runs = loaded.successful_runs
    state.max_successful_runs = loaded.max_successful_runs
    state.can_generate = loaded.can_generate
    state.cycle_expires_at = loaded.cycle_expires_at
    return state


def complete_report_state(
    assessment_id: str, owner_id: str, reports: CompleteReportRecordService, attempt_id: str | None = None,
) -> CompleteReportState:
    loaded = _load(reports, assessment_id, owner_id, attempt_id=attempt_id)
    return _loaded_state(loaded)


def mark_paid(assessment_id: str, owner_id: str, reports: CompleteReportRecordService) -> CompleteReportState:
    loaded = _load(reports, assessment_id, owner_id)
    _require_score(loaded.source)
    if loaded.max_successful_runs is None and loaded.cycle_expires_at is None:
        reports.mark_paid(assessment_id, owner_id)
        loaded = _load(reports, assessment_id, owner_id)
    return _loaded_state(loaded)


async def start_complete_report(
    assessment_id: str, owner_id: str, reports: CompleteReportRecordService,
    report_factory: ReportFactory, tasks: set[asyncio.Task],
) -> CompleteReportState:
    """Claim the row and return `generating` at once; the model runs in the background and clients poll GET."""
    loaded = await asyncio.to_thread(_load, reports, assessment_id, owner_id, True)
    source, record = loaded.source, loaded.record
    _require_score(source)
    if record is not None and record.status == "generating":
        raise AssessmentError("generating")
    if not loaded.can_generate:
        raise AssessmentError("exhausted" if loaded.max_successful_runs is not None else "locked")
    # The database claim rechecks access and enforces one running attempt per assessment.
    claimed = await asyncio.to_thread(reports.claim, assessment_id, owner_id, COMPLETE_REPORT_MODEL)
    if claimed is None:
        raise AssessmentError("generating")
    attempt_id, started_at = claimed
    spawn(_run_generation(assessment_id, attempt_id, started_at, source, report_factory), tasks)
    return _loaded_state(replace(
        loaded, record=ReportRecord("generating", attempt_id, None, None, None, None, started_at),
    ))


async def _run_generation(
    assessment_id: str, attempt_id: str, started_at: datetime, source: SavedAssessment, report_factory: ReportFactory,
) -> None:
    started = perf_counter()
    logger.info("Complete report generation started assessment_id=%s", assessment_id)

    async def fail(message: str, failure_kind: str) -> None:
        seconds = round(perf_counter() - started, 3)
        saved = await asyncio.to_thread(
            write_with, report_factory,
            lambda reports: reports.fail(attempt_id, started_at, message, seconds, failure_kind),
        )
        logger.info("Complete report saved assessment_id=%s status=failed seconds=%.1f stored=%s", assessment_id, seconds, saved)

    try:
        async with asyncio.timeout(COMPLETE_REPORT_TIMEOUT_SECONDS):
            report = await _generate_validated_report(source, assessment_id)
    except asyncio.CancelledError:
        await fail("Generation was interrupted. Your paid access was not used; try again.", "interrupted")
        raise
    except TimeoutError:
        logger.warning("Complete report generation failed type=TimeoutError")
        await fail("Generation timed out. Your paid access was not used; try again.", "timeout")
        raise LLMError("Complete report generation timed out.") from None
    except Exception as error:
        logger.warning("Complete report generation failed type=%s", type(error).__name__)
        failure_kind = "validation_error" if isinstance(error, LLMError) else "ai_error"
        await fail("The report could not finish. Your paid access was not used; try again.", failure_kind)
        raise LLMError("Complete report generation failed.") from None
    seconds = round(perf_counter() - started, 3)
    saved = await asyncio.to_thread(write_with, report_factory, lambda reports: reports.finish(attempt_id, started_at, report, seconds))
    if saved:
        logger.info("Complete report saved assessment_id=%s status=ready report_status=%s seconds=%.1f",
                    assessment_id, report.report_status, seconds)
    else:
        logger.warning("Complete report was not saved assessment_id=%s seconds=%.1f", assessment_id, seconds)


def complete_report_input(source: SavedAssessment) -> str:
    original = source.original_input
    _, paragraphs, context_sources = source_maps(source)
    rubric = assessment_rubric()
    data = {
        "original_input": original,
        "first_assessment": source.assessment.report.model_dump(),
        "first_diagnostic": source.assessment.diagnostic.model_dump(),
        "paragraphs": paragraphs,
        "context_sources": context_sources,
        "rubric_dimensions": [{
            **definition, "checkpoints": rubric["checkpoints"][definition["id"]],
        } for definition in selected_dimensions(original["statement_type"])],
    }
    return json.dumps(data, ensure_ascii=False)


REPAIRABLE_SECTIONS = (
    "executive_summary", "criterion_details", "prompt_coverage", "sentence_reviews", "paragraph_reviews",
    "evidence_gaps", "program_fit", "voice_and_originality", "unsupported_claims", "cut_or_expand",
    "revision_plan", "discrepancies",
)
MAX_SECTION_REPAIRS = 2  # Per full generation; each repairs one failing section.
SECTION_REPAIR_INSTRUCTION = """

## Section repair
The data message also includes current_report (your earlier report) and repair (one failed contract
check, as a path and code). Return only the {section} section, corrected so it passes that check and
every rule above. Keep its existing finding IDs and any IDs other sections reference, unless the
check is about those IDs. Do not repeat or change other sections."""


def _issues(error: ValueError) -> list[str]:
    """Contract errors as "path:code" only; applicant text never appears."""
    if isinstance(error, ValidationError):
        issues = []
        for item in error.errors(include_input=False, include_context=False):
            location = list(item["loc"])
            # An unexpected JSON key is model-controlled text, not a safe log field.
            if item["type"] == "extra_forbidden" and location:
                location[-1] = "<unexpected_field>"
            issues.append(".".join(str(part) for part in location) + ":" + item["type"])
        return issues
    return [str(error)]


def _section_of(issue: str) -> str | None:
    path = issue.split(":", 1)[0].removeprefix("report.")
    section = path.split(".", 1)[0]
    return section if section in REPAIRABLE_SECTIONS else None


@lru_cache
def _section_model(section: str) -> type[ReportModel]:
    """An output schema holding just one draft section."""
    return create_model(f"SectionRepair_{section}", __base__=ReportModel,
                        **{section: (DraftCompleteReport.model_fields[section].annotation, ...)})


async def _repair_section(draft: DraftCompleteReport, section: str, issue: str, input_prompt: str) -> DraftCompleteReport | None:
    data = json.loads(input_prompt)
    data["current_report"] = draft.model_dump()
    data["repair"] = {"section": section, "problem": issue}
    model = _section_model(section)
    text = await generate_text(
        input_prompt=json.dumps(data, ensure_ascii=False),
        system_prompt=complete_report_prompt() + SECTION_REPAIR_INSTRUCTION.format(section=section),
        model=COMPLETE_REPORT_MODEL, reasoning_effort="medium", max_output_tokens=16384,
        timeout_seconds=COMPLETE_REPORT_CALL_TIMEOUT_SECONDS, output_model=model,
    )
    try:
        repaired = model.model_validate_json(text)
    except ValidationError as error:
        logger.warning("Complete report section repair unusable section=%s codes=%s", section, _issues(error))
        return None
    return draft.model_copy(update={section: getattr(repaired, section)})


async def _generate_validated_report(source: SavedAssessment, assessment_id: str = "-") -> CompleteReportContent:
    """The model writes the analysis; the host fills saved data, checks it, and repairs only a failing section.

    A whole new generation happens only when the draft is unusable or a problem spans sections.
    """
    input_prompt = complete_report_input(source)
    repair_instruction = ""
    calls = 0
    for attempt in range(1, 3):
        text = await generate_text(
            input_prompt=input_prompt, system_prompt=complete_report_prompt() + repair_instruction,
            model=COMPLETE_REPORT_MODEL, reasoning_effort="medium", max_output_tokens=32768,
            timeout_seconds=COMPLETE_REPORT_CALL_TIMEOUT_SECONDS, output_model=DraftCompleteReport,
        )
        calls += 1
        try:
            draft = DraftCompleteReport.model_validate_json(text)
        except ValidationError as error:
            issues = _issues(error)
            logger.warning("Complete report draft unusable assessment_id=%s attempt=%d codes=%s", assessment_id, attempt, issues)
            repair_instruction = "\n\nRegenerate the full report, correcting these contract errors without changing the baseline: " + ", ".join(issues)
            continue
        for repair in range(MAX_SECTION_REPAIRS + 1):
            try:
                assembled = assemble_report(draft, source)
                report = validate_complete_report(assembled.report, source)
            except ValueError as error:
                issue = _issues(error)[0]
                section = _section_of(issue)
                logger.warning("Complete report check failed assessment_id=%s attempt=%d issue=%s section=%s",
                               assessment_id, attempt, issue, section or "whole_report")
                if section is None or repair == MAX_SECTION_REPAIRS:
                    repair_instruction = "\n\nRegenerate the full report, correcting this contract error without changing the baseline: " + issue
                    break
                logger.info("Complete report section repair assessment_id=%s section=%s repair=%d", assessment_id, section, repair + 1)
                repaired = await _repair_section(draft, section, issue, input_prompt)
                calls += 1
                if repaired is None:
                    repair_instruction = "\n\nRegenerate the full report, correcting this contract error without changing the baseline: " + issue
                    break
                draft = repaired
                continue
            logger.info(
                "Complete report checked assessment_id=%s report_status=%s model_calls=%d section_repairs=%d evidence_quotes_restored=%d",
                assessment_id, report.report_status, calls, repair, assembled.quotes_restored,
            )
            return report
    raise LLMError("The complete report failed validation after one full regeneration.")
