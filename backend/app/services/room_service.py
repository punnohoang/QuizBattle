import random
import string

from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GameSession, Quiz
from app.schemas.room import RoomCreateRequest

ROOM_CODE_LENGTH = 6
ROOM_STATE_WAITING = "WAITING"
ROOM_CODE_KEY_PREFIX = "room_code:"
ROOM_STATE_KEY_TEMPLATE = "quiz-room:{id}:state"
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
            await self.redis.set(ROOM_STATE_KEY_TEMPLATE.format(id=session.id), ROOM_STATE_WAITING)
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
                Quiz.user_id == user_id,
                Quiz.is_deleted == False,
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

    @staticmethod
    def _generate_code() -> str:
        allowed_chars = string.ascii_uppercase + string.digits
        return "".join(random.choices(allowed_chars, k=ROOM_CODE_LENGTH))
