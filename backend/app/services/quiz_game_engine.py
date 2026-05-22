"""Quiz game engine - handles question flow, timer, and game progression."""

import asyncio
import json
from typing import Callable

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.game_state_manager import GameStateManager
from app.core.redis_ops import RoomRedisManager
from app.models import GameSession, Participant, PlayerAnswer, Option
from sqlalchemy import select
from datetime import datetime
from app.db import AsyncSessionLocal


class QuizGameEngine:
    """Manages quiz game flow with timer loop and state snapshots."""

    def __init__(self, redis: Redis, db: AsyncSession):
        self.redis = redis
        self.db = db
        self.state_manager = GameStateManager(redis, db)
        self._game_tasks: dict[int, asyncio.Task] = {}  # room_id -> task

    async def start_question_loop(
        self,
        room_id: int,
        broadcast_callback: Callable,
    ) -> None:
        """Start the main question loop for a game room."""
        if room_id in self._game_tasks:
            self._game_tasks[room_id].cancel()

        task = asyncio.create_task(
            self._question_loop(room_id, broadcast_callback)
        )
        self._game_tasks[room_id] = task

    async def _question_loop(
        self,
        room_id: int,
        broadcast_callback: Callable
    ) -> None:
        """Main question loop - runs until all questions answered or game ends."""
        try:
            players = await self.state_manager._get_room_active_connections(room_id)
            if not players:
                return

            question_index = 0
            total_questions = await self.state_manager.get_total_questions(room_id)

            if total_questions > 0:
                await asyncio.sleep(5.0)

            while question_index < total_questions:
                question = await self.state_manager.get_question_by_index(room_id, question_index)
                if not question:
                    break

                time_limit = question.get("time_limit", 30)

                await broadcast_callback({
                    "event": "question_start",
                    "question_index": question_index,
                    "question": {
                        "id": question["id"],
                        "content": question["content"],
                        "type": question["type"],
                        "time_limit": time_limit,
                        "options": [
                            {
                                "id": int(opt["id"]),
                                "content": opt["content"],
                                "order_index": opt["order_index"],
                            }
                            for opt in question["options"]
                        ]
                    },
                    "message": f"Question {question_index + 1} of {total_questions}",
                })

                for user_id in players:
                    await self.state_manager.set_current_question_index(
                        room_id,
                        user_id,
                        question_index
                    )

                # Run timer
                await self._run_question_timer(
                    room_id,
                    question_index,
                    question,
                    time_limit,
                    players,
                    broadcast_callback,
                    quiz_id=question.get("quiz_id", 0)
                )

                # Move to next question - pause to let players see results
                await asyncio.sleep(3) # Increase wait time to let people see the leaderboard
                question_index += 1

            # Game finished
            final_leaderboard = await self.state_manager.redis_ops.get_leaderboard(room_id)
            await broadcast_callback({
                "event": "game_finished",
                "message": "All questions completed!",
                "leaderboard": final_leaderboard
            })
            
            try:
                await self.finalize_game(room_id)
            except Exception as e:
                print(f"Error finalizing game {room_id}: {e}")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error in question loop: {e}")
            await broadcast_callback({
                "event": "game_error",
                "message": f"Game error: {str(e)}",
            })
        finally:
            if room_id in self._game_tasks:
                del self._game_tasks[room_id]

    async def _run_question_timer(
        self,
        room_id: int,
        question_index: int,
        question: dict,
        time_limit: int,
        players: list[int],
        broadcast_callback: Callable,
        quiz_id: int
    ) -> None:
        """Run timer for a single question and process scores at the end."""
        elapsed = 0
        pending_key = f"quiz-room:{room_id}:pending_scores:{question_index}"

        while elapsed < time_limit:
            for user_id in players:
                time_remaining = time_limit - elapsed - 1
                await self.state_manager.snapshot_game_state(
                    room_id=room_id,
                    user_id=user_id,
                    quiz_id=quiz_id,
                    question_index=question_index,
                    question_data={
                        "id": question["id"],
                        "content": question["content"],
                        "type": question["type"],
                        "time_limit": time_limit,
                        "options": question["options"]
                    },
                    time_remaining=time_remaining,
                    duration=time_limit
                )

            await broadcast_callback({
                "event": "question_timer",
                "time_remaining": time_limit - elapsed - 1,
                "question_index": question_index,
            })

            await asyncio.sleep(1)
            elapsed += 1

        # --- TIME IS UP: PROCESS PENDING SCORES ---
        # 1. Get all pending scores for this question
        pending_scores = await self.redis.hgetall(pending_key)
        
        # 2. Update the official leaderboard in Redis
        if pending_scores:
            for user_id_str, score_str in pending_scores.items():
                try:
                    score = int(score_str)
                except Exception:
                    continue
                if score > 0:
                    await self.state_manager.redis_ops.increment_leaderboard(room_id, user_id_str, score)
        
        # 3. Clean up pending scores key
        await self.redis.delete(pending_key)

        # 4. Get the updated leaderboard to broadcast
        leaderboard = await self.state_manager.redis_ops.get_leaderboard(room_id)
        
        # 5. Broadcast results and the NEW leaderboard
        await broadcast_callback({
            "event": "question_time_up",
            "question_index": question_index,
            "correct_answer": [
                int(opt["id"]) for opt in question["options"] 
                if opt.get("is_correct") is True or str(opt.get("is_correct")).lower() in ("true", "1")
            ],
            "leaderboard": leaderboard
        })

    async def submit_answer(
        self,
        room_id: int,
        user_id: str | int,
        question_index: int,
        selected_option_ids: list[int],
        time_taken: int,
        broadcast_callback: Callable
    ) -> dict:
        """Process user answer but keep score pending until question ends."""
        
        # 1. Ensure only one answer is accepted
        answered_key = f"quiz-room:{room_id}:answered:{question_index}"
        is_new = await self.state_manager.redis.sadd(answered_key, str(user_id))
        if not is_new:
            return {"error": "Already answered this question"}
        await self.state_manager.redis.expire(answered_key, 3600)

        # 2. Get current question
        question = await self.state_manager.get_question_by_index(room_id, question_index)
        if not question:
            return {"error": "Question not found"}

        # 3. Check correctness
        def is_opt_correct(opt):
            val = opt.get("is_correct")
            return val is True or val == 1 or (isinstance(val, str) and val.lower() in ("true", "1", "yes"))

        correct_option_ids = [int(opt["id"]) for opt in question["options"] if is_opt_correct(opt)]
        user_selected_ids = [int(oid) for oid in selected_option_ids]
        is_correct = set(user_selected_ids) == set(correct_option_ids) 
        
        # 4. Calculate score
        score = 0
        if is_correct:
            raw_limit = question.get("time_limit")
            time_limit = int(raw_limit) if raw_limit else 30
            if time_limit <= 0: time_limit = 30
            
            score_type = question.get("score_type", "normal")
            max_score = 2000 if score_type == "double" else 1000
            time_ratio = min(max(time_taken, 0) / time_limit, 1.0)
            score = max(int(max_score * (1 - 0.5 * time_ratio)), 200)

        # 5. Store in PENDING scores (DO NOT update leaderboard yet)
        pending_key = f"quiz-room:{room_id}:pending_scores:{question_index}"
        await self.redis.hset(pending_key, str(user_id), score)
        await self.redis.expire(pending_key, 3600)

        # 6. Buffer the submitted answer for final DB persistence
        try:
            option_id = user_selected_ids[0] if user_selected_ids else None
            answer_payload = json.dumps({
                "question_id": question["id"],
                "question_index": question_index,
                "selected_option_ids": user_selected_ids,
                "option_id": option_id,
                "is_correct": is_correct,
                "time_taken": time_taken,
                "score_earned": score,
                "answered_at": int(datetime.utcnow().timestamp()),
            })
            await self.state_manager.redis_ops.buffer_user_answer(room_id, user_id, answer_payload)
        except Exception as e:
            print(f"Failed to buffer answer: {e}")

        # 7. Mark as answered and snapshot state
        await self.state_manager.mark_question_answered(
            room_id, user_id, question_index,
            {"selected_option_ids": selected_option_ids, "is_correct": is_correct, "time_taken": time_taken, "points_earned": score},
            time_taken
        )

        # 8. Broadcast player answered event (WITHOUT the leaderboard)
        await broadcast_callback({
            "event": "player_answered",
            "user_id": user_id,
            "question_index": question_index,
            "message": f"A player has answered",
        })

        return {
            "is_correct": is_correct,
            "score": score,
            "correct_option_ids": correct_option_ids,
        }

    def stop_game(self, room_id: int) -> None:
        if room_id in self._game_tasks:
            self._game_tasks[room_id].cancel()
            del self._game_tasks[room_id]

    async def cleanup_room(self, room_id: int) -> None:
        self.stop_game(room_id)

    async def finalize_game(self, room_id: int) -> None:
        redis_ops = RoomRedisManager(self.redis)
        players = await redis_ops.get_all_players(room_id)
        players_map = {str(p.get("user_id")): p.get("username") for p in players}

        leaderboard = await redis_ops.get_leaderboard(room_id)
        score_map = {str(entry["user_id"]): entry["score"] for entry in leaderboard}

        user_info = await redis_ops.get_user_info(room_id)
        decoded_user_info: dict[str, str] = {}
        for key, value in (user_info or {}).items():
            try:
                decoded_key = key.decode("utf-8") if isinstance(key, (bytes, bytearray)) else str(key)
                decoded_value = value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value)
                decoded_user_info[decoded_key] = decoded_value
            except Exception:
                continue

        all_user_ids = set(decoded_user_info.keys()) | set(score_map.keys()) | set(players_map.keys())

        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(select(GameSession).where(GameSession.id == room_id))
                session = result.scalar_one_or_none()
            except Exception:
                session = None

            if session:
                session.status = "FINISHED"
                session.ended_at = datetime.utcnow()
                db.add(session)

            for raw_user_id in all_user_ids:
                nickname = decoded_user_info.get(str(raw_user_id)) or players_map.get(str(raw_user_id)) or "Guest"
                # Try to interpret user_id as int for real users; guests will remain as string
                user_id_db = None
                try:
                    user_id_db = int(raw_user_id)
                except Exception:
                    user_id_db = None

                participant = None
                if session:
                    if user_id_db is not None:
                        q = await db.execute(select(Participant).where(Participant.session_id == session.id, Participant.user_id == user_id_db))
                    else:
                        q = await db.execute(select(Participant).where(Participant.session_id == session.id, Participant.user_id == None, Participant.nickname == nickname))

                    participant = q.scalar_one_or_none()
                    # Score lookup uses string keys from leaderboard, so use raw_user_id
                    participant_score = score_map.get(str(raw_user_id), 0)
                    if not participant:
                        participant = Participant(session_id=session.id, user_id=user_id_db, nickname=nickname, total_score=participant_score)
                    else:
                        participant.total_score = participant_score
                    db.add(participant)
                    await db.flush()

                try:
                    buffered = await redis_ops.get_user_answers(room_id, raw_user_id)
                    for entry in buffered:
                        try:
                            if isinstance(entry, (bytes, bytearray)):
                                entry = entry.decode("utf-8")
                            parsed = json.loads(entry)
                            pa = PlayerAnswer(
                                participant_id=participant.id,
                                question_id=parsed["question_id"],
                                option_id=parsed.get("option_id"),
                                response_time=parsed.get("time_taken", 0) * 1000,
                                score_earned=parsed.get("score_earned", 0),
                                is_correct=parsed.get("is_correct", False),
                            )
                            db.add(pa)
                        except Exception:
                            continue
                    await redis_ops.clear_user_answers(room_id, raw_user_id)
                except Exception:
                    pass

            try:
                await db.commit()
            except Exception:
                await db.rollback()

        try:
            await redis_ops.clear_questions(room_id)
            await redis_ops.clear_answers(room_id)
            await redis_ops.cleanup_room(room_id)
        except: pass

async def get_game_engine(redis: Redis, db: AsyncSession) -> QuizGameEngine:
    global _game_engine
    if _game_engine is None: _game_engine = QuizGameEngine(redis, db)
    return _game_engine

_game_engine: QuizGameEngine | None = None
