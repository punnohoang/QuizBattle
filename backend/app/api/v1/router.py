from fastapi import APIRouter

from .auth import router as auth_router
from .quiz import router as quiz_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(quiz_router)

__all__ = ["v1_router"]