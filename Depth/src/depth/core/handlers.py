import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from depth.core.exceptions import AssessmentError, AuthenticationError, LLMError, RateLimitError

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AssessmentError)
    async def assessment_error(request: Request, error: AssessmentError):
        errors = {
            "not_found": (404, "This temporary assessment is unavailable. Run a new free assessment."),
            "locked": (403, "Use the mock unlock before generating this report."),
            "generating": (409, "This report is already generating. Wait for it to finish."),
            "needs_input": (422, "Complete the free assessment inputs before unlocking a report."),
            "capacity": (503, "All temporary report slots are busy. Try again after a report finishes."),
            "duplicate": (409, "This assessment is already cached."),
        }
        code, detail = errors[error.code]
        return JSONResponse(status_code=code, content={"detail": detail}, headers={"Cache-Control": "no-store"})

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
