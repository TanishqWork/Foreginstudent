from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from depth.core.config import Settings, get_settings
from depth.core.handlers import register_exception_handlers
from depth.core.middleware import AuthMiddleware
from depth.database.session import create_database
from depth.routes import router
from depth.services.assessment_store import AssessmentStore


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine, session_factory = create_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Statement Studio API", version="0.2.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.assessment_store = AssessmentStore()
    allowed_origins = list({settings.frontend_url, settings.api_url})
    app.add_middleware(
        CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True,
        allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
    )
    app.add_middleware(AuthMiddleware, allowed_origins=allowed_origins)
    register_exception_handlers(app)
    app.include_router(router)
    return app


app = create_app()
