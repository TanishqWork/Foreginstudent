import asyncio
import json
import logging
import re
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
from depth.services.assessment_store import AssessmentStore

logger = logging.getLogger(__name__)
FREE_ASSESSMENT_TIMEOUT_SECONDS = 220


@lru_cache
def free_assessment_prompt() -> str:
    document = files("depth.prompts").joinpath("free-assessment.md").read_text(encoding="utf-8")
    prompt = document.split("## System/developer prompt", 1)[1].split("## End of prompt", 1)[0].strip()
    extension = files("depth.prompts").joinpath("diagnostic-v1.md").read_text(encoding="utf-8")
    return prompt + "\n\n" + extension


def assessment_input(body: AssessmentRequest) -> str:
    text = body.statement_text
    paragraphs = [part for part in re.split(r"\r?\n[ \t]*\r?\n", text) if part.strip()]
    sentences = []
    for number, paragraph in enumerate(paragraphs, 1):
        for match in re.finditer(r"\S[\s\S]*?(?:[.!?](?=\s|$)|$)", paragraph):
            sentence = match.group().rstrip()
            if sentence:
                sentences.append({"id": f"s{len(sentences) + 1}", "paragraph": number, "text": sentence})
    payload = {
        "assessment_id": str(uuid4()),
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


async def run_free_assessment(
    body: AssessmentRequest, settings: Settings, *,
    owner_id: str | None = None, store: AssessmentStore | None = None,
) -> FreeDiagnosticResponse:
    try:
        async with asyncio.timeout(FREE_ASSESSMENT_TIMEOUT_SECONDS):
            return await _run_free_assessment(body, settings, owner_id=owner_id, store=store)
    except TimeoutError:
        logger.warning("Free assessment generation failed type=TimeoutError")
        raise LLMError("Free assessment generation timed out.") from None


async def _run_free_assessment(
    body: AssessmentRequest, settings: Settings, *,
    owner_id: str | None = None, store: AssessmentStore | None = None,
) -> FreeDiagnosticResponse:
    started = perf_counter()
    input_prompt = assessment_input(body)
    payload = json.loads(input_prompt)
    repair_instruction = ""
    for attempt in range(2):
        text = await generate_text(
            input_prompt=input_prompt,
            system_prompt=free_assessment_prompt() + repair_instruction,
            model="gpt-5",
            reasoning_effort="medium",
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
        if store is not None:
            if owner_id is None:
                raise ValueError("A cached assessment requires an authenticated owner.")
            store.save(owner_id, payload, response, free_generation_seconds=round(perf_counter() - started, 3))
        return response
    raise LLMError("The assessment response failed validation after one repair attempt.")
