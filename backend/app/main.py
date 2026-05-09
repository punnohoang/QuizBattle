from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .db import init_db
from .utils.redis import RedisClient
from . import models

app = FastAPI(title="QuizBattle API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


app.include_router(auth_router)


@app.get("/")
async def root():
    return {"message": "QuizBattle API Running"}