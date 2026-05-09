"""Game session and gameplay models."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, ModelConstants

if TYPE_CHECKING:
    from .user import User
    from .quiz import Quiz, Question, Option


class GameSession(Base):
    """Game session model for managing quiz games."""

    __tablename__ = "game_sessions"

    host_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    room_code: Mapped[str] = mapped_column(
        String(ModelConstants.ROOM_CODE_LENGTH),
        unique=True,
        index=True,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="waiting",
        index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        nullable=True
    )

    # Relationships
    host: Mapped["User"] = relationship(
        "User",
        foreign_keys=[host_id],
        back_populates="hosted_sessions",
        lazy="selectin"
    )
    quiz: Mapped["Quiz"] = relationship(
        "Quiz",
        back_populates="game_sessions",
        lazy="selectin"
    )
    participants: Mapped[list["Participant"]] = relationship(
        "Participant",
        back_populates="session",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    @property
    def active_participants(self) -> list["Participant"]:
        """Get participants who are still active in the session."""
        return [p for p in self.participants if p.user.is_active]

    @property
    def participant_count(self) -> int:
        """Get count of active participants."""
        return len(self.active_participants)

    @property
    def is_active(self) -> bool:
        """Check if session is currently active."""
        return self.status in ["waiting", "in_progress"]

    @property
    def duration(self) -> int | None:
        """Get session duration in seconds if completed."""
        if self.started_at and self.ended_at:
            return int((self.ended_at - self.started_at).total_seconds())
        return None

    def can_join(self, user: "User") -> bool:
        """Check if a user can join this session."""
        if not self.is_active:
            return False
        return not any(p.user_id == user.id for p in self.participants)

    def __str__(self) -> str:
        return f"GameSession(id={self.id}, room_code='{self.room_code}', status='{self.status}')"


class Participant(Base):
    """Participant model for tracking users in game sessions."""

    __tablename__ = "participants"

    session_id: Mapped[int] = mapped_column(
        ForeignKey("game_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    nickname: Mapped[str] = mapped_column(
        String(ModelConstants.NICKNAME_MAX_LENGTH),
        nullable=False
    )
    total_score: Mapped[int] = mapped_column(
        Integer,
        default=ModelConstants.DEFAULT_TOTAL_SCORE,
        nullable=False
    )

    # Relationships
    session: Mapped[GameSession] = relationship(
        "GameSession",
        back_populates="participants",
        lazy="selectin"
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="participations",
        lazy="selectin"
    )
    answers: Mapped[list["PlayerAnswer"]] = relationship(
        "PlayerAnswer",
        back_populates="participant",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    @property
    def correct_answers_count(self) -> int:
        """Get count of correct answers."""
        return sum(1 for answer in self.answers if answer.is_correct)

    @property
    def total_answers_count(self) -> int:
        """Get total count of answers given."""
        return len(self.answers)

    @property
    def accuracy_percentage(self) -> float:
        """Get accuracy percentage."""
        if not self.answers:
            return 0.0
        return (self.correct_answers_count / self.total_answers_count) * 100

    def __str__(self) -> str:
        return f"Participant(id={self.id}, nickname='{self.nickname}', score={self.total_score})"


class PlayerAnswer(Base):
    """Player answer model for tracking responses during games."""

    __tablename__ = "player_answers"

    participant_id: Mapped[int] = mapped_column(
        ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    option_id: Mapped[int | None] = mapped_column(
        ForeignKey("options.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    response_time: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    score_earned: Mapped[int] = mapped_column(
        Integer,
        default=ModelConstants.DEFAULT_SCORE_EARNED,
        nullable=False
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=ModelConstants.DEFAULT_IS_CORRECT,
        nullable=False,
        index=True
    )

    # Relationships
    participant: Mapped[Participant] = relationship(
        "Participant",
        back_populates="answers",
        lazy="selectin"
    )
    question: Mapped["Question"] = relationship(
        "Question",
        back_populates="player_answers",
        lazy="selectin"
    )
    option: Mapped["Option"] = relationship(
        "Option",
        back_populates="player_answers",
        lazy="selectin"
    )

    @property
    def response_time_seconds(self) -> float:
        """Get response time in seconds."""
        return self.response_time / 1000.0

    def __str__(self) -> str:
        return f"PlayerAnswer(id={self.id}, is_correct={self.is_correct}, score={self.score_earned})"