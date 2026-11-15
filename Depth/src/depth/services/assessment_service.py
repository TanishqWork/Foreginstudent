import asyncio
import json
import logging
import re
from collections.abc import Callable
from contextlib import AbstractContextManager
from functools import lru_cache
from importlib.resources import files
from uuid import uuid4
from time import perf_counter

from pydantic import ValidationError

from depth.core.config import Settings
from depth.core.exceptions import LLMError
from depth.integrations.llm import generate_text
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.assessment_report import (
    AssessmentContext, AssessmentEvaluation, DiagnosticPresentation, FreeDiagnosticResponse,
)
from depth.services.assessment_scoring import calculate_report, validate_evaluation
from depth.schemas.free_assessment import FreeAssessmentState
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.background_jobs import spawn, write_with

logger = logging.getLogger(__name__)
FREE_ASSESSMENT_TIMEOUT_SECONDS = 220
# A row still `generating` after this was lost to a restart; readers mark it failed.
FREE_ASSESSMENT_STALE_SECONDS = FREE_ASSESSMENT_TIMEOUT_SECONDS + 60
RecordFactory = Callable[[], AbstractContextManager[AssessmentRecordService]]


@lru_cache
def free_assessment_prompt() -> str:
    document = files("depth.prompts").joinpath("free-assessment.md").read_text(encoding="utf-8")
    prompt = document.split("## System/developer prompt", 1)[1].split("## End of prompt", 1)[0].strip()
    extension = files("depth.prompts").joinpath("diagnostic-v1.md").read_text(encoding="utf-8")
    return prompt + "\n\n" + extension


def assessment_input(body: AssessmentRequest, assessment_id: str | None = None) -> str:
    text = body.statement_text
    paragraphs = [part for part in re.split(r"\r?\n[ \t]*\r?\n", text) if part.strip()]
    sentences = []
    for number, paragraph in enumerate(paragraphs, 1):
        for match in re.finditer(r"\S[\s\S]*?(?:[.!?](?=\s|$)|$)", paragraph):
            sentence = match.group().rstrip()
            if sentence:
                sentences.append({"id": f"s{len(sentences) + 1}", "paragraph": number, "text": sentence})
    payload = {
        "assessment_id": assessment_id or str(uuid4()),
        "statement_text": text,
        "statement_type": body.statement_type,
        "degree": body.degree,
        "field": body.field,
        "pathway": body.pathway,
        "target_institution": body.target_institution,
        "target_program": body.target_program,
        "application_prompt": body.application_prompt,
        "program_context": None,
        "main_statement_text": None,
        "applicant_notes": None,
        "review_goal": body.review_goal,
        "deadline": None,
        "limits": {"max_words": body.word_limit, "max_characters": None},
        "measurements": {
            "word_count": len(re.findall(r"[^\W_]+(?:['’\-][^\W_]+)*", text, re.UNICODE)),
            "character_count": len(text),
            "paragraph_count": len(paragraphs),
            "counting_method": "ss-unicode-v1",
            "sentences": sentences,
        },
    }
    return json.dumps(payload, ensure_ascii=False)


PATHWAY_GUIDANCE = {
    "health": "Connect practical experience and population problems to the training you need next.",
    "business": "Connect decisions, responsibility, and outcomes to your next business learning goal.",
    "stem": "Connect technical preparation and inquiry to a focused next learning or research direction.",
    "policy": "Connect the public problem, your contribution, and the capabilities you need to develop.",
}


async def run_free_assessment(body: AssessmentRequest, settings: Settings, *, assessment_id: str | None = None) -> FreeDiagnosticResponse:
    """Generate and wait for the result, without saving it."""
    response, _ = await _generate_within_deadline(body, settings, assessment_input(body, assessment_id))
    return response


async def _generate_within_deadline(body: AssessmentRequest, settings: Settings, input_prompt: str) -> tuple[FreeDiagnosticResponse, dict]:
    try:
        async with asyncio.timeout(FREE_ASSESSMENT_TIMEOUT_SECONDS):
            return await _run_free_assessment(body, settings, input_prompt)
    except TimeoutError:
        logger.warning("Free assessment generation failed type=TimeoutError")
        raise LLMError("Free assessment generation timed out.") from None


async def start_free_assessment(
    body: AssessmentRequest, settings: Settings, owner_id: str,
    records: AssessmentRecordService, record_factory: RecordFactory, tasks: set[asyncio.Task],
) -> FreeAssessmentState:
    """Save a `generating` row, run the model in the background, and return at once; clients poll GET for the result."""
    assessment_id = str(uuid4())
    input_prompt = assessment_input(body, assessment_id)
    await asyncio.to_thread(records.create_pending, owner_id, assessment_id, json.loads(input_prompt), settings.free_assessment_model)
    spawn(_finish_free_assessment(body, settings, assessment_id, input_prompt, record_factory), tasks)
    return FreeAssessmentState(assessment_id=assessment_id, status="generating", assessment=None, generation_seconds=None, error=None)


