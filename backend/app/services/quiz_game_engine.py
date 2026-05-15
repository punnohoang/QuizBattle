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


class QuizGameEngine:
    """Manages quiz game flow with timer loop and state snapshots."""

    def __init__(self, redis: Redis, db: AsyncSession):
        self.redis = redis
        self.db = db
        self.state_manager = GameStateManager(redis, db)
        self._game_tasks: dict[int, asyncio.Task] = {}  # room_id -> task (each room handle by individual task - handle game events )

    async def start_question_loop(
        self,
        room_id: int,
        broadcast_callback: Callable,
    ) -> None:
        """
        Start the main question loop for a game room.
        
        Handles:
        1. Send first question
        2. Timer countdown
        3. Auto-advance to next question
        4. State snapshots (anti-F5)
        5. Game end detection
        
        Args:
            room_id: Game room ID
            broadcast_callback: Function to send events to players
        """
        # Cancel any existing task for this room
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
            # Get active player IDs
            players = await self.state_manager._get_room_active_connections(room_id)
            
            if not players:
                return

            # Track which question we're on
            question_index = 0
            total_questions = await self.state_manager.get_total_questions(room_id)

            # Initial delay before first question to align with countdown and navigation
            if total_questions > 0:
                await asyncio.sleep(5.0)

            while question_index < total_questions:
                # Get current question
                question = await self.state_manager.get_question_by_index(room_id, question_index)
                if not question:
                    break

                time_limit = question.get("time_limit", 30)

                # Broadcast question_start event
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
                                # Don't send is_correct to clients
                            }
                            for opt in question["options"]
                        ]
                    },
                    "message": f"Question {question_index + 1} of {total_questions}",
                })

                # Update each player's current question index
                for user_id in players:
                    await self.state_manager.set_current_question_index(
                        room_id,
                        user_id,
                        question_index
                    )

                # Run timer with snapshots
                await self._run_question_timer(
                    room_id,
                    question_index,
                    question,
                    time_limit,
                    players,
                    broadcast_callback,
                    quiz_id=question.get("quiz_id", 0)  # Pass quiz_id
                )

                # Move to next question - pause to let players see results
                await asyncio.sleep(1)
                question_index += 1

            # All questions finished
            final_leaderboard = await self.state_manager.redis_ops.get_leaderboard(room_id)
            await broadcast_callback({
                "event": "game_finished",
                "message": "All questions completed!",
                "leaderboard": final_leaderboard
            })
            # Persist final state and clean up Redis
            try:
                await self.finalize_game(room_id)
            except Exception as e:
                print(f"Error finalizing game {room_id}: {e}")

        except asyncio.CancelledError:
            pass  # Game was interrupted
        except Exception as e:
            print(f"Error in question loop: {e}")
            await broadcast_callback({
                "event": "game_error",
                "message": f"Game error: {str(e)}",
            })
        finally:
            # Clean up task
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
        quiz_id: int  # Added quiz_id
    ) -> None:
        """
        Run timer for a single question with state snapshots.
        
        Snapshots state every second to Redis for anti-F5 recovery.
        """
        elapsed = 0

        while elapsed < time_limit:
            # Snapshot state for each player
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

            # Broadcast timer tick
            await broadcast_callback({
                "event": "question_timer",
                "time_remaining": time_limit - elapsed - 1,
                "question_index": question_index,
            })

            # Wait 1 second
            await asyncio.sleep(1)
            elapsed += 1

        # Time's up - broadcast reveal and move on
        leaderboard = await self.state_manager.redis_ops.get_leaderboard(room_id)
        
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
        user_id: int,
        question_index: int,
        selected_option_ids: list[int],
        time_taken: int,
        broadcast_callback: Callable
    ) -> dict:
        # DEBUG LOGGING (optional pre-processing log)
        print(f"SUBMIT: room={room_id} user={user_id} q_idx={question_index} selected={selected_option_ids}")

        # 1. Ensure only one answer is accepted (acp first time, ignore duplicates)
        answered_key = f"quiz-room:{room_id}:answered:{question_index}"
        is_new = await self.state_manager.redis.sadd(answered_key, str(user_id))
        if not is_new:
            return {"error": "Already answered this question"}
        await self.state_manager.redis.expire(answered_key, 3600)

        # 2. Get current question (at submit time point)
        question = await self.state_manager.get_question_by_index(room_id, question_index)
        if not question:
            return {"error": "Question not found"}

        # 3. Check correctness (robust check for boolean values and ID types)
        def is_opt_correct(opt):
            val = opt.get("is_correct")
            if val is True or val == 1:
                return True
            if isinstance(val, str) and val.lower() in ("true", "1", "yes"):
                return True
            return False

        correct_option_ids = [
            int(opt["id"]) for opt in question["options"] 
            if is_opt_correct(opt)
        ]
        user_selected_ids = [int(oid) for oid in selected_option_ids]
        
        # FUTURE IMPROVEMENT: A QUESTION CAN HAVE MULTIPLE CORRECT OPTS.
        is_correct = set(user_selected_ids) == set(correct_option_ids) 

        # DEBUG LOGGING (Integrated into app directory for better visibility)
        try:
            log_msg = (
                f"--- SCORING DEBUG ---\n"
                f"Question Index: {question_index}\n"
                f"User ID: {user_id}\n"
                f"Correct IDs: {correct_option_ids}\n"
                f"Selected IDs: {user_selected_ids}\n"
                f"Match: {is_correct}\n"
                f"---------------------\n"
            )
            print(log_msg) # Log to console
            with open("scoring_debug.log", "a") as f:
                f.write(log_msg)
        except Exception as e:
            print(f"Failed to write scoring log: {e}")
        
        # 4. Calculate score
        score = 0
        if is_correct:
            raw_limit = question.get("time_limit")
            time_limit = int(raw_limit) if raw_limit else 30
            if time_limit <= 0: time_limit = 30
            
            score_type = question.get("score_type", "normal")
            max_score = 2000 if score_type == "double" else 1000
            
            # score = max_score * (1 - 0.5 * (time_used / time_limit))
            # time_used is time_taken
            time_ratio = min(max(time_taken, 0) / time_limit, 1.0)
            score = int(max_score * (1 - 0.5 * time_ratio))
            
            # Min 200 points
            score = max(score, 200)
            
            # Log final score calculation
            log_calc = (
                f"--- SCORE CALC ---\n"
                f"Time Taken: {time_taken}s / {time_limit}s\n"
                f"Ratio: {time_ratio}\n"
                f"Max Score: {max_score}\n"
                f"Final Score: {score}\n"
                f"------------------\n"
            )
            print(log_calc)
            with open("scoring_debug.log", "a") as f:
                f.write(log_calc)

        # 4.5. Buffer the submitted answer for final DB persistence
        try:
            option_id: int | None = user_selected_ids[0] if user_selected_ids else None
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
            print(f"Failed to buffer answer for room {room_id}, user {user_id}: {e}")

        # 5. Update Leaderboard immediately
        if score > 0:
            await self.state_manager.redis_ops.increment_leaderboard(room_id, user_id, score)

        # 6. Mark as answered and snapshot state
        await self.state_manager.mark_question_answered(
            room_id,
            user_id,
            question_index,
            {
                "selected_option_ids": selected_option_ids,
                "is_correct": is_correct,
                "time_taken": time_taken,
                "points_earned": score
            },
            time_taken
        )

        # 7. Broadcast player answered event
        await broadcast_callback({
            "event": "player_answered",
            "user_id": user_id,
            "question_index": question_index,
            "message": f"Player answered question {question_index + 1}",
        })

        return {
            "is_correct": is_correct,
            "score": score,
            "correct_option_ids": correct_option_ids,
        }

    def stop_game(self, room_id: int) -> None:
        """Stop the game loop for a room."""
        if room_id in self._game_tasks:
            self._game_tasks[room_id].cancel()
            del self._game_tasks[room_id]

    async def cleanup_room(self, room_id: int) -> None:
        """Cleanup all state for a room."""
        self.stop_game(room_id)

    async def finalize_game(self, room_id: int) -> None:
        """
        Finalize a finished game:
        - Batch insert buffered answers from Redis -> `player_answers`
        - Update `game_sessions` status to FINISHED and set ended_at
        - Ensure `participants` exist and update their `total_score` from leaderboard
        - Clear all Redis keys related to this room
        """
        redis_ops = RoomRedisManager(self.redis)

        # Load players and leaderboard from Redis
        players = await redis_ops.get_all_players(room_id)  # list of {user_id, username}
        leaderboard = await redis_ops.get_leaderboard(room_id)

        # Map user_id -> score
        score_map = {entry["user_id"]: entry["score"] for entry in leaderboard}

        # Load GameSession
        try:
            result = await self.db.execute(select(GameSession).where(GameSession.id == room_id))
            session = result.scalar_one_or_none()
        except Exception:
            session = None

        # Update session status
        if session:
            session.status = "FINISHED"
            session.ended_at = datetime.utcnow()
            self.db.add(session)

        # For each player: ensure Participant exists, update score, batch insert answers
        for p in players:
            user_id = int(p.get("user_id"))
            nickname = p.get("username") or ""

            # find or create participant
            participant = None
            if session:
                q = await self.db.execute(
                    select(Participant).where(
                        Participant.session_id == session.id,
                        Participant.user_id == user_id
                    )
                )
                participant = q.scalar_one_or_none()

                if not participant:
                    participant = Participant(
                        session_id=session.id,
                        user_id=user_id,
                        nickname=nickname,
                        total_score=score_map.get(user_id, 0),
                    )
                    self.db.add(participant)
                    await self.db.flush()
                else:
                    participant.nickname = nickname
                    participant.total_score = score_map.get(user_id, participant.total_score)
                    self.db.add(participant)

            # Batch insert buffered answers for this user
            try:
                buffered = await redis_ops.get_user_answers(room_id, user_id)
            except Exception:
                buffered = []

            def parse_buffered_answer(entry: str) -> dict | None:
                if isinstance(entry, (bytes, bytearray)):
                    entry = entry.decode("utf-8", errors="ignore")

                try:
                    parsed = json.loads(entry)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    pass

                # Legacy support for "{questionId}:{answer}:{timestamp}" entries
                try:
                    parts = entry.rsplit(":", 1)
                    if len(parts) != 2:
                        return None

                    question_answer = parts[0]
                    timestamp = int(parts[1])
                    q_parts = question_answer.split(":", 1)
                    if len(q_parts) != 2:
                        return None

                    question_id = int(q_parts[0])
                    answer_part = q_parts[1]
                    option_id = int(answer_part) if answer_part.isdigit() else None

                    return {
                        "question_id": question_id,
                        "selected_option_ids": [option_id] if option_id is not None else [],
                        "option_id": option_id,
                        "is_correct": False,
                        "time_taken": 0,
                        "score_earned": 0,
                        "answered_at": timestamp,
                    }
                except Exception:
                    return None

            answers_to_add = []
            for entry in buffered:
                try:
                    parsed = parse_buffered_answer(entry)
                    if not parsed:
                        continue

                    question_id = int(parsed["question_id"])
                    selected_option_ids = parsed.get("selected_option_ids") or []
                    option_id = parsed.get("option_id")
                    if option_id is None and selected_option_ids:
                        option_id = int(selected_option_ids[0])

                    is_correct = bool(parsed.get("is_correct", False))
                    score_earned = int(parsed.get("score_earned", 0) or 0)
                    time_taken = int(parsed.get("time_taken", 0) or 0)
                    answered_at = int(parsed.get("answered_at", 0) or 0)

                    if not is_correct and option_id is not None:
                        try:
                            opt_q = await self.db.execute(
                                select(Option).where(Option.id == option_id)
                            )
                            opt_obj = opt_q.scalar_one_or_none()
                            if opt_obj:
                                is_correct = bool(opt_obj.is_correct)
                        except Exception:
                            is_correct = False

                    # response_time should reflect time spent answering when available
                    response_time = time_taken * 1000 if time_taken > 0 else answered_at

                    if session and participant:
                        pa = PlayerAnswer(
                            participant_id=participant.id,
                            question_id=question_id,
                            option_id=option_id,
                            response_time=response_time,
                            score_earned=score_earned,
                            is_correct=is_correct,
                        )
                        answers_to_add.append(pa)
                except Exception:
                    continue

            # persist answers
            if answers_to_add:
                for a in answers_to_add:
                    self.db.add(a)

            # clear user's answer buffer
            try:
                await redis_ops.clear_user_answers(room_id, user_id)
            except Exception:
                pass

        # Commit DB changes
        try:
            await self.db.commit()
        except Exception as e:
            try:
                await self.db.rollback()
            except:
                pass
            print(f"Error committing finalized game data: {e}")

        # Finally, delete all Redis keys for room to free memory
        try:
            # delete per-user current question keys and answer buffers
            for p in players:
                try:
                    uid = int(p.get("user_id"))
                    from app.core.redis_keys import get_current_question_key, get_user_answers_key

                    await self.redis.delete(get_current_question_key(room_id, uid))
                    await self.redis.delete(get_user_answers_key(room_id, uid))
                except Exception:
                    continue

            # delete shared keys
            await redis_ops.clear_questions(room_id)
            await redis_ops.clear_answers(room_id)
            await redis_ops.cleanup_room(room_id)
        except Exception as e:
            print(f"Error cleaning redis for room {room_id}: {e}")


# Global game engine instance
_game_engine: QuizGameEngine | None = None


async def get_game_engine(redis: Redis, db: AsyncSession) -> QuizGameEngine:
    """Get or create global game engine instance."""
    global _game_engine
    if _game_engine is None:
        _game_engine = QuizGameEngine(redis, db)
    return _game_engine
