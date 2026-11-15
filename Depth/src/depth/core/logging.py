import logging


def configure_logging() -> None:
    """Show the application's INFO logs (such as OpenAI timing and token usage) beside uvicorn's output."""
    logger = logging.getLogger("depth")
    if logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
