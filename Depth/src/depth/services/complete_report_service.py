"""Expand a temporary baseline into validated report data; no database writes."""

import asyncio
import json
import logging
from functools import lru_cache
from importlib.resources import files
from time import perf_counter

from pydantic import ValidationError

from depth.core.exceptions import LLMError
from depth.integrations.llm import generate_text
from depth.schemas.complete_report import CompleteReportState
from depth.schemas.complete_report_content import CompleteReportContent
from depth.services.assessment_scoring import assessment_rubric, selected_dimensions
from depth.services.assessment_store import AssessmentStore, CachedAssessment
from depth.services.complete_report_validation import source_maps, validate_complete_report

logger = logging.getLogger(__name__)
COMPLETE_REPORT_TIMEOUT_SECONDS = 270


@lru_cache
def complete_report_prompt() -> str:
    return files("depth.prompts").joinpath("complete-report-structured.md").read_text(encoding="utf-8").strip()


def complete_report_state(assessment_id: str, owner_id: str, store: AssessmentStore) -> CompleteReportState:
    entry = store.get(assessment_id, owner_id)
    return state_from_entry(entry)


def state_from_entry(entry: CachedAssessment) -> CompleteReportState:
    return CompleteReportState(
        assessment_id=entry.assessment.report.assessment_id, status=entry.status,
        assessment=entry.assessment, report=entry.report,
        generation_seconds=entry.generation_seconds,
        free_generation_seconds=entry.free_generation_seconds, error=entry.error,
    )


def mock_unlock(assessment_id: str, owner_id: str, store: AssessmentStore) -> CompleteReportState:
    return state_from_entry(store.unlock(assessment_id, owner_id))


def complete_report_input(entry: CachedAssessment) -> str:
    original = entry.original_input
    _, paragraphs, context_sources = source_maps(entry)
    rubric = assessment_rubric()
    data = {
        "original_input": original,
        "first_assessment": entry.assessment.report.model_dump(),
        "first_diagnostic": entry.assessment.diagnostic.model_dump(),
        "paragraphs": paragraphs,
        "context_sources": context_sources,
        "rubric_dimensions": [{
            **definition, "checkpoints": rubric["checkpoints"][definition["id"]],
        } for definition in selected_dimensions(original["statement_type"])],
    }
    return json.dumps(data, ensure_ascii=False)


async def generate_complete_report(assessment_id: str, owner_id: str, store: AssessmentStore) -> CompleteReportState:
    # The transition is atomic and happens before any await, preventing duplicate calls.
    entry = store.begin_generation(assessment_id, owner_id)
    if entry.status == "ready":
        return state_from_entry(entry)
    started = perf_counter()
    try:
        async with asyncio.timeout(COMPLETE_REPORT_TIMEOUT_SECONDS):
            report = await _generate_validated_report(entry)
        seconds = round(perf_counter() - started, 3)
        store.finish(assessment_id, owner_id, report, seconds)
        return complete_report_state(assessment_id, owner_id, store)
    except asyncio.CancelledError:
        store.fail(assessment_id, owner_id, "Generation was interrupted. Your mock unlock is kept; try again.", round(perf_counter() - started, 3))
        raise
    except TimeoutError:
        store.fail(assessment_id, owner_id, "Generation timed out. Your mock unlock is kept; try again.", round(perf_counter() - started, 3))
        logger.warning("Complete report generation failed type=TimeoutError")
        raise LLMError("Complete report generation timed out.") from None
    except Exception as error:
        store.fail(assessment_id, owner_id, "The report could not finish. Your mock unlock is kept; try again.", round(perf_counter() - started, 3))
        logger.warning("Complete report generation failed type=%s", type(error).__name__)
        raise LLMError("Complete report generation failed.") from None


async def _generate_validated_report(entry: CachedAssessment) -> CompleteReportContent:
    input_prompt = complete_report_input(entry)
    repair_instruction = ""
    for attempt in range(2):
        text = await generate_text(
            input_prompt=input_prompt, system_prompt=complete_report_prompt() + repair_instruction,
            model="gpt-5", reasoning_effort="medium", max_output_tokens=32768,
            timeout_seconds=270, output_model=CompleteReportContent,
        )
        try:
            report = CompleteReportContent.model_validate_json(text)
            return validate_complete_report(report, entry)
        except (ValidationError, ValueError) as error:
            if isinstance(error, ValidationError):
                issues = []
                for item in error.errors(include_input=False, include_context=False):
                    location = list(item["loc"])
                    if item["type"] == "extra_forbidden" and location:
                        location[-1] = "<unexpected_field>"
                    issues.append(".".join(str(part) for part in location) + ":" + item["type"])
            else:
                issues = [str(error)]
            logger.warning("Complete report validation failed attempt=%d codes=%s", attempt + 1, issues)
            repair_instruction = "\n\nRegenerate the full report, correcting these contract errors without changing the baseline: " + ", ".join(issues)
    raise LLMError("The complete report failed validation after one repair attempt.")
