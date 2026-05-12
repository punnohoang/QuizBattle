import random
import string

from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GameSession, Quiz
from app.schemas.room import RoomCreateRequest
from app.core.redis_keys import (
    ROOM_CODE_KEY_PREFIX,
    ROOM_STATE_KEY_TEMPLATE,
    get_room_state_key,
)
from app.core.redis_ops import RoomRedisManager


ROOM_CODE_LENGTH = 6
ROOM_STATE_WAITING = "WAITING"
MAX_CODE_GENERATION_ATTEMPTS = 10


class RoomService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def create_room(self, user_id: int, payload: RoomCreateRequest) -> GameSession:
        quiz = await self._get_quiz_for_user(user_id, payload.quiz_id)
        room_code = await self._generate_unique_room_code()
        room_code_key = f"{ROOM_CODE_KEY_PREFIX}{room_code}"

        session = GameSession(
            host_id=user_id,
            quiz_id=quiz.id,
            room_code=room_code,
            status="waiting",
        )

        self.db.add(session)

        try:
            await self.db.commit()
            await self.db.refresh(session)
        except IntegrityError:
            await self.db.rollback()
            await self.redis.delete(room_code_key)
            raise HTTPException(
                status_code=500,
                detail="Failed to create room due to a collision. Please try again.",
            )

        try:
            redis_ops = RoomRedisManager(self.redis)
            await redis_ops.set_room_state(session.id, False)
            await redis_ops.set_room_host_id(session.id, user_id)
            await self.redis.set(room_code_key, session.id)
        except Exception as exc:
            await self.db.delete(session)
            await self.db.commit()
            await self.redis.delete(room_code_key)
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize room state. Please try again.",
            ) from exc

        return session

    async def _get_quiz_for_user(self, user_id: int, quiz_id: int) -> Quiz:
        result = await self.db.execute(
            select(Quiz).where(
                Quiz.id == quiz_id,
                Quiz.is_deleted == False,
                or_(Quiz.user_id == user_id, Quiz.is_public == True),
            )
        )
        quiz = result.scalar_one_or_none()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return quiz

    async def _generate_unique_room_code(self) -> str:
        for _ in range(MAX_CODE_GENERATION_ATTEMPTS):
            room_code = self._generate_code()
            room_code_key = f"{ROOM_CODE_KEY_PREFIX}{room_code}"
            created = await self.redis.set(room_code_key, "1", nx=True)
            if created:
                return room_code

        raise HTTPException(
            status_code=500,
            detail="Unable to generate a unique room code. Please try again.",
        )

    async def get_room_access(self, user_id: int, room_code: str) -> dict:
        redis_ops = RoomRedisManager(self.redis)

        room_id = await self.redis.get(f"{ROOM_CODE_KEY_PREFIX}{room_code}")
        if room_id:
            room_id_int = int(room_id)
            host_id = await redis_ops.get_room_host_id(room_id_int)
            if host_id is not None:
                return {
                    "room_id": room_id_int,
                    "room_code": room_code,
                    "status": "waiting",
                    "is_host": host_id == user_id,
                }

        result = await self.db.execute(
            select(GameSession).where(GameSession.room_code == room_code)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Room not found")

        await redis_ops.set_room_host_id(session.id, session.host_id)
        return {
            "room_id": session.id,
            "room_code": session.room_code,
            "status": session.status,
            "is_host": session.host_id == user_id,
        }

    @staticmethod
    def _generate_code() -> str:
        allowed_chars = string.ascii_uppercase + string.digits
        return "".join(random.choices(allowed_chars, k=ROOM_CODE_LENGTH))
