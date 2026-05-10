"""
Example usage of Redis key patterns and RoomRedisManager.

This file demonstrates how to use all 9 core Redis key patterns
in the QuizBattle application.
"""

from app.core.redis_ops import RoomRedisManager
from app.core.redis_keys import (
    get_user_info_key,
    get_room_state_key,
    get_players_key,
    get_current_question_key,
    get_questions_key,
    get_question_answers_key,
    get_leaderboard_key,
    get_user_answers_key,
)


# ============================================================================
# EXAMPLE 1: Setting up a new room
# ============================================================================

async def setup_room_example(redis_ops: RoomRedisManager, room_id: int):
    """Initialize Redis state for a new room."""
    
    # 1. Set room state to NOT running (waiting for players)
    await redis_ops.set_room_state(room_id, is_running=False)
    
    # 2. Add players as they join
    await redis_ops.add_player(room_id, "101:alice")
    await redis_ops.add_player(room_id, "102:bob")
    await redis_ops.add_player(room_id, "103:charlie")
    
    # 3. Cache user info
    await redis_ops.set_user_info(room_id, user_id=101, nickname="Alice Smith")
    await redis_ops.set_user_info(room_id, user_id=102, nickname="Bob Jones")
    await redis_ops.set_user_info(room_id, user_id=103, nickname="Charlie Brown")
    
    # 4. Load questions for the quiz
    questions = [
        '{"id": 1, "text": "What is 2+2?"}',
        '{"id": 2, "text": "What is the capital of France?"}',
        '{"id": 3, "text": "Which planet is largest?"}',
    ]
    for q in questions:
        await redis_ops.push_question(room_id, q)
    
    # 5. Load answers with options
    answers_data = [
        "1:A",  # Question 1, Option A
        "1:B",  # Question 1, Option B
        "1:C",  # Question 1, Option C
        "1:D",  # Question 1, Option D
        "2:A",  # Question 2, Option A (Paris)
        "2:B",  # Question 2, Option B
        "2:C",  # Question 2, Option C
        "2:D",  # Question 2, Option D
    ]
    for ans in answers_data:
        await redis_ops.push_answer(room_id, ans)
    
    print("✓ Room setup complete")


# ============================================================================
# EXAMPLE 2: Sending current question to user
# ============================================================================

async def send_question_to_user_example(
    redis_ops: RoomRedisManager,
    room_id: int,
    user_id: int,
    question_index: int = 0
):
    """Send a specific question to a user and mark their progress."""
    
    # Mark which question the user is on
    await redis_ops.set_current_question(room_id, user_id, question_index)
    
    # Get all questions
    questions = await redis_ops.get_questions(room_id)
    if question_index < len(questions):
        current_question = questions[question_index]
        print(f"Sending to user {user_id}: {current_question}")
    
    # Data sent to client
    response = {
        "event": "current_question",
        "userId": user_id,
        "quizId": 42,  # From GameSession
        "currentQuestion": question_index,
        "answers": {
            "1": "Option A",
            "2": "Option B",
            "3": "Option C",
            "4": "Option D"
        },
        "questionStartedAt": 1694000000,  # Unix timestamp
        "duration": 30  # seconds
    }
    return response


# ============================================================================
# EXAMPLE 3: User submitting an answer
# ============================================================================

async def submit_answer_example(
    redis_ops: RoomRedisManager,
    room_id: int,
    user_id: int,
    question_id: int,
    answer: str,
    timestamp: int
):
    """Buffer user's answer and update leaderboard."""
    
    # Buffer the answer for batch insert later
    answer_data = f"{question_id}:{answer}:{timestamp}"
    await redis_ops.buffer_user_answer(room_id, user_id, answer_data)
    
    # Check if answer is correct (example: correct answer is 'A')
    is_correct = answer == "A"
    points = 10 if is_correct else 0
    
    # Update leaderboard immediately
    if points > 0:
        await redis_ops.increment_leaderboard(room_id, user_id, points)
    
    print(f"User {user_id} answered {answer}: {'+' if is_correct else '-'}{points} pts")


# ============================================================================
# EXAMPLE 4: Broadcasting leaderboard to all users
# ============================================================================

async def get_leaderboard_example(redis_ops: RoomRedisManager, room_id: int):
    """Fetch current leaderboard standings."""
    
    leaderboard = await redis_ops.get_leaderboard(room_id, limit=10)
    
    # Format for broadcast
    broadcast_data = {
        "event": "leaderboard_update",
        "leaderboard": leaderboard,
        "timestamp": 1694000000
    }
    
    print(f"Leaderboard: {leaderboard}")
    return broadcast_data


# ============================================================================
# EXAMPLE 5: Player joins/leaves room
# ============================================================================

