"""Focused tests for text generation; all provider HTTP traffic is mocked."""

import asyncio
import json
import traceback
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from openai import AsyncOpenAI
from pydantic import SecretStr

from depth.core.exceptions import LLMError
from depth.integrations import llm


API_KEY = "sk-test-only-private-key"
INPUT_PROMPT = "private-input-sentinel"
SYSTEM_PROMPT = "private-system-sentinel"


def completion(**changes: Any) -> dict[str, Any]:
    response = {
        "id": "resp_test", "object": "response", "created_at": 1,
        "status": "completed", "model": "test-model", "error": None,
        "incomplete_details": None,
        "output": [{
            "id": "msg_test", "type": "message", "status": "completed", "role": "assistant",
            "content": [{"type": "output_text", "text": "Assessment text.", "annotations": []}],
        }],
    }
    response.update(changes)
    return response


@pytest.fixture
def mocked_provider(monkeypatch: pytest.MonkeyPatch):
    """Use real SDK request handling with an in-memory HTTP transport."""
    monkeypatch.setattr(
        llm, "get_settings", lambda: SimpleNamespace(openai_api_key=SecretStr(API_KEY)),
    )
    requests: list[httpx.Request] = []
    clients: list[AsyncOpenAI] = []

    def install(handler):
        def record(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return handler(request)

        def create_sdk(**kwargs: Any) -> AsyncOpenAI:
            kwargs["max_retries"] = 0  # Error fixtures should not wait for SDK retry delays.
            client = AsyncOpenAI(
                **kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(record)),
            )
            clients.append(client)
            return client

        monkeypatch.setattr(llm, "AsyncOpenAI", create_sdk)
        return requests, clients

    return install


def test_generate_returns_text_keeps_prompts_separate_and_closes_client(mocked_provider) -> None:
    requests, clients = mocked_provider(lambda request: httpx.Response(200, json=completion()))

    result = asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))

    assert result == "Assessment text."
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert payload["model"] == "test-model"
    assert payload["instructions"] == SYSTEM_PROMPT
    assert payload["input"] == INPUT_PROMPT
    assert payload["store"] is False
    assert payload["max_output_tokens"] == 4096
    assert not ({"reasoning", "text", "temperature"} & payload.keys())
    assert clients[0].is_closed()


def test_selected_generation_options_reach_provider(mocked_provider) -> None:
    requests, _ = mocked_provider(lambda request: httpx.Response(200, json=completion()))

    asyncio.run(llm.generate_text(
        INPUT_PROMPT, SYSTEM_PROMPT, "test-model", reasoning_effort="high",
        verbosity="low", max_output_tokens=2048, temperature=0.2,
    ))

    payload = json.loads(requests[0].content)
    assert payload["reasoning"] == {"effort": "high"}
    assert payload["text"] == {"verbosity": "low"}
    assert payload["max_output_tokens"] == 2048
    assert payload["temperature"] == 0.2


@pytest.mark.parametrize("failure", [400, 429, "timeout"])
def test_provider_errors_are_sanitized_and_client_closes(
    mocked_provider, failure, caplog: pytest.LogCaptureFixture,
) -> None:
    diagnostic = f"provider details {API_KEY} {INPUT_PROMPT} {SYSTEM_PROMPT}"

    def fail(request: httpx.Request) -> httpx.Response:
        if failure == "timeout":
            raise httpx.ReadTimeout(diagnostic, request=request)
        return httpx.Response(failure, json={"error": {"message": diagnostic}})

    _, clients = mocked_provider(fail)
    with pytest.raises(LLMError) as caught:
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))

    error = caught.value
    rendered = "".join(traceback.format_exception(type(error), error, error.__traceback__))
    for secret in (API_KEY, INPUT_PROMPT, SYSTEM_PROMPT):
        assert secret not in rendered
        assert secret not in caplog.text
    assert clients[0].is_closed()


@pytest.mark.parametrize(
    "response",
    [
        completion(status="incomplete", incomplete_details={"reason": "max_output_tokens"}),
        completion(output=[]),
        completion(output=[{
            "id": "msg_refusal", "type": "message", "status": "completed", "role": "assistant",
            "content": [
                {"type": "output_text", "text": "Partial response.", "annotations": []},
                {"type": "refusal", "refusal": INPUT_PROMPT},
            ],
        }]),
    ],
    ids=["incomplete", "empty", "refusal-with-text"],
)
def test_incomplete_empty_or_refused_output_is_rejected(mocked_provider, response) -> None:
    _, clients = mocked_provider(lambda request: httpx.Response(200, json=response))

    with pytest.raises(LLMError) as caught:
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))

    assert INPUT_PROMPT not in str(caught.value)
    assert clients[0].is_closed()


def test_missing_api_key_fails_without_creating_provider_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(openai_api_key=None))

    def unexpected_client(**kwargs: Any):
        pytest.fail("Missing credentials must not construct a provider client")

    monkeypatch.setattr(llm, "AsyncOpenAI", unexpected_client)
    with pytest.raises(LLMError):
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))
