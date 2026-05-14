from fastapi import WebSocket, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_token
from app.db import AsyncSessionLocal
from app.core.cache import get_redis
from app.models import User
from app.core.redis_keys import get_players_key, get_room_code_key
from app.core.redis_ops import RoomRedisManager


class ConnectionManager:
    """Manages WebSocket connections for a room."""

    def __init__(self):
        # room_code -> list of (websocket, user_id) tuples
        self.active_connections: dict[str, list[tuple[WebSocket, int]]] = {}

    async def connect(self, room_code: str, websocket: WebSocket, user_id: int) -> None:
        """Add a new connection to the room (assumes already accepted)."""
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append((websocket, user_id))

    def disconnect(self, room_code: str, websocket: WebSocket, user_id: int) -> None:
        """Remove a connection from the room."""
        if room_code not in self.active_connections:
            return

        self.active_connections[room_code] = [
            (ws, uid)
            for ws, uid in self.active_connections[room_code]
            if ws != websocket or uid != user_id
        ]

        if not self.active_connections[room_code]:
            del self.active_connections[room_code]

    async def broadcast(
        self,
        room_code: str,
        message: dict,
        exclude_user_id: int | None = None,
    ) -> None:
        """Broadcast a message to all connections in a room."""
        if room_code not in self.active_connections:
            return

        disconnected: list[tuple[WebSocket, int]] = []
        for websocket, user_id in list(self.active_connections[room_code]):
            if exclude_user_id and user_id == exclude_user_id:
                continue

            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append((websocket, user_id))

        for websocket, user_id in disconnected:
            self.disconnect(room_code, websocket, user_id)

    def get_room_participants(self, room_code: str) -> list[int]:
        """Get all user IDs in a room."""
        if room_code not in self.active_connections:
            return []
        return [user_id for _, user_id in self.active_connections[room_code]]


manager = ConnectionManager()


async def verify_ws_token(token: str) -> int:
    """Verify JWT token from WebSocket query param and return user_id."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token",
        )

    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return int(payload.sub)


async def get_room_id_by_code(redis: Redis, room_code: str) -> int | None:
    """Resolve a room code to a room ID via Redis."""
    room_key = get_room_code_key(room_code)
    room_id = await redis.get(room_key)
    return int(room_id) if room_id else None


async def get_username(db: AsyncSession, user_id: int) -> str:
    """Fetch the username for a given user ID."""
    result = await db.execute(select(User.username).where(User.id == user_id))
    username = result.scalar_one_or_none()
    if not username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return username


async def add_player_to_redis(
    redis: Redis,
    room_id: int,
    user_id: int,
    username: str,
) -> None:
    """Add player to Redis player list."""
    manager_ops = RoomRedisManager(redis)
    player_data = f"{user_id}:{username}"
    await manager_ops.add_player(room_id, player_data)


async def remove_player_from_redis(
    redis: Redis,
    room_id: int,
    user_id: int,
    username: str,
) -> None:
    """Remove player from Redis player list."""
    manager_ops = RoomRedisManager(redis)
    player_data = f"{user_id}:{username}"
    await manager_ops.remove_player(room_id, player_data)


async def get_room_players_from_redis(redis: Redis, room_id: int) -> list[dict]:
    """Get all players in a room from Redis."""
    manager_ops = RoomRedisManager(redis)
    return await manager_ops.get_all_players(room_id)
