from datetime import datetime

from pydantic import BaseModel, Field


# Quiz Schemas
class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    category: str = Field(min_length=1, max_length=100)


class QuizUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    category: str | None = Field(default=None, min_length=1, max_length=100)


class QuizResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: str | None
    category: str
    question_count: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Question Schemas
class OptionCreate(BaseModel):
    content: str = Field(min_length=1)
    is_correct: bool = False
    order_index: int


class OptionResponse(BaseModel):
    id: int
    content: str
    is_correct: bool
    order_index: int

    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    content: str = Field(min_length=1)
    type: str = Field(default="multiple_choice")  # multiple_choice, true_false
    score_type: str = Field(default="normal")  # normal, double
    time_limit: int | None = Field(default=None, ge=5, le=300)
    order_index: int
    options: list[OptionCreate]


class QuestionUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1)
    type: str | None = Field(default=None)
    score_type: str | None = Field(default=None)
    time_limit: int | None = Field(default=None, ge=5, le=300)
    order_index: int | None = Field(default=None)
    options: list[OptionCreate] | None = Field(default=None)


class QuestionResponse(BaseModel):
    id: int
    quiz_id: int
    content: str
    type: str
    score_type: str
    time_limit: int | None
    order_index: int
    options: list[OptionResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuizDetailResponse(QuizResponse):
    questions: list[QuestionResponse]
