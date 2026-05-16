from fastapi import APIRouter

from .auth import router as auth_router
from .history import router as history_router
from .quiz import router as quiz_router
from .rooms import router as rooms_router
from .user import router as user_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(history_router)
v1_router.include_router(quiz_router)
v1_router.include_router(rooms_router)
v1_router.include_router(user_router)

__all__ = ["v1_router"]