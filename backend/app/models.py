from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    users: Mapped[list["User"]] = relationship(
        "User", secondary="role_users", back_populates="roles"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    roles: Mapped[list["Role"]] = relationship(
        "Role", secondary="role_users", back_populates="users"
    )
    quizzes: Mapped[list["Quiz"]] = relationship("Quiz", back_populates="user")
    game_sessions: Mapped[list["GameSession"]] = relationship(
        "GameSession", foreign_keys="GameSession.host_id", back_populates="host"
    )
    participants: Mapped[list["Participant"]] = relationship("Participant", back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship("RefreshToken", back_populates="user")


class RoleUser(Base):
    __tablename__ = "role_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="quizzes")
    questions: Mapped[list["Question"]] = relationship("Question", back_populates="quiz")
    game_sessions: Mapped[list["GameSession"]] = relationship("GameSession", back_populates="quiz")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(Integer, ForeignKey("quizzes.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # multiple_choice, short_answer, etc
    score_type: Mapped[str] = mapped_column(String(50), default="equal")  # equal, weighted
    time_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)  # seconds
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="questions")
    options: Mapped[list["Option"]] = relationship("Option", back_populates="question")
    player_answers: Mapped[list["PlayerAnswer"]] = relationship("PlayerAnswer", back_populates="question")


class Option(Base):
    __tablename__ = "options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    question: Mapped["Question"] = relationship("Question", back_populates="options")
    player_answers: Mapped[list["PlayerAnswer"]] = relationship("PlayerAnswer", back_populates="option")


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    host_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    quiz_id: Mapped[int] = mapped_column(Integer, ForeignKey("quizzes.id"), nullable=False)
    room_code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="waiting")  # waiting, in_progress, finished
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    host: Mapped["User"] = relationship("User", foreign_keys=[host_id], back_populates="game_sessions")
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="game_sessions")
    participants: Mapped[list["Participant"]] = relationship("Participant", back_populates="session")


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("game_sessions.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    total_score: Mapped[int] = mapped_column(Integer, default=0)

    session: Mapped["GameSession"] = relationship("GameSession", back_populates="participants")
    user: Mapped["User"] = relationship("User", back_populates="participants")
    answers: Mapped[list["PlayerAnswer"]] = relationship("PlayerAnswer", back_populates="participant")


class PlayerAnswer(Base):
    __tablename__ = "player_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participants.id"), nullable=False)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id"), nullable=False)
    option_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("options.id"), nullable=True)
    response_time: Mapped[int] = mapped_column(Integer, nullable=False)  # milliseconds
    score_earned: Mapped[int] = mapped_column(Integer, default=0)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    participant: Mapped["Participant"] = relationship("Participant", back_populates="answers")
    question: Mapped["Question"] = relationship("Question", back_populates="player_answers")
    option: Mapped["Option"] = relationship("Option", back_populates="player_answers")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(Text, nullable=False)
    device_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
