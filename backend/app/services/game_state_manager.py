"""Game state management and timer loop for real-time quiz gameplay."""

import asyncio
import json
from datetime import datetime
from typing import Optional

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_ops import RoomRedisManager
from app.core.redis_keys import get_current_question_key, get_questions_key
from app.models import GameSession


class GameStateManager:
    """Manages game state, timers, and state snapshots for recovery."""

    def __init__(self, redis: Redis, db: AsyncSession):
        self.redis = redis
        self.db = db
        self.redis_ops = RoomRedisManager(redis)

    async def get_current_question_index(self, room_id: int, user_id: int) -> int:
        """Get user's current question index from Redis."""
        key = get_current_question_key(room_id, user_id)
        value = await self.redis.get(key)
        return int(value) if value else 0

    async def set_current_question_index(self, room_id: int, user_id: int, index: int) -> None:
        """Set user's current question index."""
        key = get_current_question_key(room_id, user_id)
        await self.redis.set(key, str(index), ex=7200)  # 2 hour TTL

    async def get_question_by_index(self, room_id: int, index: int) -> Optional[dict]:
        """Get question from cached list by index."""
        questions_key = get_questions_key(room_id)
        question_json = await self.redis.lindex(questions_key, index)
        
        if question_json:
            return json.loads(question_json)
        return None

    async def get_total_questions(self, room_id: int) -> int:
        """Get total number of questions in cached quiz."""
        questions_key = get_questions_key(room_id)
        return await self.redis.llen(questions_key)

    async def snapshot_game_state(
        self,
        room_id: int,
        user_id: int,
        question_index: int,
        question_data: dict,
        time_remaining: int,
        is_answered: bool = False
    ) -> None:
        """
        Snapshot current game state to Redis for anti-F5 recovery.
        
        Key: quiz-room:{room_id}:user-state:{user_id}
        Stores: current question, timer, state
        """
        state_key = f"quiz-room:{room_id}:user-state:{user_id}"
        
        state = {
            "question_index": question_index,
            "question": question_data,
            "time_remaining": time_remaining,
            "is_answered": is_answered,
            "snapshot_at": datetime.utcnow().isoformat(),
        }
        
        await self.redis.set(
            state_key,
            json.dumps(state),
            ex=7200  # 2 hour TTL
        )

    async def recover_game_state(self, room_id: int, user_id: int) -> Optional[dict]:
        """
        Recover game state when user reconnects.
        Returns the last snapshot or None if not found.
        """
        state_key = f"quiz-room:{room_id}:user-state:{user_id}"
        state_json = await self.redis.get(state_key)
        
        if state_json:
            return json.loads(state_json)
        return None

    async def start_question_timer(
        self,
        room_id: int,
        question_index: int,
        time_limit: int,
        on_timeout_callback
    ) -> None:
        """
        Start timer for current question.
        
        Args:
            room_id: Room ID
            question_index: Current question index
            time_limit: Time limit in seconds
            on_timeout_callback: Async function to call when timer expires
        """
        elapsed = 0
        
        while elapsed < time_limit:
            # Wait 1 second
            await asyncio.sleep(1)
            elapsed += 1
            
            time_remaining = time_limit - elapsed
            
            # Update user states - snapshot every second
            active_connections = await self._get_room_active_connections(room_id)
            
            for user_id in active_connections:
                # Get question data
                question = await self.get_question_by_index(room_id, question_index)
                if question:
                    await self.snapshot_game_state(
                        room_id,
                        user_id,
                        question_index,
                        question,
                        time_remaining,
                        is_answered=False
                    )
        
        # Timer expired - call callback
        await on_timeout_callback(room_id, question_index)

    async def _get_room_active_connections(self, room_id: int) -> list[int]:
        """Get list of active user IDs in room."""
        key = f"quiz-room:{room_id}:players"
        players = await self.redis.smembers(key)
        
        user_ids = []
        for player_data in players:
            try:
                user_id, username = player_data.split(":", 1)
                user_ids.append(int(user_id))
            except (ValueError, AttributeError):
                continue
        
        return user_ids

    async def mark_question_answered(
        self,
        room_id: int,
        user_id: int,
        question_index: int,
        answer_data: dict,
        time_taken: int
    ) -> None:
        """
        Mark question as answered and snapshot final state.
        
        Args:
            room_id: Room ID
            user_id: User ID
            question_index: Question index
            answer_data: User's answer selection
            time_taken: Time taken to answer (seconds)
        """
        question = await self.get_question_by_index(room_id, question_index)
        
        if question:
            # Update snapshot with answered flag
            await self.snapshot_game_state(
                room_id,
                user_id,
                question_index,
                question,
                0,  # time_remaining = 0 when answered
                is_answered=True
            )

    async def is_game_finished(self, room_id: int, user_id: int) -> bool:
        """Check if user has finished all questions."""
        current_index = await self.get_current_question_index(room_id, user_id)
        total_questions = await self.get_total_questions(room_id)
        
        return current_index >= total_questions


    async def get_next_question_index(self, room_id: int, user_id: int) -> Optional[int]:
        """Get next question index, or None if finished."""
        current_index = await self.get_current_question_index(room_id, user_id)
        total_questions = await self.get_total_questions(room_id)
        
        next_index = current_index + 1
        
        if next_index < total_questions:
            return next_index
        
        return None
