import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.router import api_router
from app.core.cache import RedisClient
from app.db import init_db
from app.api.v1.websocket import router as websocket_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and Redis
    logger.info(f"🚀 Starting {settings.APP_NAME} in {settings.APP_ENV} mode")
    await init_db()
    await RedisClient.get_instance()
    yield
    # Shutdown: Close connections
    logger.info(f"🛑 Shutting down {settings.APP_NAME}")
    await RedisClient.close()

app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    docs_url="/docs",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routes
app.include_router(api_router)

# Include WebSocket Route
app.include_router(websocket_router, prefix="/ws/room")

@app.get("/", tags=["health"])
async def root():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0"
    }