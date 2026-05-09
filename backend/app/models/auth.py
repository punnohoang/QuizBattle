"""Authentication token models."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, ModelConstants

if TYPE_CHECKING:
    from .user import User


class RefreshToken(Base):
    """Refresh token model for JWT token management."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    token: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        index=True
    )
    device_info: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(ModelConstants.IP_ADDRESS_MAX_LENGTH),
        nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        nullable=False,
        index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="refresh_tokens",
        lazy="selectin"
    )

    @property
    def is_expired(self) -> bool:
        """Check if the token is expired."""
        return datetime.now(self.expires_at.tzinfo) > self.expires_at

    def __str__(self) -> str:
        return f"RefreshToken(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})"