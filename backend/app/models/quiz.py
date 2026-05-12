"""Quiz content models."""
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, ModelConstants, QuestionType, ScoreType

if TYPE_CHECKING:
    from .user import User
    from .game import GameSession


class Quiz(Base):
    """Quiz model representing a complete quiz with questions."""

    __tablename__ = "quizzes"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title: Mapped[str] = mapped_column(
        String(ModelConstants.TITLE_MAX_LENGTH),
        nullable=False
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    category: Mapped[str] = mapped_column(
        String(ModelConstants.CATEGORY_MAX_LENGTH),
        nullable=False,
        index=True
    )
    question_count: Mapped[int] = mapped_column(
        Integer,
        default=ModelConstants.DEFAULT_QUESTION_COUNT,
        nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=ModelConstants.DEFAULT_IS_DELETED,
        nullable=False,
        index=True
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=ModelConstants.DEFAULT_IS_PUBLIC,
        server_default=text("false"),
        nullable=False,
        index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="quizzes",
        lazy="selectin"
    )
    questions: Mapped[list["Question"]] = relationship(
        "Question",
        back_populates="quiz",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="Question.order_index"
    )
    game_sessions: Mapped[list["GameSession"]] = relationship(
        "GameSession",
        back_populates="quiz",
        lazy="selectin"
    )

    @property
    def owner_username(self) -> str:
        """Get the owning user's username for public quiz views."""
        return getattr(self.user, "username", "")

    @property
    def active_questions(self) -> list["Question"]:
        """Get non-deleted questions ordered by index."""
        return [q for q in self.questions if not getattr(q, 'is_deleted', False)]

    @property
    def total_questions(self) -> int:
        """Get count of active questions."""
        return len(self.active_questions)

    def __str__(self) -> str:
        return f"Quiz(id={self.id}, title='{self.title}', category='{self.category}')"


class Question(Base):
    """Question model representing individual quiz questions."""

    __tablename__ = "questions"

    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    # type - mean the question type (MTC | TF)
    type: Mapped[QuestionType] = mapped_column(
        SAEnum(
            QuestionType,
            native_enum=False,
            validate_strings=True,
            create_constraint=True,
            name="question_type_enum",
        ),
        nullable=False,
        default=QuestionType.MTC
    )
    # score_type - mean the score multiple for this question can be (normal | double)
    score_type: Mapped[ScoreType] = mapped_column(
        SAEnum(
            ScoreType,
            native_enum=False,
            validate_strings=True,
            create_constraint=True,
            name="score_type_enum",
        ),
        nullable=False,
        default=ScoreType.normal
    )
    time_limit: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True
    )

    # Relationships
    quiz: Mapped[Quiz] = relationship(
        "Quiz",
        back_populates="questions",
        lazy="selectin"
    )
    options: Mapped[list["Option"]] = relationship(
        "Option",
        back_populates="question",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="Option.order_index"
    )
    player_answers: Mapped[list["PlayerAnswer"]] = relationship(
        "PlayerAnswer",
        back_populates="question",
        lazy="selectin"
    )

    def validate_type(self) -> bool:
        """Validate question type is supported."""
        try:
            QuestionType(self.type)
            return True
        except ValueError:
            return False

    def validate_score_type(self) -> bool:
        """Validate score type is supported."""
        try:
            ScoreType(self.score_type)
            return True
        except ValueError:
            return False

    @property
    def correct_options(self) -> list["Option"]:
        """Get all correct options for this question."""
        return [opt for opt in self.options if opt.is_correct]

    @property
    def has_multiple_correct(self) -> bool:
        """Check if question has multiple correct answers."""
        return len(self.correct_options) > 1

    def __str__(self) -> str:
        question_type = getattr(self.type, "value", self.type)
        return f"Question(id={self.id}, type='{question_type}', order_index={self.order_index})"


class Option(Base):
    """Option model for multiple choice questions."""

    __tablename__ = "options"

    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=ModelConstants.DEFAULT_IS_CORRECT,
        nullable=False
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True
    )

    # Relationships
    question: Mapped[Question] = relationship(
        "Question",
        back_populates="options",
        lazy="selectin"
    )
    player_answers: Mapped[list["PlayerAnswer"]] = relationship(
        "PlayerAnswer",
        back_populates="option",
        lazy="selectin"
    )

    def __str__(self) -> str:
        return f"Option(id={self.id}, is_correct={self.is_correct}, order_index={self.order_index})"