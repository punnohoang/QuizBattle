from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.dependencies import CurrentUser
from app.db import get_db
from app.schemas.room import RoomCreateRequest, RoomResponse
from app.services.room_service import RoomService

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    payload: RoomCreateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> RoomResponse:
    """Create a new game room and initialize its Redis state."""
    service = RoomService(db, redis)
    room = await service.create_room(current_user.id, payload)
    return room
