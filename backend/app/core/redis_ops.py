"""Redis operations helper for quiz rooms."""

from typing import Any
from redis.asyncio import Redis
from app.core.redis_keys import (
    get_user_info_key,
    get_room_state_key,
    get_players_key,
    get_current_question_key,
    get_questions_key,
    get_question_answers_key,
    get_leaderboard_key,
    get_user_answers_key,
    TTL_USER_INFO,
    TTL_ROOM_STATE,
    TTL_PLAYERS,
    TTL_QUESTION_MARKER,
    TTL_QUESTIONS,
    TTL_ANSWERS,
    TTL_LEADERBOARD,
    TTL_ANSWER_BUFFER,
)


class RoomRedisManager:
    """Manages Redis operations for quiz rooms with proper TTLs."""

    def __init__(self, redis: Redis):
        self.redis = redis

    # ========================================================================
    # 1. USER INFO (Hash, 1h TTL)
    # ========================================================================

    async def set_user_info(self, room_id: int, user_id: int, nickname: str) -> None:
        """Store user nickname in room."""
        key = get_user_info_key(room_id)
        await self.redis.hset(key, str(user_id), nickname)
        await self.redis.expire(key, TTL_USER_INFO)

    async def get_user_info(self, room_id: int) -> dict[str, str]:
        """Get all user nicknames in room."""
        key = get_user_info_key(room_id)
        data = await self.redis.hgetall(key)
        return data or {}

    async def remove_user_info(self, room_id: int, user_id: int) -> None:
        """Remove user nickname from room."""
        key = get_user_info_key(room_id)
        await self.redis.hdel(key, str(user_id))

    # ========================================================================
    # 2. ROOM STATE (Hash, 24h TTL)
    # ========================================================================

    async def set_room_state(self, room_id: int, is_running: bool) -> None:
        """Set room state (true=running, false=stopped)."""
        key = get_room_state_key(room_id)
        state = "true" if is_running else "false"
        await self.redis.hset(key, "state", state)
        await self.redis.expire(key, TTL_ROOM_STATE)

    async def get_room_state(self, room_id: int) -> bool:
        """Get room state. Returns False if not found."""
        key = get_room_state_key(room_id)
        state = await self.redis.hget(key, "state")
        return state == "true" if state else False

    async def set_room_host_id(self, room_id: int, host_id: int) -> None:
        """Store room host user id in room state hash."""
        key = get_room_state_key(room_id)
        await self.redis.hset(key, "host_id", str(host_id))

    async def get_room_host_id(self, room_id: int) -> int | None:
        """Get room host user id from room state hash."""
        key = get_room_state_key(room_id)
        host_id = await self.redis.hget(key, "host_id")
        return int(host_id) if host_id else None

    # ========================================================================
    # 3. PLAYERS LIST (Set, 24h TTL)
    # ========================================================================

    async def add_player(self, room_id: int, player_data: str) -> None:
        """Add player to room (format: 'user_id:username')."""
        key = get_players_key(room_id)
        await self.redis.sadd(key, player_data)
        await self.redis.expire(key, TTL_PLAYERS)

    async def remove_player(self, room_id: int, player_data: str) -> None:
        """Remove player from room."""
        key = get_players_key(room_id)
        await self.redis.srem(key, player_data)

    async def get_all_players(self, room_id: int) -> list[dict]:
        """Get all players in room."""
        key = get_players_key(room_id)
        players = await self.redis.smembers(key)
        result = []
        for player_data in players:
            try:
                user_id, username = player_data.split(":", 1)
                result.append({"user_id": int(user_id), "username": username})
            except ValueError:
                continue
        return result

    async def get_player_count(self, room_id: int) -> int:
        """Get number of players in room."""
        key = get_players_key(room_id)
        return await self.redis.scard(key)

    # ========================================================================
    # 5. CURRENT QUESTION MARKER (String, 2h TTL)
    # ========================================================================

    async def set_current_question(self, room_id: int, user_id: int, question_index: int) -> None:
        """Mark current question for user."""
        key = get_current_question_key(room_id, user_id)
        await self.redis.set(key, str(question_index), ex=TTL_QUESTION_MARKER)

    async def get_current_question(self, room_id: int, user_id: int) -> int | None:
        """Get current question index for user."""
        key = get_current_question_key(room_id, user_id)
        value = await self.redis.get(key)
        return int(value) if value else None

    # ========================================================================
    # 6. QUESTIONS LIST (List, 2h TTL)
    # ========================================================================

    async def push_question(self, room_id: int, question_data: str) -> None:
        """Add question to room's question list."""
        key = get_questions_key(room_id)
        await self.redis.rpush(key, question_data)
        await self.redis.expire(key, TTL_QUESTIONS)

    async def get_questions(self, room_id: int) -> list[str]:
        """Get all questions for room."""
        key = get_questions_key(room_id)
        questions = await self.redis.lrange(key, 0, -1)
        return questions or []

    async def clear_questions(self, room_id: int) -> None:
        """Clear all questions for room."""
        key = get_questions_key(room_id)
        await self.redis.delete(key)

    # ========================================================================
    # 7. ANSWERS WITH METADATA (List, 2h TTL)
    # ========================================================================

    async def push_answer(self, room_id: int, answer_data: str) -> None:
        """Add answer metadata (format: '{questionId}:{answer}')."""
        key = get_question_answers_key(room_id)
        await self.redis.rpush(key, answer_data)
        await self.redis.expire(key, TTL_ANSWERS)

    async def get_answers(self, room_id: int) -> list[str]:
        """Get all answer metadata for room."""
        key = get_question_answers_key(room_id)
        answers = await self.redis.lrange(key, 0, -1)
        return answers or []

    async def clear_answers(self, room_id: int) -> None:
        """Clear all answer metadata for room."""
        key = get_question_answers_key(room_id)
        await self.redis.delete(key)

    # ========================================================================
    # 8. LEADERBOARD (ZSet, 2h TTL)
    # ========================================================================

    async def update_leaderboard(self, room_id: int, user_id: int, score: int) -> None:
        """Update user's score on leaderboard."""
        key = get_leaderboard_key(room_id)
        await self.redis.zadd(key, {str(user_id): score})
        await self.redis.expire(key, TTL_LEADERBOARD)

    async def increment_leaderboard(self, room_id: int, user_id: int, points: int) -> None:
        """Increment user's score on leaderboard."""
        key = get_leaderboard_key(room_id)
        await self.redis.zincrby(key, points, str(user_id))
        await self.redis.expire(key, TTL_LEADERBOARD)

    async def get_leaderboard(self, room_id: int, limit: int = 50) -> list[dict]:
        """Get top users on leaderboard (highest score first)."""
        key = get_leaderboard_key(room_id)
        results = await self.redis.zrange(key, 0, limit - 1, byscore=False, rev=True, withscores=True)
        leaderboard = []
        for user_id, score in results:
            leaderboard.append({"user_id": int(user_id), "score": int(score)})
        return leaderboard

    # ========================================================================
    # 9. ANSWER BUFFER (List, 2h TTL)
    # ========================================================================

    async def buffer_user_answer(self, room_id: int, user_id: int, answer_data: str) -> None:
        """Buffer user's answer for batch insert (format: '{questionId}:{answer}:{timestamp}')."""
        key = get_user_answers_key(room_id, user_id)
        await self.redis.rpush(key, answer_data)
        await self.redis.expire(key, TTL_ANSWER_BUFFER)

    async def get_user_answers(self, room_id: int, user_id: int) -> list[str]:
        """Get all buffered answers for user."""
        key = get_user_answers_key(room_id, user_id)
        answers = await self.redis.lrange(key, 0, -1)
        return answers or []

    async def clear_user_answers(self, room_id: int, user_id: int) -> None:
        """Clear buffered answers for user (after batch insert)."""
        key = get_user_answers_key(room_id, user_id)
        await self.redis.delete(key)

    # ========================================================================
    # ROOM CLEANUP
    # ========================================================================

    async def cleanup_room(self, room_id: int) -> None:
        """Clean up all Redis data for a room."""
        keys_to_delete = [
            get_user_info_key(room_id),
            get_room_state_key(room_id),
            get_players_key(room_id),
            get_current_question_key(room_id, 0),  # Pattern key, not exact
            get_questions_key(room_id),
            get_question_answers_key(room_id),
            get_leaderboard_key(room_id),
        ]
        for key in keys_to_delete:
            await self.redis.delete(key)
