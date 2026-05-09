from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.cache import RedisClient
from app.core.dependencies import CurrentUser
from app.db import init_db
from app.models import Base

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


app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "QuizBattle API Running"}


# Protected endpoint example
@app.get("/api/v1/me")
async def get_current_user_info(current_user: CurrentUser):
    """Get current authenticated user information."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }