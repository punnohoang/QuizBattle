"""Redis key patterns and TTL constants for QuizBattle."""

# ============================================================================
# 9 CORE REDIS KEY PATTERNS
# ============================================================================

# 1. User info in room (nickname, display name, etc.)
def get_user_info_key(room_id: int) -> str:
    """quiz-room:{idRoom}:user-info (Hash, TTL: 1h)"""
    return f"quiz-room:{room_id}:user-info"


# 2. Room state (running/stopped)
def get_room_state_key(room_id: int) -> str:
    """quiz-room:{idRoom}:state (Hash, TTL: 24h)"""
    return f"quiz-room:{room_id}:state"


# 3. Player list in room
def get_players_key(room_id: int) -> str:
    """quiz-room:{idRoom}:player (Set, TTL: 24h)"""
    return f"quiz-room:{room_id}:player"


# 4. Room code mapping and lock
def get_room_code_key(room_code: str) -> str:
    """quiz-room:code:{code} (String, TTL: 24h)"""
    return f"quiz-room:code:{room_code}"


# 5. Current question marker for user
def get_current_question_key(room_id: int, user_id: int) -> str:
    """quiz-room:{idRoom}:now-question:{idUser} (String, TTL: 2h)"""
    return f"quiz-room:{room_id}:now-question:{user_id}"


# 6. Questions list for quiz
def get_questions_key(room_id: int) -> str:
    """quiz-room:{idRoom}:question (List, TTL: 2h)"""
    return f"quiz-room:{room_id}:question"


# 7. Answers with timing/metadata
def get_question_answers_key(room_id: int) -> str:
    """quiz-room:{idRoom}:question:answer (List, TTL: 2h)"""
    return f"quiz-room:{room_id}:question:answer"


# 8. Leaderboard with scores
def get_leaderboard_key(room_id: int) -> str:
    """quiz-room:{idRoom}:leaderboard (ZSet, TTL: 2h)"""
    return f"quiz-room:{room_id}:leaderboard"


# 9. User answer buffer for batch insert
def get_user_answers_key(room_id: int, user_id: int) -> str:
    """quiz-room:{idRoom}:answer:{idUser} (List, TTL: 2h)"""
    return f"quiz-room:{room_id}:answer:{user_id}"


# ============================================================================
# TTL CONSTANTS (in seconds)
# ============================================================================

TTL_USER_INFO = 3600  # 1 hour
TTL_ROOM_STATE = 86400  # 24 hours
TTL_PLAYERS = 86400  # 24 hours
TTL_CODE_LOCK = 10  # 10 seconds
TTL_QUESTION_MARKER = 7200  # 2 hours
TTL_QUESTIONS = 7200  # 2 hours
TTL_ANSWERS = 7200  # 2 hours
TTL_LEADERBOARD = 7200  # 2 hours
TTL_ANSWER_BUFFER = 7200  # 2 hours

# ============================================================================
# LEGACY COMPATIBILITY
# ============================================================================

# Old key format for backward compatibility
ROOM_CODE_KEY_PREFIX = "room_code:"
ROOM_STATE_KEY_TEMPLATE = "quiz-room:{id}:state"
