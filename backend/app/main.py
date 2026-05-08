from fastapi import FastAPI

from .auth import router as auth_router
from .db import init_db
from . import models

app = FastAPI(title="QuizBattle API")


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


app.include_router(auth_router)


@app.get("/")
async def root():
    return {"message": "QuizBattle API Running"}