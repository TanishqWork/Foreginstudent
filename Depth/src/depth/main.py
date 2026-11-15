import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from depth.core.config import Settings, get_settings
from depth.core.handlers import register_exception_handlers
from depth.core.logging import configure_logging
from depth.core.middleware import AuthMiddleware
from depth.database.session import create_database, warm_pool
from depth.integrations.llm import close_client
from depth.routes import router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging()
    engine, session_factory = create_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # In the background, so the API starts at once and requests never wait on the warm-up.
        warm_up = asyncio.create_task(asyncio.to_thread(warm_pool, engine))
        try:
            yield
        finally:
            # Interrupted AI jobs are marked failed (a report keeps its unlock) so students can retry after a restart.
            for task in list(app.state.background_tasks):
                task.cancel()
            await asyncio.gather(*app.state.background_tasks, return_exceptions=True)
            await asyncio.gather(warm_up, return_exceptions=True)
            await close_client()
            engine.dispose()

    app = FastAPI(title="Statement Studio API", version="0.2.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.background_tasks = set()
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
