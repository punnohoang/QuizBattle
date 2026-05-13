"""Quiz game engine - handles question flow, timer, and game progression."""

import asyncio
import json
from typing import Callable

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.game_state_manager import GameStateManager


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
                                "id": opt["id"],
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
                    broadcast_callback
                )

                # Move to next question
                question_index += 1

            # All questions finished
            await broadcast_callback({
                "event": "game_finished",
                "message": "All questions completed!",
            })

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
        broadcast_callback: Callable
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
                    room_id,
                    user_id,
                    question_index,
                    {
                        "id": question["id"],
                        "content": question["content"],
                        "type": question["type"],
                        "time_limit": time_limit,
                        "options": question["options"]
                    },
                    time_remaining,
                    is_answered=False
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
        await broadcast_callback({
            "event": "question_time_up",
            "question_index": question_index,
            "correct_answer": [
                opt["id"] for opt in question["options"] if opt["is_correct"]
            ],
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
        """
        Handle player answer submission.
        
        Returns scoring info and state update.
        """
        # Get question
        question = await self.state_manager.get_question_by_index(room_id, question_index)
        if not question:
            return {"error": "Question not found"}

        # Check correctness
        correct_option_ids = [opt["id"] for opt in question["options"] if opt["is_correct"]]
        is_correct = set(selected_option_ids) == set(correct_option_ids)

        # Mark as answered
        await self.state_manager.mark_question_answered(
            room_id,
            user_id,
            question_index,
            {
                "selected_option_ids": selected_option_ids,
                "is_correct": is_correct,
                "time_taken": time_taken,
            },
            time_taken
        )

        # Broadcast answer submission (not revealing correctness yet)
        await broadcast_callback({
            "event": "player_answered",
            "user_id": user_id,
            "question_index": question_index,
            "message": f"Player answered question {question_index + 1}",
        })

        return {
            "is_correct": is_correct,
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


# Global game engine instance
_game_engine: QuizGameEngine | None = None


async def get_game_engine(redis: Redis, db: AsyncSession) -> QuizGameEngine:
    """Get or create global game engine instance."""
    global _game_engine
    if _game_engine is None:
        _game_engine = QuizGameEngine(redis, db)
    return _game_engine
