"""A simple OpenAI helper for backend services."""

import json
import logging
from time import perf_counter

import httpx
from openai import APIError, AsyncOpenAI
from pydantic import BaseModel

from depth.core.config import get_settings
from depth.core.exceptions import LLMError

logger = logging.getLogger(__name__)
SAFE_ERROR_CODES = {
    "invalid_api_key", "invalid_request_error", "invalid_json_schema",
    "unsupported_value", "unsupported_parameter", "model_not_found",
    "rate_limit_exceeded", "insufficient_quota", "context_length_exceeded",
    "server_error", "service_unavailable", "timeout",
}


async def generate_text(
    input_prompt: str,
    system_prompt: str,
    model: str,
    *,
    reasoning_effort: str | None = None,
    verbosity: str | None = None,
    max_output_tokens: int = 4096,
    temperature: float | None = None,
    output_model: type[BaseModel] | None = None,
    timeout_seconds: float = 90,
) -> str:
    """Send prompts to OpenAI and return the completed response text."""
    api_key = get_settings().openai_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        raise LLMError("Set OPENAI_API_KEY in the backend environment.")

    params = {
        "model": model,
        "instructions": system_prompt,
        "input": input_prompt,
        "max_output_tokens": max_output_tokens,
        "store": False,
    }
    if reasoning_effort is not None:
        params["reasoning"] = {"effort": reasoning_effort}
    if verbosity is not None:
        params["text"] = {"verbosity": verbosity}
    if temperature is not None:
        params["temperature"] = temperature
    if output_model is not None:
        params.setdefault("text", {})["format"] = {
            "type": "json_schema", "name": output_model.__name__, "strict": True,
            "schema": output_model.model_json_schema(),
        }

    started = perf_counter()
    response = None
    try:
        async with AsyncOpenAI(
            # Avoid hidden provider retries; the assessment service owns validation repair.
            api_key=api_key.get_secret_value(), timeout=timeout_seconds, max_retries=0,
        ) as client:
            stream = await client.responses.create(**params, stream=True)
            async with stream:
                async for event in stream:
                    if event.type in {"response.completed", "response.incomplete", "response.failed"}:
                        response = event.response
    except (APIError, httpx.HTTPError, json.JSONDecodeError) as error:
        status = getattr(error, "status_code", None)
        status = status if type(status) is int and 100 <= status <= 599 else None
        code = getattr(error, "code", None)
        code = code if isinstance(code, str) and code in SAFE_ERROR_CODES else None
        logger.warning(
            "OpenAI request failed type=%s status=%s code=%s cause_type=%s elapsed_seconds=%.3f",
            type(error).__name__, status, code,
            type(error.__cause__).__name__ if error.__cause__ is not None else None,
            perf_counter() - started,
        )
        raise LLMError("OpenAI could not complete the request.") from None

    if response is None:
        logger.warning("OpenAI response unusable status=missing_terminal elapsed_seconds=%.3f", perf_counter() - started)
        raise LLMError("OpenAI did not return a complete text response.")
    if response.status != "completed" or not response.output_text.strip():
        status = response.status if response.status in {"completed", "incomplete", "failed", "cancelled", "queued", "in_progress"} else "unexpected"
        reason = getattr(response.incomplete_details, "reason", None)
        reason = reason if reason in {"max_output_tokens", "content_filter"} else None
        logger.warning("OpenAI response unusable status=%s reason=%s elapsed_seconds=%.3f", status, reason, perf_counter() - started)
        raise LLMError("OpenAI did not return a complete text response.")
    if any(
        part.type == "refusal"
        for item in response.output if item.type == "message"
        for part in item.content
    ):
        raise LLMError("The model declined to generate this response.")
    return response.output_text
