import json
import random
import string
from datetime import datetime

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
    get_questions_key,
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

    async def start_room(self, user_id: int, room_code: str) -> dict:
        """
        Start a game room and cache all questions from Quiz to Redis.
        Only the host can start the game.
        """
        # Get room ID from Redis
        room_id_value = await self.redis.get(f"{ROOM_CODE_KEY_PREFIX}{room_code}")
        if not room_id_value:
            raise HTTPException(status_code=404, detail="Room not found")
        
        room_id = int(room_id_value)
        
        # Get room from database
        result = await self.db.execute(
            select(GameSession).where(GameSession.id == room_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="Room not found")
        
        # Verify user is the host
        if session.host_id != user_id:
            raise HTTPException(status_code=403, detail="Only host can start the game")
        
        # Check room status
        if session.status != "waiting":
            raise HTTPException(status_code=400, detail="Room is not in waiting state")
        
        # Update room status in database
        session.status = "playing"
        session.started_at = datetime.utcnow()
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        # Update room state in Redis
        redis_ops = RoomRedisManager(self.redis)
        await redis_ops.set_room_state(room_id, True)
        
        # Load and cache all questions from Quiz
        await self._cache_quiz_questions(room_id, session.quiz_id)
        
        return {
            "room_id": room_id,
            "room_code": room_code,
            "status": "playing",
            "started_at": session.started_at.isoformat(),
        }
    
    async def _cache_quiz_questions(self, room_id: int, quiz_id: int) -> None:
        """
        Fetch all questions + options from Quiz and cache to Redis.
        Key format: quiz-room:{room_id}:question
        """
        # Get quiz with all questions and options
        result = await self.db.execute(
            select(Quiz).where(Quiz.id == quiz_id, Quiz.is_deleted == False)
        )
        quiz = result.scalar_one_or_none()
        
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found or deleted")
        
        # Get active questions
        active_questions = quiz.active_questions
        
        if not active_questions:
            raise HTTPException(status_code=400, detail="Quiz has no questions")
        
        # Cache each question to Redis as a list
        redis_ops = RoomRedisManager(self.redis)
        await redis_ops.clear_questions(room_id)
        
        for question in active_questions:
            question_data = {
                "id": question.id,
                "content": question.content,
                "type": question.type.value if hasattr(question.type, 'value') else str(question.type),
                "score_type": question.score_type.value if hasattr(question.score_type, 'value') else str(question.score_type),
                "time_limit": question.time_limit,
                "order_index": question.order_index,
                "options": [
                    {
                        "id": opt.id,
                        "content": opt.content,
                        "is_correct": opt.is_correct,
                        "order_index": opt.order_index,
                    }
                    for opt in question.options
                ],
            }
            
            question_json = json.dumps(question_data)
            await redis_ops.push_question(room_id, question_json)
    
    @staticmethod
    def _generate_code() -> str:
        allowed_chars = string.ascii_uppercase + string.digits
        return "".join(random.choices(allowed_chars, k=ROOM_CODE_LENGTH))
