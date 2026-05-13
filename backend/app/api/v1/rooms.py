from fastapi import APIRouter, Depends, status, WebSocketException, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import json

from app.core.cache import get_redis
from app.core.dependencies import CurrentUser
from app.db import get_db, AsyncSessionLocal
from app.schemas.room import RoomAccessResponse, RoomCreateRequest, RoomResponse
from app.services.room_service import RoomService
from app.services.websocket_manager import manager
from app.services.quiz_game_engine import QuizGameEngine

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


@router.post("/{room_code}/start-questions", status_code=status.HTTP_200_OK)
async def start_question_loop(
    room_code: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Start the question timer loop (Host only).
    Begins broadcasting questions with timer countdown.
    Handles state snapshots for anti-F5 recovery.
    
    Prerequisite: Game must be in "playing" status (from /start endpoint)
    """
    service = RoomService(db, redis)
    
    # Verify host and get room
    access = await service.get_room_access(current_user.id, room_code)
    if not access["is_host"]:
        raise HTTPException(status_code=403, detail="Only host can start questions")
    
    room_id = access["room_id"]
    
    # Create game engine and start question loop
    async with AsyncSessionLocal() as session:
        game_engine = QuizGameEngine(redis, session)
        
        # Define broadcast callback
        async def broadcast_to_room(event: dict):
            await manager.broadcast(room_code, event)
        
        # Start the question loop in background
        asyncio.create_task(
            game_engine.start_question_loop(room_id, broadcast_to_room)
        )
    
    return {
        "room_id": room_id,
        "room_code": room_code,
        "status": "questions_started",
        "message": "Question loop started",
    }