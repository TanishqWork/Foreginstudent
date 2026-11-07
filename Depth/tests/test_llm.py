"""Focused tests for text generation; all provider HTTP traffic is mocked."""

import asyncio
import json
import traceback
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, SecretStr

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


def sse_event(event_type: str, **fields: Any) -> bytes:
    event = {"type": event_type, "sequence_number": 0, **fields}
    return f"event: {event_type}\ndata: {json.dumps(event)}\n\n".encode()


def streamed_completion(response: dict[str, Any] | None = None) -> httpx.Response:
    response = completion() if response is None else response
    created = {**response, "status": "in_progress", "output": []}
    body = sse_event("response.created", response=created)
    body += sse_event(f"response.{response['status']}", response=response)
    return httpx.Response(200, content=body, headers={"Content-Type": "text/event-stream"})


class EventStream(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes], failure: Exception | None = None):
        self.chunks = chunks
        self.failure = failure
        self.closed = False

    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk
        if self.failure is not None:
            raise self.failure

    async def aclose(self):
        self.closed = True


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
            client = AsyncOpenAI(
                **kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(record)),
            )
            clients.append(client)
            return client

        monkeypatch.setattr(llm, "AsyncOpenAI", create_sdk)
        return requests, clients

    return install


def test_generate_returns_text_keeps_prompts_separate_and_closes_client(mocked_provider) -> None:
    requests, clients = mocked_provider(lambda request: streamed_completion())

    result = asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))

    assert result == "Assessment text."
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert payload["model"] == "test-model"
    assert payload["instructions"] == SYSTEM_PROMPT
    assert payload["input"] == INPUT_PROMPT
    assert payload["store"] is False
    assert payload["stream"] is True
    assert payload["max_output_tokens"] == 4096
    assert not ({"reasoning", "text", "temperature"} & payload.keys())
    assert clients[0].is_closed()
    assert clients[0].timeout == 90
    assert clients[0].max_retries == 0


def test_selected_generation_options_reach_provider(mocked_provider) -> None:
    requests, clients = mocked_provider(lambda request: streamed_completion())

    asyncio.run(llm.generate_text(
        INPUT_PROMPT, SYSTEM_PROMPT, "test-model", reasoning_effort="high",
        verbosity="low", max_output_tokens=2048, temperature=0.2, timeout_seconds=180,
    ))

    payload = json.loads(requests[0].content)
    assert payload["reasoning"] == {"effort": "high"}
    assert payload["text"] == {"verbosity": "low"}
    assert payload["max_output_tokens"] == 2048
    assert payload["temperature"] == 0.2
    assert clients[0].timeout == 180
    assert "timeout_seconds" not in payload


def test_structured_output_schema_and_verbosity_reach_provider(mocked_provider) -> None:
    class AssessmentShape(BaseModel):
        model_config = ConfigDict(extra="forbid")
        summary: str

    requests, _ = mocked_provider(lambda request: streamed_completion())
    asyncio.run(llm.generate_text(
        INPUT_PROMPT, SYSTEM_PROMPT, "test-model", output_model=AssessmentShape,
        verbosity="low",
    ))
    payload = json.loads(requests[0].content)
    assert payload["text"]["verbosity"] == "low"
    output_format = payload["text"]["format"]
    assert output_format["type"] == "json_schema" and output_format["strict"] is True
    assert output_format["schema"]["additionalProperties"] is False
    assert output_format["schema"]["required"] == ["summary"]


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
    expected_type = {400: "BadRequestError", 429: "RateLimitError", "timeout": "APITimeoutError"}[failure]
    assert f"type={expected_type}" in caplog.text
    assert f"status={None if failure == 'timeout' else failure}" in caplog.text
    assert "cause_type=" in caplog.text and "elapsed_seconds=" in caplog.text


