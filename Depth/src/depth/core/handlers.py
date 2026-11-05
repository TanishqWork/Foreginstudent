import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from depth.core.exceptions import AuthenticationError, LLMError, RateLimitError

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(LLMError)
    async def llm_error(request: Request, error: LLMError):
        return JSONResponse(
            status_code=502, content={"detail": "AI generation did not return a complete response."},
        )

    @app.exception_handler(AuthenticationError)
    async def authentication_error(request: Request, error: AuthenticationError):
        return JSONResponse(status_code=401, content={"detail": "Invalid email, password, or session."})

    @app.exception_handler(RateLimitError)
    async def rate_limit_error(request: Request, error: RateLimitError):
        return JSONResponse(
            status_code=429, content={"detail": str(error)},
            headers={"Retry-After": str(error.retry_after)},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # FastAPI's default validation response includes raw input. Never echo passwords.
        details = [
            {"type": item["type"], "loc": item["loc"], "msg": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": details})

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, error: SQLAlchemyError):
        logger.error("Database operation failed (%s)", type(error).__name__)
        return JSONResponse(
            status_code=503,
            content={"detail": "Database is unavailable. Please try again later."},
        )
