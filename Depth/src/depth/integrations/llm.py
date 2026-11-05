"""A simple OpenAI helper for backend services."""

from openai import APIError, AsyncOpenAI

from depth.core.config import get_settings
from depth.core.exceptions import LLMError


async def generate_text(
    input_prompt: str,
    system_prompt: str,
    model: str,
    *,
    reasoning_effort: str | None = None,
    verbosity: str | None = None,
    max_output_tokens: int = 4096,
    temperature: float | None = None,
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

    try:
        async with AsyncOpenAI(
            api_key=api_key.get_secret_value(), timeout=60, max_retries=2,
        ) as client:
            response = await client.responses.create(**params)
    except APIError:
        raise LLMError("OpenAI could not complete the request.") from None

    if response.status != "completed" or not response.output_text.strip():
        raise LLMError("OpenAI did not return a complete text response.")
    if any(
        part.type == "refusal"
        for item in response.output if item.type == "message"
        for part in item.content
    ):
        raise LLMError("The model declined to generate this response.")
    return response.output_text