@pytest.mark.parametrize("provider_code,logged_code", [
    ("invalid_json_schema", "invalid_json_schema"),
    (f"{API_KEY} {INPUT_PROMPT} {SYSTEM_PROMPT}", "None"),
    ({"private": API_KEY}, "None"),
])
def test_error_logging_only_includes_allowlisted_codes(
    mocked_provider, provider_code, logged_code, caplog: pytest.LogCaptureFixture,
) -> None:
    diagnostic = f"private provider body {API_KEY} {INPUT_PROMPT} {SYSTEM_PROMPT}"
    requests, _ = mocked_provider(lambda request: httpx.Response(
        400, json={"error": {"message": diagnostic, "code": provider_code}},
    ))
    with pytest.raises(LLMError):
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))
    assert len(requests) == 1
    assert f"type=BadRequestError status=400 code={logged_code}" in caplog.text
    for secret in (API_KEY, INPUT_PROMPT, SYSTEM_PROMPT, "private provider body"):
        assert secret not in caplog.text


@pytest.mark.parametrize(
    "response",
    [
        completion(status="incomplete", incomplete_details={"reason": "max_output_tokens"}),
        completion(status="failed", error={"code": "server_error", "message": INPUT_PROMPT}),
        completion(output=[]),
        completion(output=[{
            "id": "msg_refusal", "type": "message", "status": "completed", "role": "assistant",
            "content": [
                {"type": "output_text", "text": "Partial response.", "annotations": []},
                {"type": "refusal", "refusal": INPUT_PROMPT},
            ],
        }]),
    ],
    ids=["incomplete", "failed", "empty", "refusal-with-text"],
)
def test_incomplete_empty_or_refused_output_is_rejected(mocked_provider, response, caplog) -> None:
    _, clients = mocked_provider(lambda request: streamed_completion(response))

    with pytest.raises(LLMError) as caught:
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))

    assert INPUT_PROMPT not in str(caught.value)
    assert clients[0].is_closed()
    for secret in (API_KEY, INPUT_PROMPT, SYSTEM_PROMPT):
        assert secret not in caplog.text
    if response["status"] == "incomplete":
        assert "status=incomplete reason=max_output_tokens" in caplog.text


@pytest.mark.parametrize("failure", [None, "disconnect", "malformed"])
def test_partial_stream_without_terminal_response_is_never_returned(mocked_provider, failure, caplog):
    partial = f"partial content {API_KEY} {INPUT_PROMPT} {SYSTEM_PROMPT}"
    chunks = [
        sse_event("response.created", response=completion(status="in_progress", output=[])),
        sse_event("response.output_text.delta", output_index=0, content_index=0, item_id="msg_test", delta=partial, logprobs=[]),
    ]
    if failure == "malformed":
        chunks.append(b"event: response.completed\ndata: {invalid-private-json\n\n")
    transport_failure = httpx.RemoteProtocolError(partial) if failure == "disconnect" else None
    body = EventStream(chunks, transport_failure)
    requests, clients = mocked_provider(lambda request: httpx.Response(
        200, stream=body, headers={"Content-Type": "text/event-stream"},
    ))
    with pytest.raises(LLMError) as caught:
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))
    assert len(requests) == 1 and body.closed and clients[0].is_closed()
    rendered = "".join(traceback.format_exception(type(caught.value), caught.value, caught.value.__traceback__))
    for secret in (API_KEY, INPUT_PROMPT, SYSTEM_PROMPT, "invalid-private-json"):
        assert secret not in caplog.text + rendered
    if failure == "disconnect":
        assert "type=RemoteProtocolError" in caplog.text
    elif failure == "malformed":
        assert "type=JSONDecodeError" in caplog.text
    else:
        assert "status=missing_terminal" in caplog.text


def test_successful_stream_and_client_close(mocked_provider):
    final = completion()
    body = EventStream([
        sse_event("response.created", response=completion(status="in_progress", output=[])),
        sse_event("response.completed", response=final),
    ])
    _, clients = mocked_provider(lambda request: httpx.Response(
        200, stream=body, headers={"Content-Type": "text/event-stream"},
    ))
    assert asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model")) == "Assessment text."
    assert body.closed and clients[0].is_closed()


def test_missing_api_key_fails_without_creating_provider_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(openai_api_key=None))

    def unexpected_client(**kwargs: Any):
        pytest.fail("Missing credentials must not construct a provider client")

    monkeypatch.setattr(llm, "AsyncOpenAI", unexpected_client)
    with pytest.raises(LLMError):
        asyncio.run(llm.generate_text(INPUT_PROMPT, SYSTEM_PROMPT, "test-model"))