async def _finish_free_assessment(
    body: AssessmentRequest, settings: Settings, assessment_id: str, input_prompt: str, record_factory: RecordFactory,
) -> None:
    started = perf_counter()
    logger.info("Free assessment generation started assessment_id=%s", assessment_id)

    async def fail(message: str) -> None:
        seconds = round(perf_counter() - started, 3)
        stored = await asyncio.to_thread(write_with, record_factory, lambda records: records.mark_failed(assessment_id, message, seconds))
        logger.info("Free assessment saved assessment_id=%s status=failed seconds=%.1f stored=%s", assessment_id, seconds, stored)

    try:
        response, _ = await _generate_within_deadline(body, settings, input_prompt)
    except asyncio.CancelledError:
        await fail("The assessment was interrupted. Your draft is still here; run it again.")
        raise
    except Exception as error:
        if not isinstance(error, LLMError):
            logger.warning("Free assessment generation failed type=%s", type(error).__name__)
        await fail("The assessment could not finish. Your draft is still here; please try again.")
        raise LLMError("Free assessment generation failed.") from None
    seconds = round(perf_counter() - started, 3)
    if await asyncio.to_thread(write_with, record_factory, lambda records: records.mark_ready(assessment_id, response, seconds)):
        logger.info("Free assessment saved assessment_id=%s status=ready overall_score=%s seconds=%.1f",
                    assessment_id, response.report.overall_score, seconds)
    else:
        logger.warning("Free assessment result was not saved assessment_id=%s seconds=%.1f", assessment_id, seconds)


async def _run_free_assessment(body: AssessmentRequest, settings: Settings, input_prompt: str) -> tuple[FreeDiagnosticResponse, dict]:
    started = perf_counter()
    payload = json.loads(input_prompt)
    repair_instruction = ""
    for attempt in range(2):
        text = await generate_text(
            input_prompt=input_prompt,
            system_prompt=free_assessment_prompt() + repair_instruction,
            model=settings.free_assessment_model,
            reasoning_effort=settings.free_assessment_reasoning_effort,
            max_output_tokens=settings.free_assessment_max_output_tokens,
            output_model=AssessmentEvaluation,
            timeout_seconds=180,
        )
        try:
            evaluation = AssessmentEvaluation.model_validate_json(text)
            validate_evaluation(evaluation, payload)
            report = calculate_report(evaluation.report, payload)
        except (ValidationError, ValueError) as error:
            if isinstance(error, ValidationError):
                issues = []
                for item in error.errors(include_input=False, include_context=False):
                    location = list(item["loc"])
                    # An unexpected JSON key is applicant-controlled text, not a safe log field.
                    if item["type"] == "extra_forbidden" and location:
                        location[-1] = "<unexpected_field>"
                    issues.append(".".join(str(part) for part in location) + ":" + item["type"])
            else:
                issues = [str(error)]
            logger.warning("Assessment validation failed attempt=%d codes=%s", attempt + 1, issues)
            repair_instruction = "\n\nYour previous response failed validation. Regenerate the same assessment, fixing these contract errors: " + ", ".join(issues)
            continue
        score = report.overall_score
        opportunity = None if score is None else "Low" if score >= 85 else "Moderate" if score >= 70 else "High" if score >= 55 else "Foundational"
        strongest = report.strongest_categories
        pathway_observation = PATHWAY_GUIDANCE[body.pathway]
        if strongest:
            pathway_observation += f" Current assessed strength: {strongest[0].label.lower()}."
        response = FreeDiagnosticResponse(
            schema_version="free-diagnostic.v1",
            context=AssessmentContext(**body.model_dump(include={"pathway", "degree", "field", "target_institution", "target_program", "statement_type"})),
            report=report,
            diagnostic=DiagnosticPresentation(
                revision_opportunity=opportunity, pathway_observation=pathway_observation,
                evidence_gap=evaluation.evidence_gap, evidence_examples=evaluation.evidence_examples,
            ),
        )
        logger.info(
            "Free assessment finished model=%s effort=%s attempts=%d total_seconds=%.3f",
            settings.free_assessment_model, settings.free_assessment_reasoning_effort,
            attempt + 1, perf_counter() - started,
        )
        return response, payload
    raise LLMError("The assessment response failed validation after one repair attempt.")
