"""Base models and common functionality."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all database models."""

    # Common fields that can be inherited
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        """String representation of the model instance."""
        attrs = []
        for column in self.__table__.columns:
            if column.name != 'password':  # Don't show password in repr
                value = getattr(self, column.name)
                if isinstance(value, str) and len(value) > 50:
                    value = value[:47] + "..."
                attrs.append(f"{column.name}={value!r}")
        return f"{self.__class__.__name__}({', '.join(attrs)})"

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to dictionary."""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


# Model constants
class ModelConstants:
    """Constants used across models."""

    # String length limits
    USERNAME_MAX_LENGTH = 50
    EMAIL_MAX_LENGTH = 100
    PASSWORD_MAX_LENGTH = 255
    TITLE_MAX_LENGTH = 255
    CATEGORY_MAX_LENGTH = 100
    NICKNAME_MAX_LENGTH = 100
    ROOM_CODE_LENGTH = 10
    IP_ADDRESS_MAX_LENGTH = 50

    # Question types
    QUESTION_TYPES = ["multiple_choice", "short_answer", "true_false"]

    # Score types
    SCORE_TYPES = ["equal", "weighted"]

    # Game session statuses
    GAME_STATUSES = ["waiting", "in_progress", "finished", "cancelled"]

    # Default values
    DEFAULT_QUESTION_COUNT = 0
    DEFAULT_TOTAL_SCORE = 0
    DEFAULT_SCORE_EARNED = 0
    DEFAULT_IS_ACTIVE = True
    DEFAULT_IS_DELETED = False
    DEFAULT_IS_CORRECT = False