from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api.router import api_router
from app.core.cache import RedisClient
from app.db import init_db
from app.api.v1.websocket import router as websocket_router

logger = logging.getLogger(__name__)

app = FastAPI(title="QuizBattle API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
    await RedisClient.get_instance()

@app.on_event("shutdown")
async def on_shutdown() -> None:
    await RedisClient.close()

# Include Routers
app.include_router(api_router)
# Include WebSocket router without extra prefix since it's already in the router definition
app.include_router(websocket_router, prefix="/ws/room")

@app.get("/")
async def root():
    return {"message": "QuizBattle API Running"}