"""Helpers for AI jobs that run after their HTTP request has returned."""

import asyncio
import logging
from collections.abc import Callable, Coroutine
from contextlib import AbstractContextManager
from typing import Any, TypeVar

logger = logging.getLogger(__name__)
Service = TypeVar("Service")


def _retrieve_outcome(task: asyncio.Task) -> None:
    # Jobs record and log their own failures; this only marks the exception as handled.
    if not task.cancelled():
        task.exception()


def spawn(job: Coroutine[Any, Any, Any], tasks: set[asyncio.Task]) -> asyncio.Task:
    """Run a job in the background, held in `tasks` so it is not garbage-collected and is cancelled on shutdown."""
    task = asyncio.create_task(job)
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    task.add_done_callback(_retrieve_outcome)
    return task


def write_with(factory: Callable[[], AbstractContextManager[Service]], action: Callable[[Service], bool]) -> bool:
    """One database write from a background job. The request's session is closed by now, so this opens its own."""
    try:
        with factory() as service:
            return action(service)
    except Exception as error:
        logger.warning("Background job status could not be saved type=%s", type(error).__name__)
        return False
