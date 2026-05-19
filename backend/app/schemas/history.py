from datetime import datetime

from pydantic import BaseModel


class PaginationMetadata(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int


class HistoryOptionResponse(BaseModel):
    id: int
    content: str

    class Config:
        from_attributes = True


class PlayedQuestionHistoryResponse(BaseModel):
    question_id: int
    question_order_index: int
    question_content: str
    question_type: str
    selected_option_ids: list[int]
    selected_options: list[HistoryOptionResponse]
    correct_option_ids: list[int]
    correct_options: list[HistoryOptionResponse]
    is_correct: bool
    score_earned: int
    response_time_ms: int
    response_time_seconds: float


class PlayedSessionSummaryResponse(BaseModel):
    session_id: int
    room_code: str
    quiz_id: int
    quiz_title: str
    host_username: str
    started_at: datetime | None
    ended_at: datetime | None
    total_questions: int
    answered_questions: int
    correct_answers: int
    wrong_answers: int
    accuracy_percentage: float
    average_response_time_ms: float
    average_response_time_seconds: float
    top_players: list[dict]


class PlayedSessionDetailResponse(PlayedSessionSummaryResponse):
    questions: list[PlayedQuestionHistoryResponse]


class HostedPlayerSummaryResponse(BaseModel):
    user_id: int | None
    username: str
    total_score: int
    correct_answers: int
    wrong_answers: int
    accuracy_percentage: float


class HostedSessionHistoryResponse(BaseModel):
    session_id: int
    room_code: str
    quiz_id: int
    quiz_title: str
    started_at: datetime | None
    ended_at: datetime | None
    participant_count: int
    total_answers: int
    correct_answers: int
    wrong_answers: int
    correct_rate: float
    wrong_rate: float
    average_response_time_ms: float
    average_response_time_seconds: float
    top_players: list[HostedPlayerSummaryResponse]


class UserHistoryResponse(BaseModel):
    played_sessions: list[PlayedSessionSummaryResponse]
    hosted_sessions: list[HostedSessionHistoryResponse]
    played_pagination: PaginationMetadata
    hosted_pagination: PaginationMetadata
