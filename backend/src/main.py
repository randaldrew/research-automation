"""
FastAPI main application for Research Automation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from .core.config import get_settings
from .core.logging import get_logger
from .web.routes.api import router as api_router
from .web.routes.setup import router as setup_router
from .web.routes.settings import router as settings_router
from .web.routes import sources
from .core.engine import ProcessingEngine

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Research Automation")

    try:
        settings = get_settings()
        logger.info("Configuration loaded successfully",
                    data_dir=str(settings.data_dir),
                    environment=settings.app_env)

        # Initialize database BEFORE importing API routes
        from .storage.database import DatabaseManager
        db_manager = DatabaseManager()
        await db_manager.initialize()
        logger.info("Database initialized successfully")

        from .web.routes.api import set_database_manager
        set_database_manager(db_manager)
        logger.info("Database manager set for API routes")

    except Exception as e:
        logger.error("Failed to load configuration", error=str(e))
        raise

    yield

    # Shutdown
    logger.info("Shutting down Research Automation")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""

    settings = get_settings()

    try:
        processing_engine = ProcessingEngine()
        sources.set_source_manager(processing_engine.source_manager)
        logger.info("Source manager initialized for API routes")
    except Exception as e:
        logger.error(f"Failed to initialize source manager: {e}")

    # Create FastAPI app
    app = FastAPI(
        title="Research Automation",
        description="Intelligent newsletter and podcast summarization system",
        version="2.0.0",
        lifespan=lifespan,
    )

    # Configure CORS
    if settings.enable_cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.frontend_url, "http://localhost:3000"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Include routers
    app.include_router(api_router, prefix="/api/v1", tags=["api"])
    logger.info(f"Registered routes: {[route.path for route in app.routes]}")
    logger.info(f"Sources router routes: {[route.path for route in sources.router.routes]}")
    app.include_router(setup_router, prefix="/api/v1", tags=["setup"])
    logger.info(f"Registered routes: {[route.path for route in app.routes]}")
    logger.info(f"Sources router routes: {[route.path for route in sources.router.routes]}")
    app.include_router(settings_router, prefix="/api/v1", tags=["settings"])
    logger.info(f"Registered routes: {[route.path for route in app.routes]}")
    logger.info(f"Sources router routes: {[route.path for route in sources.router.routes]}")
    app.include_router(sources.router, prefix="/api/v1/sources", tags=["sources"])
    logger.info(f"Registered routes: {[route.path for route in app.routes]}")
    logger.info(f"Sources router routes: {[route.path for route in sources.router.routes]}")

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "version": "2.0.0",
            "environment": settings.app_env
        }

    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint"""
        return {
            "message": "Research Automation API",
            "version": "2.0.0",
            "docs_url": "/docs",
            "health_url": "/health"
        }

    return app


# Create the app instance
app = create_app()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=settings.app_env == "development",
        log_level=settings.log_level.lower()
    )