async def player_join_example(
    redis_ops: RoomRedisManager,
    room_id: int,
    user_id: int,
    username: str,
    nickname: str
):
    """Handle player join - update all Redis state."""
    
    # Add to player list
    player_data = f"{user_id}:{username}"
    await redis_ops.add_player(room_id, player_data)
    
    # Cache user info
    await redis_ops.set_user_info(room_id, user_id, nickname)
    
    # Get updated participants
    all_players = await redis_ops.get_all_players(room_id)
    
    # Broadcast event
    broadcast_event = {
        "event": "player_joined",
        "player": {"user_id": user_id, "username": username},
        "participants": all_players
    }
    
    print(f"Player joined: {username}")
    return broadcast_event


async def player_leave_example(
    redis_ops: RoomRedisManager,
    room_id: int,
    user_id: int,
    username: str
):
    """Handle player leave - update all Redis state."""
    
    # Remove from player list
    player_data = f"{user_id}:{username}"
    await redis_ops.remove_player(room_id, player_data)
    
    # Remove user info
    await redis_ops.remove_user_info(room_id, user_id)
    
    # Get updated participants
    all_players = await redis_ops.get_all_players(room_id)
    
    # Broadcast event
    broadcast_event = {
        "event": "player_left",
        "player": {"user_id": user_id, "username": username},
        "participants": all_players
    }
    
    print(f"Player left: {username}")
    return broadcast_event


# ============================================================================
# EXAMPLE 6: Batch insert answers to database
# ============================================================================

async def batch_insert_answers_example(
    redis_ops: RoomRedisManager,
    room_id: int,
    user_id: int
):
    """
    Retrieve buffered answers and prepare for DB insert.
    This would normally run periodically or after quiz completion.
    """
    
    # Get all buffered answers
    buffered_answers = await redis_ops.get_user_answers(room_id, user_id)
    
    # Parse and prepare for DB
    answers_to_insert = []
    for answer_data in buffered_answers:
        # Format: "{questionId}:{answer}:{timestamp}"
        parts = answer_data.rsplit(":", 1)
        if len(parts) == 2:
            question_answer = parts[0]  # "1:A"
            timestamp = int(parts[1])
            
            q_parts = question_answer.split(":")
            if len(q_parts) == 2:
                question_id = int(q_parts[0])
                answer = q_parts[1]
                
                answers_to_insert.append({
                    "user_id": user_id,
                    "question_id": question_id,
                    "answer": answer,
                    "answered_at": timestamp
                })
    
    # Insert to database here...
    # await db.execute(insert(PlayerAnswer).values(answers_to_insert))
    
    # Clear buffer
    await redis_ops.clear_user_answers(room_id, user_id)
    
    print(f"Batch inserted {len(answers_to_insert)} answers for user {user_id}")
    return answers_to_insert


# ============================================================================
# EXAMPLE 7: Room completion cleanup
# ============================================================================

async def cleanup_room_example(
    redis_ops: RoomRedisManager,
    room_id: int
):
    """Clean up all Redis data when room is completed."""
    
    # Get final leaderboard before cleanup
    final_leaderboard = await redis_ops.get_leaderboard(room_id)
    
    # Delete all room-related Redis keys
    await redis_ops.cleanup_room(room_id)
    
    print(f"Room {room_id} cleaned up. Final standings: {final_leaderboard}")
    return final_leaderboard


# ============================================================================
# EXAMPLE 8: Direct key access (if needed)
# ============================================================================

async def direct_key_access_example(room_id: int, user_id: int):
    """
    Get exact Redis keys if you need direct access.
    Usually not needed - use RoomRedisManager instead.
    """
    
    keys = {
        "user_info": get_user_info_key(room_id),
        "room_state": get_room_state_key(room_id),
        "players": get_players_key(room_id),
        "current_question": get_current_question_key(room_id, user_id),
        "questions": get_questions_key(room_id),
        "answers": get_question_answers_key(room_id),
        "leaderboard": get_leaderboard_key(room_id),
        "answer_buffer": get_user_answers_key(room_id, user_id),
    }
    
    return keys


# ============================================================================
# EXAMPLE 9: Usage in WebSocket handler
# ============================================================================

async def websocket_example(redis_ops: RoomRedisManager, room_id: int, user_id: int):
    """
    Typical flow in WebSocket connection handler.
    """
    
    # Player joins
    await player_join_example(redis_ops, room_id, user_id, "alice", "Alice Smith")
    
    # Send first question
    question_response = await send_question_to_user_example(
        redis_ops, room_id, user_id, question_index=0
    )
    print(f"Send to client: {question_response}")
    
    # User submits answer
    await submit_answer_example(
        redis_ops, room_id, user_id, question_id=1, answer="A", timestamp=1694000010
    )
    
    # Send next question
    question_response = await send_question_to_user_example(
        redis_ops, room_id, user_id, question_index=1
    )
    print(f"Send to client: {question_response}")
    
    # Broadcast leaderboard periodically
    leaderboard = await get_leaderboard_example(redis_ops, room_id)
    print(f"Broadcast: {leaderboard}")


if __name__ == "__main__":
    print("See examples in this file for Redis key pattern usage")
