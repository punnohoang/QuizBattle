from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db import get_db
from app.schemas.history import PlayedSessionDetailResponse, UserHistoryResponse
from app.services.history_service import HistoryService

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/me", response_model=UserHistoryResponse)
async def get_my_history(
    current_user: CurrentUser,
    limit: int = Query(5, ge=1, le=50),
    played_page: int = Query(1, ge=1),
    hosted_page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> UserHistoryResponse:
    service = HistoryService(db)
    return await service.get_user_history(current_user.id, limit, played_page, hosted_page)


@router.get("/played/{session_id}", response_model=PlayedSessionDetailResponse)
async def get_played_session_detail(
    session_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> PlayedSessionDetailResponse:
    service = HistoryService(db)
    detail = await service.get_played_session_detail(current_user.id, session_id)
    return detail
