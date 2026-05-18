"""Authentication and user management models."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, ModelConstants

if TYPE_CHECKING:
    from .quiz import Quiz
    from .game import GameSession, Participant


class Role(Base):
    """User role model for authorization."""

    __tablename__ = "roles"

    # Override base fields - roles don't need updated_at
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    role: Mapped[str] = mapped_column(
        String(ModelConstants.USERNAME_MAX_LENGTH),
        unique=True,
        nullable=False,
        index=True
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        secondary="role_users",
        back_populates="roles",
        lazy="selectin"
    )

    def __str__(self) -> str:
        return f"Role(id={self.id}, role='{self.role}')"


class User(Base):
    """User model for authentication and profile management."""

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(ModelConstants.USERNAME_MAX_LENGTH),
        unique=True,
        index=True,
        nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(ModelConstants.EMAIL_MAX_LENGTH),
        unique=True,
        index=True,
        nullable=False
    )
    password: Mapped[str] = mapped_column(
        String(ModelConstants.PASSWORD_MAX_LENGTH),
        nullable=False
    )
    avatar_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=ModelConstants.DEFAULT_IS_ACTIVE,
        nullable=False
    )

    # Relationships
    roles: Mapped[list[Role]] = relationship(
        "Role",
        secondary="role_users",
        back_populates="users",
        lazy="selectin"
    )
    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan"
    )
    hosted_sessions: Mapped[list["GameSession"]] = relationship(
        "GameSession",
        foreign_keys="GameSession.host_id",
        back_populates="host",
        lazy="selectin"
    )
    participations: Mapped[list["Participant"]] = relationship(
        "Participant",
        back_populates="user",
        lazy="selectin"
    )

    @property
    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return any(role.role.lower() == "admin" for role in self.roles)

    @property
    def display_name(self) -> str:
        """Get display name for the user."""
        return self.username

    def __str__(self) -> str:
        return f"User(id={self.id}, username='{self.username}', email='{self.email}')"


class RoleUser(Base):
    """Many-to-many relationship between users and roles."""

    __tablename__ = "role_users"

    # Override base fields - this junction table doesn't need timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    def __str__(self) -> str:
        return f"RoleUser(role_id={self.role_id}, user_id={self.user_id})"