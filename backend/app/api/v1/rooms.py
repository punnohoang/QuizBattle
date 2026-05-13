from fastapi import APIRouter, Depends, status, WebSocketException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import json

from app.core.cache import get_redis
from app.core.dependencies import CurrentUser
from app.db import get_db
from app.schemas.room import RoomAccessResponse, RoomCreateRequest, RoomResponse
from app.services.room_service import RoomService
from app.services.websocket_manager import manager

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

# Check if they are the host or a player in the room, and to get any relevant access metadata.
@router.get("/{room_code}/access", response_model=RoomAccessResponse)
async def get_room_access(
    room_code: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> RoomAccessResponse:
    """Get access metadata for current user in a room (host or player)."""
    service = RoomService(db, redis)
    return await service.get_room_access(current_user.id, room_code)

@router.post("/{room_code}/start", status_code=status.HTTP_200_OK)
async def start_room(
    room_code: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Start a game room (Host only).
    Changes room status to PLAYING and caches all quiz questions to Redis.
    Broadcasts game_starting event with 3-second countdown.
    """
    service = RoomService(db, redis)
    result = await service.start_room(current_user.id, room_code)
    
    # Broadcast game_starting event with countdown
    async def broadcast_countdown():
        for countdown in [3, 2, 1]:
            await manager.broadcast(
                room_code,
                {
                    "event": "game_starting",
                    "countdown": countdown,
                    "message": f"Game starts in {countdown}s...",
                }
            )
            await asyncio.sleep(1)
        
        # Final game_started event
        await manager.broadcast(
            room_code,
            {
                "event": "game_started",
                "message": "Game has started!",
            }
        )
    
    # Run broadcast in background
    asyncio.create_task(broadcast_countdown())
    
    return result